
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
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  FOR s IN
    SELECT id FROM public.game_sessions
     WHERE user_id = uid
       AND credited_at IS NULL
       AND status IN ('active','started')
       AND deposit_id IS NOT NULL
       AND created_at < now() - make_interval(secs => _grace_seconds)
  LOOP
    PERFORM public.helix_finish_session(s.id, 'player_lost');
    abandoned := abandoned + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'abandoned', abandoned);
END $$;

GRANT EXECUTE ON FUNCTION public.helix_abandon_active_sessions(int) TO authenticated;
