ALTER TABLE public.affiliate_withdrawals REPLICA IDENTITY FULL;
ALTER TABLE public.risk_alerts REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_withdrawals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_alerts; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;