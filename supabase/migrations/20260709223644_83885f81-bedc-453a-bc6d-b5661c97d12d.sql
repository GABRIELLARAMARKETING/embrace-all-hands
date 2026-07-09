
-- Revoke public execute on internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.process_deposit_commissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_deposit_atomic(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_affiliate_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_financials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_manager_budget() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains execute
GRANT EXECUTE ON FUNCTION public.process_deposit_commissions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_deposit_atomic(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_affiliate_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_affiliate_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_financials() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_manager_budget() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

-- has_role / is_admin are used by RLS policies; keep executable by authenticated only, not anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
