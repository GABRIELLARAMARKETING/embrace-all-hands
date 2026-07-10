
-- Permitir 'game_reward' em wallet_transactions.type
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY['deposit','withdraw','commission','adjustment','refund','game_reward']));

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_per_platform_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platforms_passed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_platforms_passed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS credited_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS anti_fraud_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_platform_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_deposit_uidx
  ON public.game_sessions(deposit_id) WHERE deposit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_idem_uidx
  ON public.game_sessions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.helix_platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform_index integer NOT NULL,
  client_timestamp bigint,
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  delta_time_ms integer,
  event_hash text,
  is_valid boolean NOT NULL DEFAULT true,
  invalid_reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, platform_index)
);
CREATE INDEX IF NOT EXISTS helix_events_session_idx ON public.helix_platform_events(session_id);
CREATE INDEX IF NOT EXISTS helix_events_user_idx ON public.helix_platform_events(user_id);

GRANT SELECT ON public.helix_platform_events TO authenticated;
GRANT ALL ON public.helix_platform_events TO service_role;

ALTER TABLE public.helix_platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "helix_events_owner_read" ON public.helix_platform_events;
CREATE POLICY "helix_events_owner_read" ON public.helix_platform_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "helix_events_admin_read" ON public.helix_platform_events;
CREATE POLICY "helix_events_admin_read" ON public.helix_platform_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.helix_payout_cents(_amount_cents integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE _amount_cents
    WHEN 500 THEN 50 WHEN 1000 THEN 100 WHEN 2000 THEN 200
    WHEN 3000 THEN 300 WHEN 5000 THEN 500 WHEN 10000 THEN 1000
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.helix_create_session(_deposit_id uuid, _theme_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid(); d record; payout integer;
  existing uuid; new_id uuid; expires timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found'); END IF;
  IF d.user_id <> uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  IF d.status NOT IN ('paid','approved') THEN RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_paid'); END IF;
  payout := public.helix_payout_cents(ROUND(d.amount * 100)::int);
  IF payout IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount'); END IF;
  SELECT id INTO existing FROM public.game_sessions WHERE deposit_id = d.id LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deposit_already_used', 'session_id', existing);
  END IF;
  expires := now() + interval '30 minutes';
  INSERT INTO public.game_sessions(user_id, theme_id, status, deposit_id, payout_per_platform_cents, expires_at, idempotency_key)
    VALUES (uid, _theme_id, 'active', d.id, payout, expires, 'helix_session:' || d.id::text)
    RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'session_id', new_id,
    'payout_per_platform_cents', payout,
    'deposit_amount_cents', ROUND(d.amount * 100)::int,
    'expires_at', expires);
END $$;

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
  IF s.deposit_id IS NULL OR s.payout_per_platform_cents <= 0 THEN
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

CREATE OR REPLACE FUNCTION public.helix_finish_session(_session_id uuid, _reason text DEFAULT 'player_finished')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid(); s record; p record;
  validated int; reward_c int; reward_reais numeric(14,2);
  new_bal numeric(14,2); dep_amt_cents int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id = _session_id FOR UPDATE;
  IF s IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found'); END IF;
  IF s.user_id <> uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  IF s.credited_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_finished',
      'session_id', s.id, 'validated_platforms_passed', s.validated_platforms_passed, 'reward_cents', s.reward_cents);
  END IF;

  SELECT COUNT(*) INTO validated FROM public.helix_platform_events e
    WHERE e.session_id = s.id AND e.is_valid = true;

  reward_c := CASE WHEN s.payout_per_platform_cents > 0 AND validated > 0 THEN validated * s.payout_per_platform_cents ELSE 0 END;
  reward_reais := (reward_c / 100.0)::numeric(14,2);

  IF reward_c > 0 THEN
    SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
    IF p IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found'); END IF;
    new_bal := COALESCE(p.balance,0) + reward_reais;
    UPDATE public.profiles SET balance = new_bal, updated_at = now() WHERE id = uid;
    INSERT INTO public.wallet_transactions(user_id, deposit_id, type, amount, balance_before, balance_after, description)
      VALUES (uid, s.deposit_id, 'game_reward', reward_reais, COALESCE(p.balance,0), new_bal,
        'Recompensa Helix - ' || validated || ' plataformas');
  END IF;

  UPDATE public.game_sessions
     SET status = CASE WHEN _reason = 'player_lost' THEN 'gameover' ELSE 'finished' END,
         validated_platforms_passed = validated,
         reward_cents = reward_c, credited_at = now(), finished_at = now()
   WHERE id = s.id;

  SELECT ROUND(amount * 100)::int INTO dep_amt_cents FROM public.deposits WHERE id = s.deposit_id;

  RETURN jsonb_build_object('ok', true, 'session_id', s.id,
    'deposit_amount_cents', dep_amt_cents,
    'payout_per_platform_cents', s.payout_per_platform_cents,
    'validated_platforms_passed', validated,
    'reward_cents', reward_c, 'new_balance', new_bal);
