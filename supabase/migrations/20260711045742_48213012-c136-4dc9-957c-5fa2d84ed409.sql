DO $$
BEGIN
  ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'spent';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;