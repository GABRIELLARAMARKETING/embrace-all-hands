CREATE OR REPLACE FUNCTION public.helix_create_session(_deposit_id uuid, _amount numeric, _theme_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  d record;
  p record;
  payout integer;
  new_id uuid;
  expires timestamptz;
  amount_cents integer;
  effective_deposit uuid := NULL;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  amount_cents := ROUND(_amount * 100)::int;
  payout := public.helix_payout_cents(amount_cents);
  IF payout IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found'); END IF;
  IF COALESCE(p.is_demo, false) THEN RETURN jsonb_build_object('ok', false, 'reason', 'demo_account'); END IF;
  IF COALESCE(p.balance, 0) < _amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance');
  END IF;

  IF _deposit_id IS NOT NULL THEN
    SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
    IF d.user_id = uid
       AND d.status IN ('paid','approved','spent')
       AND d.credited_at IS NOT NULL THEN
      effective_deposit := d.id;
    END IF;
  END IF;

  IF effective_deposit IS NULL THEN
    SELECT id INTO effective_deposit
      FROM public.deposits
     WHERE user_id = uid
       AND status IN ('paid','approved','spent')
       AND credited_at IS NOT NULL
     ORDER BY paid_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  -- Auto-abandona quaisquer sessões antigas em aberto do usuário para nunca
  -- bloquear a criação de uma nova partida.
  UPDATE public.game_sessions
     SET status = 'abandoned',
         ended_at = COALESCE(ended_at, now())
   WHERE user_id = uid
     AND credited_at IS NULL
     AND status IN ('active','started');

  expires := now() + interval '30 minutes';
  INSERT INTO public.game_sessions(
    user_id, theme_id, status, deposit_id,
    payout_per_platform_cents, stake_cents,
    expires_at, idempotency_key
  ) VALUES (
    uid, _theme_id, 'active', effective_deposit,
    payout, amount_cents,
    expires, 'helix_session:' || uid::text || ':' || extract(epoch from clock_timestamp())::bigint::text || ':' || substr(md5(random()::text), 1, 8)
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', new_id,
    'payout_per_platform_cents', payout,
    'stake_cents', amount_cents,
    'deposit_id', effective_deposit,
    'expires_at', expires
  );
END $$;

REVOKE ALL ON FUNCTION public.helix_create_session(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_create_session(uuid, numeric, uuid) TO authenticated, service_role;