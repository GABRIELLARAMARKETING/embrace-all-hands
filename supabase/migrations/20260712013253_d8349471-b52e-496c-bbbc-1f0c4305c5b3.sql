
-- 1) credit_deposit_atomic: passa a registrar depósitos confirmados/bloqueados no audit_events
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
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  END IF;

  IF d.credited_at IS NOT NULL OR d.status IN ('paid','approved') THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited', 'deposit_id', d.id);
  END IF;

  IF public.is_demo_user(d.user_id) THEN
    UPDATE public.deposits
       SET status='failed', last_error='demo account cannot receive real deposit', updated_at=now()
     WHERE id = d.id;
    PERFORM public.log_audit_event(
      _event_type := 'DEPOSIT_BLOCKED',
      _module := 'deposits',
      _severity := 'warning',
      _title := format('Depósito bloqueado (demo) - R$ %s', d.amount),
      _metadata := jsonb_build_object('deposit_id', d.id, 'reason', 'demo_account_blocked',
                                      'amount', d.amount, 'provider', d.provider,
                                      'external_id', d.external_id),
      _entity_type := 'deposit', _entity_id := d.id::text, _user_id := d.user_id
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'demo_account_blocked');
  END IF;

  IF NOT (ROUND(d.amount::numeric,2) = ANY(allowed_amounts)) THEN
    UPDATE public.deposits
       SET status='failed', last_error=format('unsupported deposit amount: %s', d.amount), updated_at=now()
     WHERE id = d.id;
    PERFORM public.log_audit_event(
      _event_type := 'DEPOSIT_BLOCKED', _module := 'deposits', _severity := 'warning',
      _title := format('Depósito bloqueado (valor não permitido) - R$ %s', d.amount),
      _metadata := jsonb_build_object('deposit_id', d.id, 'reason', 'unsupported_amount',
                                      'amount', d.amount, 'provider', d.provider),
      _entity_type := 'deposit', _entity_id := d.id::text, _user_id := d.user_id
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount', 'amount', d.amount);
  END IF;

  IF _expected_amount IS NOT NULL AND ROUND(d.amount::numeric,2) <> ROUND(_expected_amount::numeric,2) THEN
    UPDATE public.deposits
       SET last_error=format('amount mismatch: expected %s got %s', d.amount, _expected_amount), updated_at=now()
     WHERE id = d.id;
    PERFORM public.log_audit_event(
      _event_type := 'DEPOSIT_BLOCKED', _module := 'deposits', _severity := 'error',
      _title := format('Depósito com valor divergente - R$ %s (esperado %s)', d.amount, _expected_amount),
      _metadata := jsonb_build_object('deposit_id', d.id, 'reason', 'amount_mismatch',
                                      'amount', d.amount, 'expected', _expected_amount,
                                      'provider', d.provider),
      _entity_type := 'deposit', _entity_id := d.id::text, _user_id := d.user_id
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;

  IF _provider_tx_id IS NOT NULL AND d.external_id IS NOT NULL AND d.external_id <> _provider_tx_id THEN
    PERFORM public.log_audit_event(
      _event_type := 'DEPOSIT_BLOCKED', _module := 'deposits', _severity := 'error',
      _title := 'Depósito com tx_id divergente do provedor',
      _metadata := jsonb_build_object('deposit_id', d.id, 'reason', 'provider_tx_mismatch',
                                      'stored', d.external_id, 'provided', _provider_tx_id),
      _entity_type := 'deposit', _entity_id := d.id::text, _user_id := d.user_id
    );
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_tx_mismatch');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = d.user_id FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  new_balance := COALESCE(p.balance,0) + d.amount;

  UPDATE public.profiles SET balance = new_balance, updated_at = now() WHERE id = p.id;

  UPDATE public.deposits
     SET status='paid', paid_at=COALESCE(d.paid_at, now()), credited_at=now(),
         external_id=COALESCE(d.external_id, _provider_tx_id), updated_at=now(), last_error=null
   WHERE id = d.id;

  INSERT INTO public.wallet_transactions(user_id, deposit_id, type, amount, balance_before, balance_after, description)
  VALUES (p.id, d.id, 'deposit', d.amount, COALESCE(p.balance,0), new_balance, 'Depósito PIX confirmado - ' || d.provider)
  ON CONFLICT DO NOTHING;

  PERFORM public.process_deposit_commissions(d.id);

  PERFORM public.log_audit_event(
    _event_type := 'DEPOSIT_CONFIRMED', _module := 'deposits', _severity := 'info',
    _title := format('Depósito confirmado - R$ %s', d.amount),
    _metadata := jsonb_build_object(
      'deposit_id', d.id, 'amount', d.amount, 'provider', d.provider,
      'external_id', COALESCE(d.external_id, _provider_tx_id),
      'balance_before', COALESCE(p.balance,0), 'balance_after', new_balance
    ),
    _entity_type := 'deposit', _entity_id := d.id::text, _user_id := p.id
  );

  RETURN jsonb_build_object('ok', true, 'deposit_id', d.id, 'amount', d.amount, 'new_balance', new_balance);
END;
$function$;

-- 2) helix_register_platform: registra eventos de plataforma inválidos (fraude / dessincronia)
CREATE OR REPLACE FUNCTION public.helix_register_platform(_session_id uuid, _platform_index integer, _client_ts bigint DEFAULT NULL::bigint, _event_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  s record;
  last_idx integer;
  delta_ms integer;
  is_valid_flag boolean := true;
  reason text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id = _session_id FOR UPDATE;
  IF s IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found'); END IF;
  IF s.user_id <> uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  IF s.status NOT IN ('active','started') THEN RETURN jsonb_build_object('ok', false, 'reason', 'session_not_active'); END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    UPDATE public.game_sessions SET status='expired' WHERE id = s.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'session_expired');
  END IF;
  IF s.payout_per_platform_cents <= 0
     OR (s.deposit_id IS NULL AND COALESCE(s.demo_stake_cents, 0) <= 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_paid_session');
  END IF;
  IF _platform_index IS NULL OR _platform_index <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_platform');
  END IF;

  SELECT MAX(e.platform_index) INTO last_idx
    FROM public.helix_platform_events e
   WHERE e.session_id = s.id AND e.is_valid = true;

  IF last_idx IS NOT NULL AND _platform_index <= last_idx THEN
    is_valid_flag := false; reason := 'out_of_sequence_or_repeat';
  ELSIF last_idx IS NOT NULL AND _platform_index > last_idx + 5 THEN
    is_valid_flag := false; reason := 'impossible_jump';
  END IF;

  IF s.last_platform_at IS NOT NULL THEN
    delta_ms := (EXTRACT(EPOCH FROM (now() - s.last_platform_at))*1000)::int;
  END IF;

  BEGIN
    INSERT INTO public.helix_platform_events(
      session_id, user_id, platform_index, client_timestamp, delta_time_ms,
      event_hash, is_valid, invalid_reason
    ) VALUES (
      s.id, uid, _platform_index, _client_ts, delta_ms,
      _event_hash, is_valid_flag, reason
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_platform');
  END;

  IF is_valid_flag THEN
    UPDATE public.game_sessions
       SET platforms_passed = platforms_passed + 1,
           validated_platforms_passed = validated_platforms_passed + 1,
           last_platform_at = now()
     WHERE id = s.id;
  ELSE
    UPDATE public.game_sessions
       SET platforms_passed = platforms_passed + 1,
           anti_fraud_score = anti_fraud_score + 1,
           last_platform_at = now()
     WHERE id = s.id;

    PERFORM public.log_audit_event(
      _event_type := 'HELIX_PLATFORM_INVALID',
      _module := 'helix_gameplay',
      _severity := 'warning',
      _title := format('Plataforma inválida (%s) na sessão %s', reason, s.id),
      _metadata := jsonb_build_object(
        'session_id', s.id, 'platform_index', _platform_index,
        'last_valid_index', last_idx, 'delta_ms', delta_ms,
        'reason', reason, 'event_hash', _event_hash,
        'client_timestamp', _client_ts
      ),
      _entity_type := 'game_session', _entity_id := s.id::text, _user_id := uid
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'valid', is_valid_flag, 'invalid_reason', reason);
END $function$;

-- 3) Nova função: snapshot auditado do cálculo de saldo sacável.
--    Chamável pelo app quando o suporte precisa investigar o valor exibido em /app/sacar.
CREATE OR REPLACE FUNCTION public.helix_log_withdrawal_snapshot(_context text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  rules jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT public.helix_withdrawal_rules() INTO rules;

  PERFORM public.log_audit_event(
    _event_type := 'HELIX_WITHDRAWAL_SNAPSHOT',
    _module := 'withdrawals',
    _severity := 'info',
    _title := format('Snapshot de saldo sacável para %s', uid),
    _metadata := jsonb_build_object('rules', rules, 'context', _context),
    _entity_type := 'profile', _entity_id := uid::text, _user_id := uid
  );

  RETURN jsonb_build_object('ok', true, 'rules', rules);
END $function$;

GRANT EXECUTE ON FUNCTION public.helix_log_withdrawal_snapshot(text) TO authenticated;
