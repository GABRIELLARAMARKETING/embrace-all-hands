DROP POLICY IF EXISTS "anon insert click" ON public.referral_clicks;
REVOKE INSERT ON public.referral_clicks FROM anon;