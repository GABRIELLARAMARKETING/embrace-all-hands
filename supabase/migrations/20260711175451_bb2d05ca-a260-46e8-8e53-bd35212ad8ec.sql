CREATE OR REPLACE FUNCTION public.test_demo_account_isolation()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mgr_id  uuid := gen_random_uuid();
  demo_id uuid := gen_random_uuid();
  dep_id  uuid;
  cnt int;
  real_bal numeric(14,2);
  demo_bal numeric(14,2);
  res jsonb;
BEGIN
  ALTER TABLE public.profiles              DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.profiles              DROP CONSTRAINT IF EXISTS profiles_manager_id_fkey;
  ALTER TABLE public.wallet_transactions   DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
  ALTER TABLE public.deposits              DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
  ALTER TABLE public.affiliate_withdrawals DROP CONSTRAINT IF EXISTS affiliate_withdrawals_user_id_fkey;
  ALTER TABLE public.user_roles            DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

  INSERT INTO public.profiles(id, display_name) VALUES (mgr_id, 'test_mgr_demo');
  INSERT INTO public.user_roles(user_id, role) VALUES (mgr_id, 'gerente');

  INSERT INTO public.profiles(id, display_name, is_demo, manager_id, balance, demo_balance)
    VALUES (demo_id, 'test_demo_user', true, mgr_id, 0, 0);

  -- [1] Crédito demo pelo gerente (via RPC oficial)
  PERFORM set_config('request.jwt.claim.sub', mgr_id::text, true);
  SELECT public.manager_credit_demo_balance(demo_id, 50::numeric, 'teste isolation') INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[credit]: manager_credit_demo_balance falhou: %', res;
  END IF;

  -- [2] Zero depósitos para a conta demo
  SELECT count(*) INTO cnt FROM public.deposits WHERE user_id = demo_id;
  IF cnt <> 0 THEN RAISE EXCEPTION 'FAIL[deposits]: demo gerou % deposit(s)', cnt; END IF;

  -- [3] Zero saques de afiliado
  SELECT count(*) INTO cnt FROM public.affiliate_withdrawals WHERE user_id = demo_id;
  IF cnt <> 0 THEN RAISE EXCEPTION 'FAIL[withdrawals]: demo gerou % saque(s)', cnt; END IF;

  -- [4] wallet_transactions: apenas tipos demo_*
  SELECT count(*) INTO cnt
    FROM public.wallet_transactions
   WHERE user_id = demo_id AND type NOT LIKE 'demo_%';
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL[wallet]: % lançamento(s) NÃO-demo em wallet_transactions', cnt;
  END IF;

  -- [5] Saldo real ficou 0; demo_balance = 50
  SELECT balance, demo_balance INTO real_bal, demo_bal FROM public.profiles WHERE id = demo_id;
  IF real_bal <> 0 THEN RAISE EXCEPTION 'FAIL[real_balance]: esperado 0, got %', real_bal; END IF;
  IF demo_bal <> 50 THEN RAISE EXCEPTION 'FAIL[demo_balance]: esperado 50, got %', demo_bal; END IF;

  -- [6] credit_deposit_atomic recusa depósito real para conta demo
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (demo_id, 20, 'diggion', 'pending', 'tx_demo_block') RETURNING id INTO dep_id;
  SELECT public.credit_deposit_atomic(dep_id, 20, 'tx_demo_block') INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM false OR res->>'reason' <> 'demo_account_blocked' THEN
    RAISE EXCEPTION 'FAIL[deposit_block]: credit_deposit_atomic não bloqueou demo: %', res;
  END IF;

  -- [7] Saldo real continua 0 após tentativa
  SELECT balance INTO real_bal FROM public.profiles WHERE id = demo_id;
  IF real_bal <> 0 THEN
    RAISE EXCEPTION 'FAIL[real_balance_after_block]: esperado 0, got %', real_bal;
  END IF;

  -- [8] Deposit bloqueado marcado como failed
  PERFORM 1 FROM public.deposits WHERE id = dep_id AND status = 'failed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL[deposit_state]: deposit bloqueado não ficou failed';
  END IF;

  RETURN 'ALL DEMO ISOLATION TESTS PASSED (no deposits, no withdrawals, no real wallet_tx)';
END
$function$;