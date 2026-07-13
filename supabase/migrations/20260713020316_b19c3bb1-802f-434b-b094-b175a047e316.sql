ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS stake_cents integer;

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
  existing uuid;
  new_id uuid;
  expires timestamptz;
  amount_cents integer;
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

  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found'); END IF;
  IF d.user_id <> uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  IF d.status NOT IN ('paid','approved','spent') THEN RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_paid'); END IF;
  IF d.credited_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_credited'); END IF;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found'); END IF;
  IF COALESCE(p.is_demo, false) THEN RETURN jsonb_build_object('ok', false, 'reason', 'demo_account'); END IF;
  IF COALESCE(p.balance, 0) < _amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance');
  END IF;

  SELECT id INTO existing
    FROM public.game_sessions
   WHERE user_id = uid
     AND deposit_id IS NOT NULL
     AND credited_at IS NULL
     AND status IN ('active','started')
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_already_active', 'session_id', existing);
  END IF;

  expires := now() + interval '30 minutes';
  INSERT INTO public.game_sessions(
    user_id, theme_id, status, deposit_id,
    payout_per_platform_cents, stake_cents,
    expires_at, idempotency_key
  ) VALUES (
    uid, _theme_id, 'active', d.id,
    payout, amount_cents,
    expires, 'helix_session:' || uid::text || ':' || extract(epoch from now())::bigint::text
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', new_id,
    'payout_per_platform_cents', payout,
    'deposit_amount_cents', ROUND(d.amount * 100)::int,
    'stake_cents', amount_cents,
    'expires_at', expires
  );
END $$;

