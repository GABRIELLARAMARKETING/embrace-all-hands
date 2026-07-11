CREATE OR REPLACE FUNCTION public.helix_register_platform(
  _session_id uuid,
  _platform_index integer,
  _client_ts bigint DEFAULT NULL,
  _event_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    is_valid_flag := false;
    reason := 'out_of_sequence_or_repeat';
  ELSIF last_idx IS NOT NULL AND _platform_index > last_idx + 5 THEN
    is_valid_flag := false;
    reason := 'impossible_jump';
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
  END IF;

  RETURN jsonb_build_object('ok', true, 'valid', is_valid_flag, 'invalid_reason', reason);
END $$;

REVOKE ALL ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text) TO authenticated, service_role;