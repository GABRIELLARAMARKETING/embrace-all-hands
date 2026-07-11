
-- 1) Coluna para armazenar o "stake" da partida demo (quando não há deposit_id)
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS demo_stake_cents integer;

-- 2) helix_register_platform — permitir sessões demo (sem deposit_id) desde
--    que tenham payout_per_platform_cents > 0.
CREATE OR REPLACE FUNCTION public.helix_register_platform(
  _session_id uuid, _platform_index integer,
  _client_ts bigint DEFAULT NULL, _event_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid(); s record;
  last_idx integer; delta_ms integer;
  is_valid_flag boolean := true; reason text; min_gap_ms integer := 150;
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

  SELECT MAX(e.platform_index) INTO last_idx FROM public.helix_platform_events e
    WHERE e.session_id = s.id AND e.is_valid = true;

  IF last_idx IS NOT NULL AND _platform_index <= last_idx THEN
    is_valid_flag := false; reason := 'out_of_sequence_or_repeat';
  ELSIF last_idx IS NOT NULL AND _platform_index > last_idx + 5 THEN
    is_valid_flag := false; reason := 'impossible_jump';
  END IF;

  IF s.last_platform_at IS NOT NULL THEN
    delta_ms := (EXTRACT(EPOCH FROM (now() - s.last_platform_at))*1000)::int;
    IF delta_ms < min_gap_ms THEN
      is_valid_flag := false; reason := COALESCE(reason, 'too_fast');
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.helix_platform_events(session_id, user_id, platform_index, client_timestamp, delta_time_ms, event_hash, is_valid, invalid_reason)
      VALUES (s.id, uid, _platform_index, _client_ts, delta_ms, _event_hash, is_valid_flag, reason);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_platform');
  END;

  IF is_valid_flag THEN
    UPDATE public.game_sessions
       SET platforms_passed=platforms_passed+1, validated_platforms_passed=validated_platforms_passed+1, last_platform_at=now()
     WHERE id = s.id;
  ELSE
    UPDATE public.game_sessions
       SET platforms_passed=platforms_passed+1, anti_fraud_score=anti_fraud_score+1, last_platform_at=now()
     WHERE id = s.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'valid', is_valid_flag, 'invalid_reason', reason);
END $$;

-- 3) helix_create_demo_session — inicia partida para conta demo consumindo
--    demo_balance como crédito (sem depósito real).
CREATE OR REPLACE FUNCTION public.helix_create_demo_session(
  _amount numeric,
  _theme_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p record;
  amt_cents integer;
  payout integer;
  new_id uuid;
  expires timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  amt_cents := ROUND(_amount * 100)::int;
  payout := public.helix_payout_cents(amt_cents);
  IF payout IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;
  IF NOT COALESCE(p.is_demo, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_demo_account');
  END IF;
  IF COALESCE(p.demo_balance, 0) < _amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_demo_balance');
  END IF;

  -- Bloqueia partidas demo simultâneas ativas.
  IF EXISTS (
    SELECT 1 FROM public.game_sessions
     WHERE user_id = uid
       AND deposit_id IS NULL
       AND status IN ('active','started')
       AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demo_session_already_active');
  END IF;

  expires := now() + interval '30 minutes';
  INSERT INTO public.game_sessions(
    user_id, theme_id, status, deposit_id,
    payout_per_platform_cents, demo_stake_cents,
    expires_at, idempotency_key
  ) VALUES (
    uid, _theme_id, 'active', NULL,
    payout, amt_cents,
    expires, 'helix_demo_session:' || uid::text || ':' || extract(epoch from now())::bigint::text
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', new_id,
    'is_demo', true,
    'payout_per_platform_cents', payout,
    'deposit_amount_cents', amt_cents,
    'expires_at', expires
  );
END $$;

REVOKE ALL ON FUNCTION public.helix_create_demo_session(numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_create_demo_session(numeric, uuid) TO authenticated;

-- 4) helix_finish_session — usar demo_stake_cents quando não há deposit_id.
CREATE OR REPLACE FUNCTION public.helix_finish_session(_session_id uuid, _reason text DEFAULT 'player_finished'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT ROUND(amount * 100)::int, amount::numeric(14,2)
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
      'DEMO — não sacável — ' || CASE WHEN is_gameover THEN 'perda' WHEN reward_c > 0 THEN 'recompensa demo R$ ' || to_char(reward_reais, 'FM999999990.00') ELSE 'sem recompensa' END
    );
    new_bal := bal_before;
  ELSE
    IF is_gameover THEN
      new_bal := 0::numeric(14,2);
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
        WHEN is_gameover AND actual_delta = 0 THEN 'Game over Helix - saldo já estava zerado'
        WHEN is_gameover THEN 'Perda Helix - saldo zerado (R$ ' || to_char(-actual_delta, 'FM999999990.00') || ')'
        WHEN reward_c > 0 THEN 'Partida Helix finalizada - entrada consumida e recompensa de R$ ' || to_char(reward_reais, 'FM999999990.00')
        ELSE 'Partida Helix finalizada - entrada consumida sem recompensa'
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
    UPDATE public.deposits SET updated_at = now() WHERE id = s.deposit_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', s.id,
    'is_demo', is_demo,
    'deposit_amount_cents', dep_amt_cents,
    'payout_per_platform_cents', s.payout_per_platform_cents,
    'validated_platforms_passed', validated,
    'reward_cents', reward_c,
    'new_balance', new_bal,
    'new_demo_balance', COALESCE(new_demo_bal, demo_before),
    'lost', is_gameover
  );
END $$;

REVOKE ALL ON FUNCTION public.helix_finish_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_finish_session(uuid, text) TO authenticated, service_role;
