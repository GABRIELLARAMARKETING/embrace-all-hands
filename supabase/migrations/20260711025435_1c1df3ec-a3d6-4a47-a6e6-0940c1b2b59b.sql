CREATE OR REPLACE FUNCTION public.block_free_play_for_authenticated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authenticated users must always start a session tied to a paid deposit.
  -- Free-play sessions (deposit_id IS NULL) are only allowed for anonymous visitors.
  IF auth.uid() IS NOT NULL AND NEW.deposit_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated users cannot start a free game session'
      USING ERRCODE = '42501';
  END IF;

  -- If a deposit is referenced, ensure it belongs to the same user and is paid,
  -- and that it has not already been consumed by another session.
  IF NEW.deposit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.deposits d
      WHERE d.id = NEW.deposit_id
        AND d.user_id = NEW.user_id
        AND d.status = 'paid'
    ) THEN
      RAISE EXCEPTION 'Deposit is not valid for this user'
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.deposit_id = NEW.deposit_id
        AND gs.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Deposit already used in another session'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_free_play_for_authenticated ON public.game_sessions;
CREATE TRIGGER enforce_no_free_play_for_authenticated
BEFORE INSERT ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.block_free_play_for_authenticated();