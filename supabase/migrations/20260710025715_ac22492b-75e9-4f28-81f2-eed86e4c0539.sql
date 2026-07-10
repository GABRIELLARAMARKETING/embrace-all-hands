-- Helper interno: replica handle_new_user() sem depender de trigger em auth.users
CREATE OR REPLACE FUNCTION public._test_signup(_id uuid, _display text, _ref text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_owner uuid; ref_owner_manager uuid; lvl2 uuid; lvl3 uuid; mgr uuid;
BEGIN
  IF _ref IS NOT NULL THEN
    SELECT id, manager_id INTO ref_owner, ref_owner_manager
      FROM public.profiles WHERE affiliate_code = _ref LIMIT 1;
    IF ref_owner = _id THEN ref_owner := NULL; END IF;
  END IF;
  IF ref_owner IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=ref_owner
               AND role IN ('gerente','admin','super_admin')) THEN
      mgr := ref_owner;
    ELSE mgr := ref_owner_manager; END IF;
  END IF;
  INSERT INTO public.profiles(id, display_name, referred_by_id, manager_id, is_influencer)
  VALUES (_id, _display, ref_owner, mgr, ref_owner IS NOT NULL);
  IF ref_owner IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
      VALUES (ref_owner, _id, mgr, 1, _ref) ON CONFLICT DO NOTHING;
    SELECT referred_by_id INTO lvl2 FROM public.profiles WHERE id=ref_owner;
    IF lvl2 IS NOT NULL AND lvl2 <> _id THEN
      INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
        VALUES (lvl2, _id, mgr, 2, _ref) ON CONFLICT DO NOTHING;
      SELECT referred_by_id INTO lvl3 FROM public.profiles WHERE id=lvl2;
      IF lvl3 IS NOT NULL AND lvl3 <> _id THEN
        INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
          VALUES (lvl3, _id, mgr, 3, _ref) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public._test_signup(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._test_signup(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.test_multilevel_flow()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  a_id uuid := gen_random_uuid();
  b_id uuid := gen_random_uuid();
  c_id uuid := gen_random_uuid();
  d_id uuid := gen_random_uuid();
  a_code text; b_code text;
  dep_b uuid; dep_c uuid; dep_pending uuid; dep_cancel uuid;
  c_count int; c_sum numeric; result jsonb;
BEGIN
  -- FK profiles→auth.users temporária (rollback restaura)
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

  -- [1] A gerente
  PERFORM public._test_signup(a_id, 'test_userA', NULL);
  SELECT affiliate_code INTO a_code FROM public.profiles WHERE id=a_id;
  IF a_code IS NULL THEN RAISE EXCEPTION 'FAIL[1] sem affiliate_code'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (a_id, 'gerente');
  INSERT INTO public.manager_profiles(user_id, total_budget_percent, level1_percent, level2_percent, level3_percent)
    VALUES (a_id, 70, 50, 5, 1);

  -- [2] B via link A
  PERFORM public._test_signup(b_id, 'test_userB', a_code);
  PERFORM 1 FROM public.profiles WHERE id=b_id AND referred_by_id=a_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2] B não vinculado a A'; END IF;
  PERFORM 1 FROM public.referrals WHERE referrer_id=a_id AND referred_id=b_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2] referral L1 A->B ausente'; END IF;
  SELECT affiliate_code INTO b_code FROM public.profiles WHERE id=b_id;

  -- [3] C via link B
  PERFORM public._test_signup(c_id, 'test_userC', b_code);
  PERFORM 1 FROM public.referrals WHERE referrer_id=b_id AND referred_id=c_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3] L1 B->C ausente'; END IF;
  PERFORM 1 FROM public.referrals WHERE referrer_id=a_id AND referred_id=c_id AND level=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3] L2 A->C ausente'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=c_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3] C não herdou manager A'; END IF;

  -- [4] Autoindicação
  PERFORM public._test_signup(d_id, 'test_userD', NULL);
  PERFORM 1 FROM public.profiles WHERE id=d_id AND referred_by_id=d_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL[4] autoindicação'; END IF;

  -- [5] Pago B R$20 -> L1 A R$10 + resto A R$4 = 14
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (b_id, 20, 'diggion', 'pending', 'tx_test_b') RETURNING id INTO dep_b;
  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF (result->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[5] credit dep_b: %', result;
  END IF;
  SELECT count(*), coalesce(sum(amount),0) INTO c_count, c_sum
    FROM public.commissions WHERE deposit_id=dep_b;
  IF c_sum <> 14.00 THEN RAISE EXCEPTION 'FAIL[5] esperado 14, got %', c_sum; END IF;
  PERFORM 1 FROM public.commissions WHERE deposit_id=dep_b
    AND affiliate_id=a_id AND level=1 AND amount=10.00;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[5] L1 A R$10 ausente'; END IF;

  -- [6] Idempotência
  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF result->>'reason' <> 'already_credited' THEN
    RAISE EXCEPTION 'FAIL[6] reprocess não idempotente: %', result;
  END IF;
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_b;
  IF c_count > 2 THEN RAISE EXCEPTION 'FAIL[6] comissões duplicadas (%)', c_count; END IF;

  -- [7] Pago C R$50 -> L1 B(25) + L2 A(2.50) + resto A(7.50) = 35
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (c_id, 50, 'diggion', 'pending', 'tx_test_c') RETURNING id INTO dep_c;
  SELECT credit_deposit_atomic(dep_c, 50, 'tx_test_c') INTO result;
  IF (result->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[7] credit dep_c: %', result;
  END IF;
  PERFORM 1 FROM public.commissions WHERE deposit_id=dep_c
    AND affiliate_id=b_id AND level=1 AND amount=25.00;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[7] L1 B R$25 ausente'; END IF;
  PERFORM 1 FROM public.commissions WHERE deposit_id=dep_c
    AND affiliate_id=a_id AND level=2 AND amount=2.50;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[7] L2 A R$2.50 ausente'; END IF;
  SELECT coalesce(sum(amount),0) INTO c_sum FROM public.commissions WHERE deposit_id=dep_c;
  IF c_sum <> 35.00 THEN RAISE EXCEPTION 'FAIL[7] total esperado 35, got %', c_sum; END IF;

  -- [8] Pendente sem comissão
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (b_id, 30, 'diggion', 'waiting_payment', 'tx_test_pend') RETURNING id INTO dep_pending;
  PERFORM public.process_deposit_commissions(dep_pending);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_pending;
  IF c_count <> 0 THEN RAISE EXCEPTION 'FAIL[8] comissão em pendente (%)', c_count; END IF;

  -- [9] Cancelado sem comissão
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (c_id, 10, 'diggion', 'canceled', 'tx_test_cancel') RETURNING id INTO dep_cancel;
  PERFORM public.process_deposit_commissions(dep_cancel);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_cancel;
  IF c_count <> 0 THEN RAISE EXCEPTION 'FAIL[9] comissão em cancelado (%)', c_count; END IF;

  RETURN 'ALL MULTILEVEL TESTS PASSED';
END
$fn$;

REVOKE ALL ON FUNCTION public.test_multilevel_flow() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_multilevel_flow() TO service_role;

COMMENT ON FUNCTION public.test_multilevel_flow() IS
'Suíte de auditoria multinível. Executar em BEGIN/ROLLBACK: BEGIN; SELECT test_multilevel_flow(); ROLLBACK;';