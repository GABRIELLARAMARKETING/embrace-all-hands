
CREATE OR REPLACE FUNCTION public.helix_request_withdrawal_atomic(
  _amount_cents integer,
  _pix_key text,
  _request_ip text DEFAULT NULL,
  _request_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  p record;
  bal_cents integer;
  top_dep_cents integer;
  min_cents integer;
  new_balance_reais numeric(14,2);
  new_withdrawal_id uuid;
  amount_reais numeric(14,2);
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF _pix_key IS NULL OR length(btrim(_pix_key)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_pix');
  END IF;

  -- LOCK profile row for the duration of the transaction to serialize concurrent withdrawals
  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  IF COALESCE(p.is_demo, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demo_account');
  END IF;

  bal_cents := ROUND(COALESCE(p.balance, 0) * 100)::int;

  -- Reference deposit (locked read via join isn't necessary; deposits are append/state-only for this user)
  SELECT ROUND(MAX(amount) * 100)::int
    INTO top_dep_cents
    FROM public.deposits
   WHERE user_id = uid
     AND status IN ('paid','approved','spent')
     AND credited_at IS NOT NULL
     AND ROUND(amount * 100)::int IN (500,1000,2000,3000,5000,10000);

  IF top_dep_cents IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_confirmed_deposit');
  END IF;

  min_cents := public.helix_minimum_withdraw_cents(top_dep_cents);
  IF min_cents IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reference');
  END IF;

  IF _amount_cents < min_cents THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'below_minimum',
      'minimum_withdraw_cents', min_cents,
      'available_reward_cents', bal_cents
    );
  END IF;

  IF _amount_cents > bal_cents THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'insufficient_balance',
      'available_reward_cents', bal_cents
    );
  END IF;

  amount_reais := (_amount_cents::numeric / 100)::numeric(14,2);
  new_balance_reais := ((bal_cents - _amount_cents)::numeric / 100)::numeric(14,2);

  INSERT INTO public.affiliate_withdrawals (user_id, amount, pix_key, request_ip, request_user_agent)
    VALUES (uid, _amount_cents, _pix_key, _request_ip, _request_user_agent)
    RETURNING id INTO new_withdrawal_id;

  UPDATE public.profiles
     SET balance = new_balance_reais, updated_at = now()
   WHERE id = uid;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, description)
    VALUES (uid, 'withdrawal_request', amount_reais,
            (bal_cents::numeric / 100)::numeric(14,2),
            new_balance_reais,
            'Solicitação de saque Helix #' || new_withdrawal_id::text);

  PERFORM public.log_audit_event(
    _event_type := 'HELIX_WITHDRAWAL_REQUESTED',
    _module := 'withdrawals',
    _severity := 'info',
    _title := format('Saque atômico R$ %s', amount_reais),
    _metadata := jsonb_build_object(
      'withdrawal_id', new_withdrawal_id,
      'amount_cents', _amount_cents,
      'balance_before_cents', bal_cents,
      'balance_after_cents', bal_cents - _amount_cents,
      'reference_deposit_cents', top_dep_cents,
      'minimum_withdraw_cents', min_cents
    ),
    _entity_type := 'affiliate_withdrawal',
    _entity_id := new_withdrawal_id::text,
    _user_id := uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', new_withdrawal_id,
    'amount_cents', _amount_cents,
    'available_reward_cents', bal_cents - _amount_cents,
    'reference_deposit_cents', top_dep_cents,
    'minimum_withdraw_cents', min_cents
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.helix_request_withdrawal_atomic(integer, text, text, text) TO authenticated;