REVOKE ALL ON FUNCTION public.helix_create_session(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_create_session(uuid, numeric, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.helix_finish_session(_session_id uuid, _reason text DEFAULT 'player_finished')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  s record;
  p record;
  validated int;
  reward_c int;
  reward_reais numeric(14,2);
  new_bal numeric(14,2);
  new_demo_bal numeric(14,2);
  dep_amt_cents int;
  dep_amt numeric(14,2);
  bal_before numeric(14,2);
  demo_before numeric(14,2);
  actual_delta numeric(14,2);
  is_gameover boolean;
  is_demo boolean;
  tx_type text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO s FROM public.game_sessions WHERE id = _session_id FOR UPDATE;
  IF s IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found');
  END IF;
  IF s.user_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF s.credited_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_finished',
      'session_id', s.id,
      'validated_platforms_passed', s.validated_platforms_passed,
      'reward_cents', s.reward_cents);
  END IF;

  is_gameover := (_reason = 'player_lost');

  SELECT COUNT(*) INTO validated
    FROM public.helix_platform_events e
   WHERE e.session_id = s.id AND e.is_valid = true;

  IF s.deposit_id IS NOT NULL THEN
    SELECT COALESCE(s.stake_cents, ROUND(amount * 100)::int),
           (COALESCE(s.stake_cents, ROUND(amount * 100)::int) / 100.0)::numeric(14,2)
      INTO dep_amt_cents, dep_amt
      FROM public.deposits WHERE id = s.deposit_id;
  ELSE
    dep_amt_cents := COALESCE(s.demo_stake_cents, 0);
    dep_amt := (dep_amt_cents / 100.0)::numeric(14,2);
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  is_demo := COALESCE(p.is_demo, false);
  bal_before := COALESCE(p.balance, 0)::numeric(14,2);
  demo_before := COALESCE(p.demo_balance, 0)::numeric(14,2);

  IF is_gameover THEN
    reward_c := 0;
    reward_reais := 0;
    tx_type := 'game_loss';
  ELSE
    reward_c := CASE
      WHEN s.payout_per_platform_cents > 0 AND validated > 0
        THEN validated * s.payout_per_platform_cents
      ELSE 0 END;
    reward_reais := (reward_c / 100.0)::numeric(14,2);
    tx_type := CASE WHEN reward_c > 0 THEN 'game_reward' ELSE 'game_loss' END;
  END IF;

  IF is_demo THEN
    IF is_gameover THEN
      new_demo_bal := GREATEST(demo_before - COALESCE(dep_amt, 0), 0)::numeric(14,2);
    ELSE
      new_demo_bal := (GREATEST(demo_before - COALESCE(dep_amt, 0), 0) + reward_reais)::numeric(14,2);
    END IF;
    actual_delta := (new_demo_bal - demo_before)::numeric(14,2);

    IF demo_before IS DISTINCT FROM new_demo_bal THEN
      UPDATE public.profiles
         SET demo_balance = new_demo_bal, updated_at = now()
       WHERE id = uid;
    END IF;

    INSERT INTO public.wallet_transactions(
      user_id, deposit_id, type, amount, balance_before, balance_after, description
    ) VALUES (
      uid, s.deposit_id,
      CASE WHEN is_gameover THEN 'demo_game_loss'
           WHEN reward_c > 0 THEN 'demo_game_reward'
           ELSE 'demo_game_loss' END,
      actual_delta, demo_before, new_demo_bal,
      'DEMO — não sacável — ' || CASE WHEN is_gameover THEN 'perda de R$ ' || to_char(COALESCE(dep_amt, 0), 'FM999999990.00') WHEN reward_c > 0 THEN 'entrada R$ ' || to_char(COALESCE(dep_amt, 0), 'FM999999990.00') || ' e recompensa demo R$ ' || to_char(reward_reais, 'FM999999990.00') ELSE 'entrada consumida sem recompensa' END
    );
    new_bal := bal_before;
  ELSE
    IF is_gameover THEN
      new_bal := GREATEST(bal_before - COALESCE(dep_amt, 0), 0)::numeric(14,2);
    ELSE
      new_bal := (GREATEST(bal_before - COALESCE(dep_amt, 0), 0) + reward_reais)::numeric(14,2);
    END IF;
    actual_delta := (new_bal - bal_before)::numeric(14,2);

    IF bal_before IS DISTINCT FROM new_bal THEN
      UPDATE public.profiles SET balance = new_bal, updated_at = now() WHERE id = uid;
    END IF;

    INSERT INTO public.wallet_transactions(
      user_id, deposit_id, type, amount, balance_before, balance_after, description
    ) VALUES (
      uid, s.deposit_id, tx_type, actual_delta, bal_before, new_bal,
      CASE
        WHEN is_gameover THEN 'Perda Helix - entrada consumida (R$ ' || to_char(COALESCE(dep_amt, 0), 'FM999999990.00') || ')'
        WHEN reward_c > 0 THEN 'Partida Helix finalizada - entrada R$ ' || to_char(COALESCE(dep_amt, 0), 'FM999999990.00') || ' consumida e recompensa de R$ ' || to_char(reward_reais, 'FM999999990.00')
        ELSE 'Partida Helix finalizada - entrada R$ ' || to_char(COALESCE(dep_amt, 0), 'FM999999990.00') || ' consumida sem recompensa'
      END
    );
  END IF;

  UPDATE public.game_sessions
     SET status = CASE WHEN is_gameover THEN 'gameover' ELSE 'finished' END,
         validated_platforms_passed = validated,
         reward_cents = reward_c,
         credited_at = now(),
         finished_at = now()
   WHERE id = s.id;

  IF s.deposit_id IS NOT NULL THEN
    UPDATE public.deposits SET status = CASE WHEN status IN ('paid','approved') THEN 'spent' ELSE status END, updated_at = now() WHERE id = s.deposit_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', s.id,
    'is_demo', is_demo,
    'deposit_amount_cents', dep_amt_cents,
    'stake_cents', dep_amt_cents,
    'payout_per_platform_cents', s.payout_per_platform_cents,
    'validated_platforms_passed', validated,
    'reward_cents', reward_c,
    'new_balance', new_bal,
    'new_demo_balance', COALESCE(new_demo_bal, demo_before),
    'lost', is_gameover
  );
END $$;

CREATE OR REPLACE FUNCTION public.helix_abandon_active_sessions(_grace_seconds int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  s record;
  abandoned int := 0;
  finish_reason text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  FOR s IN
    SELECT id, status
      FROM public.game_sessions
     WHERE user_id = uid
       AND credited_at IS NULL
       AND deposit_id IS NOT NULL
       AND (
         (status IN ('active','started') AND created_at < now() - make_interval(secs => _grace_seconds))
         OR status IN ('gameover','finished')
       )
  LOOP
    finish_reason := CASE WHEN s.status = 'finished' THEN 'player_finished' ELSE 'player_lost' END;
    PERFORM public.helix_finish_session(s.id, finish_reason);
    abandoned := abandoned + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'abandoned', abandoned);
END $$;

REVOKE ALL ON FUNCTION public.helix_abandon_active_sessions(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_abandon_active_sessions(int) TO authenticated, service_role;