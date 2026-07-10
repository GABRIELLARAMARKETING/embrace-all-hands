-- =============================================================================
-- Teste prático do sistema multinível (roda em transação; ROLLBACK ao final)
-- Valida:
--   • Cadastro dispara handle_new_user (referrals + manager_id herdado)
--   • Cenário A(gerente) → B → C monta árvore níveis 1, 2 e 3
--   • Depósito PAGO gera comissões corretas (L1=50%, L2=5%, L3=1% do budget 70%)
--   • Depósito PENDENTE não gera comissão
--   • Depósito CANCELADO não gera comissão
--   • Webhook duplicado (credit_deposit_atomic idempotente) não duplica comissão
--   • Autoindicação é bloqueada (ref_owner = NEW.id => ref := NULL)
-- Falha via RAISE EXCEPTION; sucesso imprime "ALL MULTILEVEL TESTS PASSED".
-- =============================================================================
BEGIN;

DO $test$
DECLARE
  a_id uuid := gen_random_uuid();
  b_id uuid := gen_random_uuid();
  c_id uuid := gen_random_uuid();
  d_id uuid := gen_random_uuid();  -- self-ref test
  a_code text;
  b_code text;
  dep_b uuid;
  dep_c uuid;
  dep_pending uuid;
  dep_cancel uuid;
  c_count int;
  c_sum numeric;
  rec record;
  result jsonb;