END $$;

CREATE OR REPLACE FUNCTION public.test_helix_flow()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := gen_random_uuid();
  dep_id uuid; sess_id uuid;
  balance_before numeric; balance_after numeric;
  amt int; payout int;
  cases int[][] := ARRAY[[500,50],[1000,100],[2000,200],[3000,300],[5000,500],[10000,1000]];
  i int; validated int; reward_c int;
  p record; new_bal numeric(14,2);
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
  ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_user_id_fkey;
  ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

  INSERT INTO public.profiles(id, display_name, balance) VALUES (uid, 'test_helix', 0);

  FOR i IN 1..array_length(cases,1) LOOP
    amt := cases[i][1]; payout := cases[i][2];
    IF public.helix_payout_cents(amt) <> payout THEN
      RAISE EXCEPTION 'FAIL[payout] amt=% esperado=% got=%', amt, payout, public.helix_payout_cents(amt);
    END IF;
  END LOOP;

  IF public.helix_payout_cents(777) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL[unsupported] deveria retornar NULL';
  END IF;

  INSERT INTO public.deposits(user_id, amount, provider, status, external_id, credited_at, paid_at)
    VALUES (uid, 20, 'diggion', 'paid', 'helix_tx_1', now(), now())
    RETURNING id INTO dep_id;

  INSERT INTO public.game_sessions(user_id, status, deposit_id, payout_per_platform_cents, expires_at, idempotency_key)
    VALUES (uid, 'active', dep_id, 200, now() + interval '30 minutes', 'helix_session:'||dep_id)
    RETURNING id INTO sess_id;

  BEGIN
    INSERT INTO public.game_sessions(user_id, status, deposit_id, payout_per_platform_cents, expires_at)
      VALUES (uid, 'active', dep_id, 200, now() + interval '30 minutes');
    RAISE EXCEPTION 'FAIL: permitiu 2 sessoes pro mesmo deposito';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  FOR i IN 1..5 LOOP
    INSERT INTO public.helix_platform_events(session_id, user_id, platform_index, is_valid)
      VALUES (sess_id, uid, i, true);
  END LOOP;

  BEGIN
    INSERT INTO public.helix_platform_events(session_id, user_id, platform_index, is_valid)
      VALUES (sess_id, uid, 3, true);
    RAISE EXCEPTION 'FAIL: permitiu plataforma repetida';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  SELECT balance INTO balance_before FROM public.profiles WHERE id = uid;

  SELECT COUNT(*) INTO validated FROM public.helix_platform_events e
    WHERE e.session_id = sess_id AND e.is_valid = true;
  reward_c := validated * 200;

  IF validated <> 5 THEN RAISE EXCEPTION 'FAIL[validated] got=%', validated; END IF;
  IF reward_c <> 1000 THEN RAISE EXCEPTION 'FAIL[reward] got=%', reward_c; END IF;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  new_bal := COALESCE(p.balance,0) + (reward_c/100.0)::numeric(14,2);
  UPDATE public.profiles SET balance = new_bal WHERE id = uid;
  INSERT INTO public.wallet_transactions(user_id, deposit_id, type, amount, balance_before, balance_after, description)
    VALUES (uid, dep_id, 'game_reward', (reward_c/100.0)::numeric(14,2),
            COALESCE(p.balance,0), new_bal, 'test_helix');
  UPDATE public.game_sessions
     SET status='finished', validated_platforms_passed=validated,
         reward_cents=reward_c, credited_at=now(), finished_at=now()
   WHERE id = sess_id;

  SELECT balance INTO balance_after FROM public.profiles WHERE id = uid;
  IF (balance_after - balance_before) <> 10.00 THEN
    RAISE EXCEPTION 'FAIL[saldo] delta=% esperado=10.00', (balance_after - balance_before);
  END IF;

  IF (SELECT credited_at FROM public.game_sessions WHERE id = sess_id) IS NULL THEN
    RAISE EXCEPTION 'FAIL[idempotency] credited_at nulo';
  END IF;

  DELETE FROM public.wallet_transactions WHERE user_id = uid;
  DELETE FROM public.helix_platform_events WHERE user_id = uid;
  DELETE FROM public.game_sessions WHERE user_id = uid;
  DELETE FROM public.deposits WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;

  RETURN 'ALL HELIX TESTS PASSED (payouts + sequencia + idempotencia + ledger)';
END $$;

DO $$
DECLARE r text;
BEGIN
  r := public.test_helix_flow();
  RAISE NOTICE '%', r;
END $$;
