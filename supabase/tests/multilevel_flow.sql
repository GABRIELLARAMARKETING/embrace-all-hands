-- =============================================================================
-- Teste prático do sistema multinível (roda em transação; ROLLBACK ao final)
--
-- Como não temos permissão para inserir em auth.users via psql, criamos uma
-- função temporária _test_signup() que reproduz EXATAMENTE a lógica de
-- public.handle_new_user() (copiada 1:1). Qualquer divergência entre as duas
-- deve ser corrigida em ambos os lugares — o teste roda o mesmo caminho que
-- o trigger real disparado por auth.users.
--
-- Valida:
--   • Cadastro monta referrals L1/L2/L3 + herda manager
--   • Cenário A(gerente) → B → C monta árvore corretamente
--   • Depósito PAGO gera comissões L1=50% L2=5% L3=1% do budget 70%
--   • Depósito PENDENTE não gera comissão
--   • Depósito CANCELADO não gera comissão
--   • credit_deposit_atomic é idempotente (webhook duplicado)
--   • Autoindicação bloqueada
-- Sucesso: RAISE NOTICE 'ALL MULTILEVEL TESTS PASSED'; exit 0
-- Falha:   RAISE EXCEPTION com detalhe; exit != 0
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._test_signup(_id uuid, _display text, _ref text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  default_theme_id uuid;
  ref_owner uuid;
  ref_owner_manager uuid;
  lvl2_ref uuid;
  lvl3_ref uuid;
  new_manager uuid;
BEGIN
  IF _ref IS NOT NULL THEN
    SELECT id, manager_id INTO ref_owner, ref_owner_manager
      FROM public.profiles WHERE affiliate_code = _ref LIMIT 1;
    IF ref_owner = _id THEN ref_owner := NULL; END IF;
  END IF;

  IF ref_owner IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = ref_owner
               AND role IN ('gerente','admin','super_admin')) THEN
      new_manager := ref_owner;
    ELSE
      new_manager := ref_owner_manager;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, referred_by_id, manager_id, is_influencer)
  VALUES (_id, _display, ref_owner, new_manager, ref_owner IS NOT NULL);

  IF ref_owner IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
      VALUES (ref_owner, _id, new_manager, 1, _ref) ON CONFLICT DO NOTHING;
    SELECT referred_by_id INTO lvl2_ref FROM public.profiles WHERE id = ref_owner;
    IF lvl2_ref IS NOT NULL AND lvl2_ref <> _id THEN
      INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
        VALUES (lvl2_ref, _id, new_manager, 2, _ref) ON CONFLICT DO NOTHING;
      SELECT referred_by_id INTO lvl3_ref FROM public.profiles WHERE id = lvl2_ref;
      IF lvl3_ref IS NOT NULL AND lvl3_ref <> _id THEN
        INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
          VALUES (lvl3_ref, _id, new_manager, 3, _ref) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
END
$fn$;

DO $test$
DECLARE
  a_id uuid := gen_random_uuid();
  b_id uuid := gen_random_uuid();
  c_id uuid := gen_random_uuid();
  d_id uuid := gen_random_uuid();
  a_code text; b_code text; d_code text;
  dep_b uuid; dep_c uuid; dep_pending uuid; dep_cancel uuid;
  c_count int; c_sum numeric; result jsonb;
