CREATE OR REPLACE FUNCTION public.credit_deposit_atomic(_deposit_id uuid, _expected_amount numeric, _provider_tx_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  p record;
  new_balance numeric(14,2);
  allowed_amounts numeric[] := ARRAY[5,10,20,30,50,100]::numeric[];
BEGIN
  -- Lock the deposit row so concurrent callbacks cannot double-credit.
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  END IF;

  -- Idempotência: já creditado?
  IF d.credited_at IS NOT NULL OR d.status IN ('paid','approved') THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited', 'deposit_id', d.id);
  END IF;

  -- Somente valores oficiais do fluxo PIX Helix.
  IF NOT (ROUND(d.amount::numeric,2) = ANY(allowed_amounts)) THEN
    UPDATE public.deposits
       SET status = 'failed',
           last_error = format('unsupported deposit amount: %s', d.amount),
           updated_at = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount', 'amount', d.amount);
  END IF;

  -- Valida valor informado pela Diggion/API.
  IF _expected_amount IS NOT NULL AND ROUND(d.amount::numeric,2) <> ROUND(_expected_amount::numeric,2) THEN
    UPDATE public.deposits
       SET last_error = format('amount mismatch: expected %s got %s', d.amount, _expected_amount),
           updated_at = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'deposit_amount', d.amount, 'provider_amount', _expected_amount);
  END IF;

  -- Valida provider tx id se já foi salvo.
  IF _provider_tx_id IS NOT NULL AND d.external_id IS NOT NULL AND d.external_id <> _provider_tx_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_tx_mismatch');
  END IF;

  -- Lock profile row and credit.
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
         updated_at = now(),
         last_error = null
   WHERE id = d.id;

  INSERT INTO public.wallet_transactions(user_id, deposit_id, type, amount, balance_before, balance_after, description)
  VALUES (p.id, d.id, 'deposit', d.amount, COALESCE(p.balance,0), new_balance, 'Depósito PIX confirmado - ' || d.provider)
  ON CONFLICT DO NOTHING;

  -- Dispara comissões multinível.
  PERFORM public.process_deposit_commissions(d.id);

  RETURN jsonb_build_object('ok', true, 'deposit_id', d.id, 'amount', d.amount, 'new_balance', new_balance);
END;
$function$;

REVOKE ALL ON FUNCTION public.credit_deposit_atomic(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_deposit_atomic(uuid, numeric, text) TO service_role;