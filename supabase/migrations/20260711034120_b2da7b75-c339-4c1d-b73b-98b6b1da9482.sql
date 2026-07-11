
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  _target_user_id uuid,
  _action text,
  _amount numeric DEFAULT NULL,
  _reason text DEFAULT NULL,
  _note text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _confirmation text DEFAULT NULL
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
  synth_deposit_id uuid;
  allowed_amounts numeric[] := ARRAY[5,10,20,30,50,100]::numeric[];
BEGIN
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
  ELSE
    delta := -before_bal;
    after_bal := 0::numeric(14,2);
  END IF;

  UPDATE public.profiles
     SET balance = after_bal,
         updated_at = now()
   WHERE id = p.id;

  INSERT INTO public.wallet_transactions(
    user_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    p.id, tx_type, delta, before_bal, after_bal,
    format('Ajuste manual (%s) por admin %s — %s', _action, admin_id, _reason)
  ) RETURNING id INTO tx_id;

  -- Ao creditar um valor jogável, cria um depósito sintético pago para
  -- destravar o jogo (o trigger block_free_play exige deposits.status='paid').
  IF _action = 'credit' AND _amount = ANY(allowed_amounts) THEN
    INSERT INTO public.deposits(
      user_id, amount, currency, provider, payment_method,
      status, paid_at, credited_at, confirmed_at,
      idempotency_key
    ) VALUES (
      p.id, _amount::numeric, 'BRL', 'admin_manual', 'admin_adjustment',
      'paid', now(), now(), now(),
      COALESCE('admin_credit:' || _idempotency_key, 'admin_credit:' || gen_random_uuid()::text)
    )
    RETURNING id INTO synth_deposit_id;
  END IF;

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
      'wallet_tx_id', tx_id,
      'synth_deposit_id', synth_deposit_id
    ),
    _entity_type := 'profile',
    _entity_id := p.id::text,
    _user_id := admin_id
  );

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
    'delta', delta,
    'synth_deposit_id', synth_deposit_id
  );
END $$;