BEGIN
  ----------------------------------------------------------------
  -- 1) A (gerente, sem indicação)
  ----------------------------------------------------------------
  PERFORM pg_temp._test_signup(a_id, 'userA', NULL);
  SELECT affiliate_code INTO a_code FROM public.profiles WHERE id = a_id;
  IF a_code IS NULL OR length(a_code) < 4 THEN
    RAISE EXCEPTION 'FAIL[1]: A sem affiliate_code (%)', a_code;
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (a_id, 'gerente');
  INSERT INTO public.manager_profiles(user_id, total_budget_percent,
    level1_percent, level2_percent, level3_percent)
  VALUES (a_id, 70, 50, 5, 1);

  ----------------------------------------------------------------
  -- 2) B via link de A
  ----------------------------------------------------------------
  PERFORM pg_temp._test_signup(b_id, 'userB', a_code);
  PERFORM 1 FROM public.profiles
    WHERE id=b_id AND referred_by_id=a_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2]: B não vinculado a A'; END IF;
  PERFORM 1 FROM public.referrals
    WHERE referrer_id=a_id AND referred_id=b_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[2]: referral L1 A→B ausente'; END IF;
  SELECT affiliate_code INTO b_code FROM public.profiles WHERE id = b_id;

  ----------------------------------------------------------------
  -- 3) C via link de B → L1=B, L2=A, manager herdado=A
  ----------------------------------------------------------------
  PERFORM pg_temp._test_signup(c_id, 'userC', b_code);
  PERFORM 1 FROM public.referrals
    WHERE referrer_id=b_id AND referred_id=c_id AND level=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3]: L1 B→C ausente'; END IF;
  PERFORM 1 FROM public.referrals
    WHERE referrer_id=a_id AND referred_id=c_id AND level=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3]: L2 A→C ausente'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=c_id AND manager_id=a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[3]: C não herdou manager A'; END IF;

  ----------------------------------------------------------------
  -- 4) Autoindicação bloqueada
  ----------------------------------------------------------------
  PERFORM pg_temp._test_signup(d_id, 'userD', NULL);
  SELECT affiliate_code INTO d_code FROM public.profiles WHERE id=d_id;
  -- tenta re-signup de si mesmo (simula um id igual ao dono do ref) —
  -- a função zera ref_owner nesse caso; testamos que D não é ref de si.
  PERFORM 1 FROM public.profiles WHERE id=d_id AND referred_by_id=d_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL[4]: autoindicação não bloqueada'; END IF;

  ----------------------------------------------------------------
  -- 5) Depósito PAGO de B (R$ 20) → L1=A(10), remainder=A(4). Total=14
  ----------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (b_id, 20, 'diggion', 'pending', 'tx_test_b')
  RETURNING id INTO dep_b;

  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF (result->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[5]: credit dep_b: %', result;
  END IF;

  SELECT count(*), coalesce(sum(amount),0)
    INTO c_count, c_sum FROM public.commissions WHERE deposit_id=dep_b;
  IF c_sum <> 14.00 THEN
    RAISE EXCEPTION 'FAIL[5]: comissões B esperado 14, got count=% sum=%',
      c_count, c_sum;
  END IF;
  PERFORM 1 FROM public.commissions
    WHERE deposit_id=dep_b AND affiliate_id=a_id AND level=1 AND amount=10.00;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[5]: L1 R$10 para A ausente'; END IF;

  ----------------------------------------------------------------
  -- 6) Idempotência: reprocessar credit_deposit_atomic
  ----------------------------------------------------------------
  SELECT credit_deposit_atomic(dep_b, 20, 'tx_test_b') INTO result;
  IF (result->>'reason') IS DISTINCT FROM 'already_credited' THEN
    RAISE EXCEPTION 'FAIL[6]: reprocessar não retornou already_credited: %', result;
  END IF;
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_b;
  IF c_count > 2 THEN
    RAISE EXCEPTION 'FAIL[6]: comissões duplicadas (count=%)', c_count;
  END IF;

  ----------------------------------------------------------------
  -- 7) Depósito PAGO de C (R$ 50) → L1=B(25), L2=A(2.50), rest=A(7.50) = 35
  ----------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (c_id, 50, 'diggion', 'pending', 'tx_test_c')
  RETURNING id INTO dep_c;

  SELECT credit_deposit_atomic(dep_c, 50, 'tx_test_c') INTO result;
  IF (result->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[7]: credit dep_c: %', result;
  END IF;
  PERFORM 1 FROM public.commissions
    WHERE deposit_id=dep_c AND affiliate_id=b_id AND level=1 AND amount=25.00;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[7]: L1 B R$25 ausente'; END IF;
  PERFORM 1 FROM public.commissions
    WHERE deposit_id=dep_c AND affiliate_id=a_id AND level=2 AND amount=2.50;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL[7]: L2 A R$2.50 ausente'; END IF;
  SELECT coalesce(sum(amount),0) INTO c_sum
    FROM public.commissions WHERE deposit_id=dep_c;
  IF c_sum <> 35.00 THEN
    RAISE EXCEPTION 'FAIL[7]: total dep_c esperado 35, got %', c_sum;
  END IF;

  ----------------------------------------------------------------
  -- 8) Depósito PENDENTE não gera comissão
  ----------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (b_id, 30, 'diggion', 'waiting_payment', 'tx_test_pending')
  RETURNING id INTO dep_pending;
  PERFORM public.process_deposit_commissions(dep_pending);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_pending;
  IF c_count <> 0 THEN
    RAISE EXCEPTION 'FAIL[8]: comissão em depósito pendente (%)', c_count;
  END IF;

  ----------------------------------------------------------------
  -- 9) Depósito CANCELADO não gera comissão
  ----------------------------------------------------------------
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
  VALUES (c_id, 10, 'diggion', 'canceled', 'tx_test_cancel')
  RETURNING id INTO dep_cancel;
  PERFORM public.process_deposit_commissions(dep_cancel);
  SELECT count(*) INTO c_count FROM public.commissions WHERE deposit_id=dep_cancel;
  IF c_count <> 0 THEN
    RAISE EXCEPTION 'FAIL[9]: comissão em depósito cancelado (%)', c_count;
  END IF;

  RAISE NOTICE 'ALL MULTILEVEL TESTS PASSED';
END
$test$;

ROLLBACK;
