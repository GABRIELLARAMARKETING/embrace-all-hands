-- Test: contas demo criadas pelo gerente NÃO devem
--   1) gerar deposits
--   2) gerar affiliate_withdrawals
--   3) mover wallet_transactions "reais" (só demo_*),
--      e nunca mexer em profiles.balance.
--
-- Execução: rodar dentro de BEGIN ... ROLLBACK (ver scripts/test-demo-isolation.sh)
DO $$
DECLARE
  mgr_id  uuid := gen_random_uuid();
  demo_id uuid := gen_random_uuid();
  cnt int;
  real_bal numeric(14,2);
  demo_bal numeric(14,2);
  res jsonb;
BEGIN
  -- Solta FKs pra usar uuids sintéticos (mesmo padrão dos outros tests)
  ALTER TABLE public.profiles      DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.profiles      DROP CONSTRAINT IF EXISTS profiles_manager_id_fkey;
  ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
  ALTER TABLE public.deposits      DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
  ALTER TABLE public.affiliate_withdrawals DROP CONSTRAINT IF EXISTS affiliate_withdrawals_user_id_fkey;
  ALTER TABLE public.user_roles    DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

  -- Gerente
  INSERT INTO public.profiles(id, display_name) VALUES (mgr_id, 'test_mgr_demo');
  INSERT INTO public.user_roles(user_id, role) VALUES (mgr_id, 'gerente');

  -- Conta demo (simula createDemoAccounts)
  INSERT INTO public.profiles(id, display_name, is_demo, manager_id, balance, demo_balance)
    VALUES (demo_id, 'test_demo_user', true, mgr_id, 0, 0);

  -- [1] Crédito de saldo demo pelo gerente
  SELECT set_config('request.jwt.claim.sub', mgr_id::text, true) INTO res; -- best-effort
  PERFORM public.manager_credit_demo_balance(
    _target_user_id := demo_id,
    _amount := 50,
    _reason := 'teste isolation'
  );

  -- [2] Nenhum depósito deve existir
  SELECT count(*) INTO cnt FROM public.deposits WHERE user_id = demo_id;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL[deposits]: conta demo gerou % depósitos', cnt;
  END IF;

  -- [3] Nenhum saque de afiliado
  SELECT count(*) INTO cnt FROM public.affiliate_withdrawals WHERE user_id = demo_id;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL[withdrawals]: conta demo gerou % saques', cnt;
  END IF;

  -- [4] wallet_transactions só de tipos demo_*
  SELECT count(*) INTO cnt
    FROM public.wallet_transactions
   WHERE user_id = demo_id
     AND type NOT LIKE 'demo_%';
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL[wallet]: % lançamentos NÃO-demo em wallet_transactions', cnt;
  END IF;

  -- [5] profiles.balance permanece 0; demo_balance = 50
  SELECT balance, demo_balance INTO real_bal, demo_bal
    FROM public.profiles WHERE id = demo_id;
  IF real_bal <> 0 THEN
    RAISE EXCEPTION 'FAIL[real_balance]: esperado 0, got %', real_bal;
  END IF;
  IF demo_bal <> 50 THEN
    RAISE EXCEPTION 'FAIL[demo_balance]: esperado 50, got %', demo_bal;
  END IF;

  -- [6] credit_deposit_atomic deve recusar depósito real p/ conta demo
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (demo_id, 20, 'diggion', 'pending', 'tx_demo_block');
  SELECT public.credit_deposit_atomic(
    (SELECT id FROM public.deposits WHERE external_id='tx_demo_block'),
    20, 'tx_demo_block'
  ) INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL[deposit_block]: credit_deposit_atomic aceitou depósito p/ demo: %', res;
  END IF;

  -- Saldo real ainda zero
  SELECT balance INTO real_bal FROM public.profiles WHERE id = demo_id;
  IF real_bal <> 0 THEN
    RAISE EXCEPTION 'FAIL[real_balance_after_block]: esperado 0, got %', real_bal;
  END IF;

  RAISE NOTICE 'ALL DEMO ISOLATION TESTS PASSED';
END $$;
