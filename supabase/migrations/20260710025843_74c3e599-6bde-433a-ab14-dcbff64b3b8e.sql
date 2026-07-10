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
  ALTER TABLE public.profiles      DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.profiles      DROP CONSTRAINT IF EXISTS profiles_referred_by_id_fkey;
  ALTER TABLE public.profiles      DROP CONSTRAINT IF EXISTS profiles_manager_id_fkey;
  ALTER TABLE public.user_roles    DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
  ALTER TABLE public.manager_profiles DROP CONSTRAINT IF EXISTS manager_profiles_user_id_fkey;
  ALTER TABLE public.deposits      DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
  ALTER TABLE public.referrals     DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;
  ALTER TABLE public.referrals     DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;
  ALTER TABLE public.referrals     DROP CONSTRAINT IF EXISTS referrals_manager_id_fkey;
  ALTER TABLE public.commissions   DROP CONSTRAINT IF EXISTS commissions_affiliate_id_fkey;
  ALTER TABLE public.commissions   DROP CONSTRAINT IF EXISTS commissions_manager_id_fkey;
  ALTER TABLE public.commissions   DROP CONSTRAINT IF EXISTS commissions_source_user_id_fkey;
  ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

  PERFORM public._test_signup(a_id, 'test_userA', NULL);
  SELECT affiliate_code INTO a_code FROM public.profiles WHERE id=a_id;
  IF a_code IS NULL THEN RAISE EXCEPTION 'FAIL[1] sem affiliate_code'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (a_id, 'gerente');
  INSERT INTO public.manager_profiles(user_id, total_budget_percent, level1_percent, level2_percent, level3_percent)
    VALUES (a_id, 70, 50, 5, 1);

  PERFORM public._test_signup(b_id, 'test_userB', a_code);
  PERFORM 1 FROM public.profiles WHERE id=b_id AND referred_by_id=a_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2] B nao vinculado a A'; END IF;
  PERFORM 1 FROM public.referrals WHERE referrer_id=a_id AND referred_id=b_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2] referral L1 A->B ausente'; END IF;
  SELECT affiliate_code INTO b_code FROM public.profiles WHERE id=b_id;

  PERFORM public._test_signup(c_id, 'test_userC', b_code);
  PERFORM 1 FROM public.referrals WHERE referrer_id=b_id AND referred_id=c_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3] L1 B->C ausente'; END IF;
  PERFORM 1 FROM public.referrals WHERE referrer_id=a_id AND referred_id=c_id AND level=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3] L2 A->C ausente'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=c_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3] C nao herdou manager A'; END IF;

  PERFORM public._test_signup(d_id, 'test_userD', NULL);
  PERFORM 1 FROM public.profiles WHERE id=d_id AND referred_by_id=d_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL[4] autoindicacao'; END IF;

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

  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF result->>'reason' <> 'already_credited' THEN
    RAISE EXCEPTION 'FAIL[6] reprocess nao idempotente: %', result;
  END IF;
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_b;
  IF c_count > 2 THEN RAISE EXCEPTION 'FAIL[6] comissoes duplicadas (%)', c_count; END IF;

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

  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (b_id, 30, 'diggion', 'waiting_payment', 'tx_test_pend') RETURNING id INTO dep_pending;
  PERFORM public.process_deposit_commissions(dep_pending);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_pending;
  IF c_count <> 0 THEN RAISE EXCEPTION 'FAIL[8] comissao em pendente (%)', c_count; END IF;

  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (c_id, 10, 'diggion', 'canceled', 'tx_test_cancel') RETURNING id INTO dep_cancel;
  PERFORM public.process_deposit_commissions(dep_cancel);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_cancel;
  IF c_count <> 0 THEN RAISE EXCEPTION 'FAIL[9] comissao em cancelado (%)', c_count; END IF;

  RETURN 'ALL MULTILEVEL TESTS PASSED';
END
$fn$;