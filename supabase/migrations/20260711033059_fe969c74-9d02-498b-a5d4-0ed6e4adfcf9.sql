
-- 1) Tabela de histórico de ajustes manuais
CREATE TABLE IF NOT EXISTS public.admin_balance_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('credit','debit','reset')),
  amount numeric(14,2) NOT NULL,
  balance_before numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
  reason text NOT NULL,
  note text,
  ip text,
  user_agent text,
  idempotency_key text UNIQUE,
  wallet_tx_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  audit_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_balance_adjustments TO authenticated;
GRANT ALL    ON public.admin_balance_adjustments TO service_role;

ALTER TABLE public.admin_balance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view balance adjustments" ON public.admin_balance_adjustments;
CREATE POLICY "Admins can view balance adjustments"
  ON public.admin_balance_adjustments
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS admin_balance_adjustments_target_idx
  ON public.admin_balance_adjustments (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_balance_adjustments_admin_idx
  ON public.admin_balance_adjustments (admin_user_id, created_at DESC);

-- 2) RPC principal: aplica ajuste manual em profiles.balance
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  _target_user_id uuid,
  _action text,                 -- 'credit' | 'debit' | 'reset'
  _amount numeric DEFAULT NULL, -- em reais; ignorado para 'reset'
  _reason text DEFAULT NULL,
  _note text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _confirmation text DEFAULT NULL -- exigido para 'reset'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid := auth.uid();
  p record;
  before_bal numeric(14,2);
  after_bal  numeric(14,2);
  delta      numeric(14,2);
  tx_type text := 'adjustment';
  tx_id uuid;
  audit_id uuid;
  adj_id uuid;
  existing record;
BEGIN
  -- Auth
  IF admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.is_admin(admin_id) THEN
    PERFORM public.log_audit_event(
      _event_type := 'ADMIN_BALANCE_FORBIDDEN',
      _module := 'admin_wallet',
      _severity := 'warning',
      _title := 'Tentativa de ajuste manual sem permissão',
      _metadata := jsonb_build_object('target_user_id', _target_user_id, 'action', _action),
      _user_id := admin_id
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Validações comuns
  IF _action NOT IN ('credit','debit','reset') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_action');
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  IF _action = 'reset' AND COALESCE(_confirmation,'') <> 'RESETAR SALDO' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'confirmation_required');
  END IF;
  IF _action IN ('credit','debit') THEN
    IF _amount IS NULL OR _amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
    END IF;
  END IF;

  -- Idempotência
  IF _idempotency_key IS NOT NULL THEN
    SELECT * INTO existing FROM public.admin_balance_adjustments
     WHERE idempotency_key = _idempotency_key LIMIT 1;
    IF existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'reason', 'already_applied',
        'adjustment_id', existing.id,
        'balance_before', existing.balance_before,
        'balance_after', existing.balance_after);
    END IF;
  END IF;

  -- Trava a carteira do usuário
  SELECT * INTO p FROM public.profiles WHERE id = _target_user_id FOR UPDATE;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found');
  END IF;

  before_bal := COALESCE(p.balance, 0)::numeric(14,2);

  IF _action = 'credit' THEN
    delta := _amount::numeric(14,2);
    after_bal := (before_bal + delta)::numeric(14,2);
  ELSIF _action = 'debit' THEN
    delta := -(_amount::numeric(14,2));
    after_bal := (before_bal + delta)::numeric(14,2);
    IF after_bal < 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance',
        'balance', before_bal);
    END IF;
  ELSE  -- reset
    delta := -before_bal;
    after_bal := 0::numeric(14,2);
  END IF;

  -- Aplica no perfil (bypass do trigger protect_profile_financials porque roda como SECURITY DEFINER com role postgres)
  UPDATE public.profiles
     SET balance = after_bal,
         updated_at = now()
   WHERE id = p.id;

  -- Ledger da carteira
  INSERT INTO public.wallet_transactions(
    user_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    p.id, tx_type, delta, before_bal, after_bal,
    format('Ajuste manual (%s) por admin %s — %s', _action, admin_id, _reason)
  ) RETURNING id INTO tx_id;

  -- Auditoria administrativa
  audit_id := public.log_audit_event(
    _event_type := CASE _action
      WHEN 'credit' THEN 'ADMIN_BALANCE_ADDED'
      WHEN 'debit'  THEN 'ADMIN_BALANCE_REMOVED'
      ELSE               'ADMIN_BALANCE_RESET'
    END,
    _module := 'admin_wallet',
    _severity := CASE WHEN _action = 'reset' THEN 'critical' ELSE 'warning' END,
    _title := format('Ajuste manual de saldo: %s R$ %s',
      CASE _action WHEN 'credit' THEN '+' WHEN 'debit' THEN '-' ELSE 'reset' END,
      COALESCE(_amount, before_bal)),
    _message := _note,
    _metadata := jsonb_build_object(
      'target_user_id', p.id,
      'action', _action,
      'amount', COALESCE(_amount, before_bal),
      'delta', delta,
      'balance_before', before_bal,
      'balance_after', after_bal,
      'reason', _reason,
      'note', _note,
      'ip', _ip,
      'user_agent', _user_agent,
      'wallet_tx_id', tx_id
    ),
    _entity_type := 'profile',
    _entity_id := p.id::text,
    _user_id := admin_id
  );

  -- Histórico dedicado
  INSERT INTO public.admin_balance_adjustments(
    admin_user_id, target_user_id, action, amount,
    balance_before, balance_after, reason, note,
    ip, user_agent, idempotency_key, wallet_tx_id, audit_event_id
  ) VALUES (
    admin_id, p.id, _action, COALESCE(_amount, before_bal),
    before_bal, after_bal, _reason, _note,
    _ip, _user_agent, _idempotency_key, tx_id, audit_id
  ) RETURNING id INTO adj_id;

  RETURN jsonb_build_object(
    'ok', true,
    'adjustment_id', adj_id,
    'wallet_tx_id', tx_id,
    'balance_before', before_bal,
    'balance_after', after_bal,
    'delta', delta
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, text, text, text, text, text) TO authenticated;

-- 3) RPC de leitura: histórico agregado (ajustes + últimas movimentações)
CREATE OR REPLACE FUNCTION public.admin_wallet_history(_target_user_id uuid, _limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  adjustments jsonb;
  txs jsonb;
BEGIN
  IF caller IS NULL OR NOT public.is_admin(caller) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb) INTO adjustments
  FROM (
    SELECT ab.id, ab.action, ab.amount, ab.balance_before, ab.balance_after,
           ab.reason, ab.note, ab.admin_user_id, ab.created_at,
           adm.display_name AS admin_display_name
      FROM public.admin_balance_adjustments ab
      LEFT JOIN public.profiles adm ON adm.id = ab.admin_user_id
     WHERE ab.target_user_id = _target_user_id
     ORDER BY ab.created_at DESC
     LIMIT _limit
  ) a;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO txs
  FROM (
    SELECT wt.id, wt.type, wt.amount, wt.balance_before, wt.balance_after,
           wt.description, wt.created_at
      FROM public.wallet_transactions wt
     WHERE wt.user_id = _target_user_id
     ORDER BY wt.created_at DESC
     LIMIT _limit
  ) t;

  RETURN jsonb_build_object('ok', true, 'adjustments', adjustments, 'transactions', txs);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_wallet_history(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wallet_history(uuid, int) TO authenticated;
