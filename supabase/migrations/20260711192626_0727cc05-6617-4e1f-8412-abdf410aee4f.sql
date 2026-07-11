
REVOKE EXECUTE ON FUNCTION public._test_signup(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_helix_flow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_multilevel_flow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_demo_account_isolation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_payments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_invite_codes() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_demo_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.manager_credit_demo_balance(uuid, numeric, text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.helix_create_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.helix_create_demo_session(numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.helix_finish_session(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.helix_abandon_active_sessions(integer) FROM PUBLIC, anon;