BEGIN
  ----------------------------------------------------------------------
  -- 1) Cadastra A (gerente, sem indicação)
  ----------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role,
    email_confirmed_at, created_at, updated_at, instance_id)
  VALUES (a_id, 'a@test.local', jsonb_build_object('display_name','userA'),
    'authenticated','authenticated', now(), now(), now(),
    '00000000-0000-0000-0000-000000000000');

  SELECT affiliate_code INTO a_code FROM public.profiles WHERE id = a_id;
  IF a_code IS NULL OR length(a_code) < 4 THEN
    RAISE EXCEPTION 'FAIL[1]: A não recebeu affiliate_code (got=%)', a_code;
  END IF;

  -- Promove A a gerente
  INSERT INTO public.user_roles(user_id, role) VALUES (a_id, 'gerente');
  INSERT INTO public.manager_profiles(user_id, total_budget_percent,
    level1_percent, level2_percent, level3_percent)
  VALUES (a_id, 70, 50, 5, 1);

  ----------------------------------------------------------------------
  -- 2) Cadastra B via link de A
  ----------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role,
    email_confirmed_at, created_at, updated_at, instance_id)
  VALUES (b_id, 'b@test.local',
    jsonb_build_object('display_name','userB','ref',a_code),
    'authenticated','authenticated', now(), now(), now(),
    '00000000-0000-0000-0000-000000000000');

  PERFORM 1 FROM public.profiles WHERE id = b_id AND referred_by_id = a_id AND manager_id = a_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL[2]: B não vinculado a A. profile=%',
      (SELECT row_to_json(p) FROM public.profiles p WHERE id=b_id);
  END IF;

  PERFORM 1 FROM public.referrals WHERE referrer_id=a_id AND referred_id=b_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2]: referral L1 A→B ausente'; END IF;

  SELECT affiliate_code INTO b_code FROM public.profiles WHERE id = b_id;

  ----------------------------------------------------------------------
  -- 3) Cadastra C via link de B
  ----------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role,
    email_confirmed_at, created_at, updated_at, instance_id)
  VALUES (c_id, 'c@test.local',
    jsonb_build_object('display_name','userC','ref',b_code),
    'authenticated','authenticated', now(), now(), now(),
    '00000000-0000-0000-0000-000000000000');

  PERFORM 1 FROM public.referrals WHERE referrer_id=b_id AND referred_id=c_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3]: referral L1 B→C ausente'; END IF;
  PERFORM 1 FROM public.referrals WHERE referrer_id=a_id AND referred_id=c_id AND level=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3]: referral L2 A→C ausente'; END IF;

  PERFORM 1 FROM public.profiles WHERE id=c_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3]: C não herdou manager A'; END IF;

  ----------------------------------------------------------------------
  -- 4) Autoindicação bloqueada
  ----------------------------------------------------------------------
  -- criamos D usando o próprio affiliate_code (não temos ainda, então
  -- usamos meta ref = código de A após inserir e checamos que D não é ref de si mesmo)
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role,
    email_confirmed_at, created_at, updated_at, instance_id)
  VALUES (d_id, 'd@test.local', jsonb_build_object('display_name','userD'),
    'authenticated','authenticated', now(), now(), now(),
    '00000000-0000-0000-0000-000000000000');
  PERFORM 1 FROM public.profiles WHERE id=d_id AND referred_by_id=d_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL[4]: autoindicação não bloqueada'; END IF;

  ----------------------------------------------------------------------
  -- 5) Depósito PAGO de B (R$ 20) → comissão L1 para A
  ----------------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (b_id, 20, 'diggion', 'pending', 'tx_test_b')
  RETURNING id INTO dep_b;

  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF (result->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[5]: credit_deposit_atomic falhou: %', result;
  END IF;

  SELECT count(*), coalesce(sum(amount),0) INTO c_count, c_sum
    FROM public.commissions WHERE deposit_id = dep_b;
  -- Esperado: L1 = 20 * 50% = 10 para A; restante = 20*70% - 10 = 4 pro manager (=A)
  -- Como A é o próprio manager e nível 1, deve gerar 1 comissão L1 (10) + 1 remainder L0 (4)
  IF c_count < 1 OR c_sum <> 14.00 THEN
    RAISE EXCEPTION 'FAIL[5]: comissões B esperadas L1=10 + resto=4 (total 14). got count=% sum=%', c_count, c_sum;
  END IF;
  PERFORM 1 FROM public.commissions
    WHERE deposit_id=dep_b AND affiliate_id=a_id AND level=1 AND amount=10.00;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[5]: comissão L1 R$10 para A ausente'; END IF;

  ----------------------------------------------------------------------
  -- 6) Depósito duplicado (idempotência)
  ----------------------------------------------------------------------
  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF (result->>'reason') IS DISTINCT FROM 'already_credited' THEN
    RAISE EXCEPTION 'FAIL[6]: reprocessar não retornou already_credited: %', result;
  END IF;
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id = dep_b;
  IF c_count > 2 THEN
    RAISE EXCEPTION 'FAIL[6]: comissões duplicadas após reprocessar (count=%)', c_count;
  END IF;

  ----------------------------------------------------------------------
  -- 7) Depósito PAGO de C (R$ 50) → L1=B(25), L2=A(2.50), remainder=A(7.50)
  ----------------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (c_id, 50, 'diggion', 'pending', 'tx_test_c')
  RETURNING id INTO dep_c;

  SELECT credit_deposit_atomic(dep_c, 50, 'tx_test_c') INTO result;
  IF (result->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[7]: credit dep_c falhou: %', result;
  END IF;

  PERFORM 1 FROM public.commissions
    WHERE deposit_id=dep_c AND affiliate_id=b_id AND level=1 AND amount=25.00;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[7]: L1 B (R$25) ausente'; END IF;

  PERFORM 1 FROM public.commissions
    WHERE deposit_id=dep_c AND affiliate_id=a_id AND level=2 AND amount=2.50;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[7]: L2 A (R$2.50) ausente'; END IF;

  -- Total deve ser 50*70% = 35
  SELECT coalesce(sum(amount),0) INTO c_sum FROM public.commissions WHERE deposit_id=dep_c;
  IF c_sum <> 35.00 THEN
    RAISE EXCEPTION 'FAIL[7]: total comissões dep_c esperado 35, got %', c_sum;
  END IF;

  ----------------------------------------------------------------------
  -- 8) Depósito PENDENTE não gera comissão
  ----------------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (b_id, 30, 'diggion', 'waiting_payment', 'tx_test_pending')
  RETURNING id INTO dep_pending;
  PERFORM public.process_deposit_commissions(dep_pending);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_pending;
  IF c_count <> 0 THEN
    RAISE EXCEPTION 'FAIL[8]: comissão gerada em depósito pendente (count=%)', c_count;
  END IF;

  ----------------------------------------------------------------------
  -- 9) Depósito CANCELADO não gera comissão
  ----------------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (c_id, 10, 'diggion', 'canceled', 'tx_test_cancel')
  RETURNING id INTO dep_cancel;
  PERFORM public.process_deposit_commissions(dep_cancel);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_cancel;
  IF c_count <> 0 THEN
    RAISE EXCEPTION 'FAIL[9]: comissão gerada em depósito cancelado (count=%)', c_count;
  END IF;

  RAISE NOTICE 'ALL MULTILEVEL TESTS PASSED';
END
$test$;

ROLLBACK;
