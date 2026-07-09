
-- profiles: saldo real + dados KYC
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- deposits: dados do provider
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'diggion',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS copy_paste_code text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS credited_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_payload jsonb,
  ADD COLUMN IF NOT EXISTS response_payload jsonb,
  ADD COLUMN IF NOT EXISTS webhook_payload jsonb,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS deposits_provider_external_uidx
  ON public.deposits(provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS deposits_idempotency_uidx
  ON public.deposits(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Adiciona status novos ao enum se ainda não existirem
DO $$ BEGIN
  ALTER TYPE deposit_status ADD VALUE IF NOT EXISTS 'waiting_payment';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE deposit_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE deposit_status ADD VALUE IF NOT EXISTS 'canceled';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE deposit_status ADD VALUE IF NOT EXISTS 'failed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- wallet_transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('deposit','withdraw','commission','adjustment','refund')),
  amount numeric(14,2) NOT NULL,
  balance_before numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_tx_user_idx ON public.wallet_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_deposit_uidx
  ON public.wallet_transactions(deposit_id)
  WHERE deposit_id IS NOT NULL AND type = 'deposit';

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own wallet tx" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- payment_webhook_logs
CREATE TABLE IF NOT EXISTS public.payment_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text,
  provider_transaction_id text,
  headers jsonb,
  payload jsonb,
  signature_valid boolean,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_logs_provider_tx_idx
  ON public.payment_webhook_logs(provider, provider_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS webhook_logs_event_uidx
  ON public.payment_webhook_logs(provider, event_id)
  WHERE event_id IS NOT NULL;

GRANT SELECT ON public.payment_webhook_logs TO authenticated;
GRANT ALL ON public.payment_webhook_logs TO service_role;
ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads webhook logs" ON public.payment_webhook_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Função atômica para creditar depósito (idempotente, com trava)
CREATE OR REPLACE FUNCTION public.credit_deposit_atomic(
  _deposit_id uuid,
  _expected_amount numeric,
  _provider_tx_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  p record;
  new_balance numeric(14,2);
BEGIN
  -- Lock the deposit row
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  END IF;

  -- Idempotência: já creditado?
  IF d.credited_at IS NOT NULL OR d.status IN ('paid','approved') THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited', 'deposit_id', d.id);
  END IF;

  -- Valida valor
  IF _expected_amount IS NOT NULL AND ROUND(d.amount::numeric,2) <> ROUND(_expected_amount::numeric,2) THEN
    UPDATE public.deposits
       SET last_error = format('amount mismatch: expected %s got %s', d.amount, _expected_amount),
           updated_at = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;

  -- Valida provider tx id se já foi salvo
  IF _provider_tx_id IS NOT NULL AND d.external_id IS NOT NULL AND d.external_id <> _provider_tx_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_tx_mismatch');
  END IF;

  -- Lock profile row and credit
  SELECT * INTO p FROM public.profiles WHERE id = d.user_id FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  new_balance := COALESCE(p.balance,0) + d.amount;

  UPDATE public.profiles SET balance = new_balance, updated_at = now() WHERE id = p.id;

  UPDATE public.deposits
     SET status = 'paid',
         paid_at = COALESCE(d.paid_at, now()),
         credited_at = now(),
         external_id = COALESCE(d.external_id, _provider_tx_id),
         updated_at = now()
   WHERE id = d.id;

  INSERT INTO public.wallet_transactions(user_id, deposit_id, type, amount, balance_before, balance_after, description)
  VALUES (p.id, d.id, 'deposit', d.amount, COALESCE(p.balance,0), new_balance, 'Depósito PIX confirmado - ' || d.provider);

  -- Dispara comissões multinível
  PERFORM public.process_deposit_commissions(d.id);

  RETURN jsonb_build_object('ok', true, 'deposit_id', d.id, 'new_balance', new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_deposit_atomic(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
