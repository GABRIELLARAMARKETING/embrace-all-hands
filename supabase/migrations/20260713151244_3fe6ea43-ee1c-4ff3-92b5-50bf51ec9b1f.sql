
CREATE OR REPLACE FUNCTION public.block_free_play_for_authenticated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authenticated non-demo users must always start a session tied to a paid deposit
  -- (demo sessions carry deposit_id IS NULL and demo_stake_cents > 0).
  IF auth.uid() IS NOT NULL
     AND NEW.deposit_id IS NULL
     AND COALESCE(NEW.demo_stake_cents, 0) <= 0 THEN
    RAISE EXCEPTION 'Authenticated users cannot start a free game session'
      USING ERRCODE = '42501';
  END IF;

  -- If a deposit is referenced, ensure it belongs to the same user and was credited.
  -- Accept paid/approved/spent: once credited, the deposit is a valid "reference"
  -- while the wallet still has balance. The wallet balance check lives in
  -- helix_create_session and credit_deposit_atomic; do NOT enforce single-use here.
  IF NEW.deposit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.deposits d
      WHERE d.id = NEW.deposit_id
        AND d.user_id = NEW.user_id
        AND d.status IN ('paid','approved','spent')
        AND d.credited_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Deposit is not valid for this user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
