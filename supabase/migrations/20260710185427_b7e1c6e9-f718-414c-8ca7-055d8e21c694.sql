
REVOKE ALL ON FUNCTION public.test_helix_flow() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_helix_flow() TO service_role;

REVOKE ALL ON FUNCTION public.helix_create_session(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_create_session(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.helix_finish_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_finish_session(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.helix_payout_cents(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_payout_cents(integer) TO authenticated, service_role;
