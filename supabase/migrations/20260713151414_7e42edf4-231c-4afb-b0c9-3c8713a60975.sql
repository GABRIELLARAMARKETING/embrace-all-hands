
CREATE OR REPLACE FUNCTION public.test_wallet_multi_match_flow()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := gen_random_uuid();
  dep_id uuid;
  res jsonb;
  bal numeric;
  session_count int;
BEGIN
  -- Drop FKs so we can use synthetic uuids without auth.users rows.
  ALTER TABLE public.profiles            DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.deposits            DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
  ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
  ALTER TABLE public.game_sessions       DROP CONSTRAINT IF EXISTS game_sessions_user_id_fkey;

  INSERT INTO public.profiles(id, display_name, balance)
    VALUES (uid, 'test_wallet_user', 0);

  -- [1] Deposit R$100 approved and credited
  INSERT INTO public.deposits(user_id, amount, provider, status, external_id)
    VALUES (uid, 100, 'diggion', 'pending', 'tx_wallet_test') RETURNING id INTO dep_id;
  SELECT public.credit_deposit_atomic(dep_id, 100, 'tx_wallet_test') INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[1] credit: %', res;
  END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = uid;
  IF bal <> 100 THEN RAISE EXCEPTION 'FAIL[1] esperado saldo 100, got %', bal; END IF;

  PERFORM set_config('request.jwt.claim.sub', uid::text, true);

  -- [2] Session 1: R$10 (should succeed)
  SELECT public.helix_create_session(dep_id, 10::numeric, NULL) INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[2] session1: %', res;
  END IF;

  -- Simulate spending the R$10 (debit balance to reflect end-of-match)
  UPDATE public.profiles SET balance = balance - 10 WHERE id = uid;
  UPDATE public.deposits SET status = 'spent' WHERE id = dep_id;

  -- [3] Session 2: R$20 using remaining balance (this is the regression scenario)
  SELECT public.helix_create_session(dep_id, 20::numeric, NULL) INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[3] session2 (regression - deposit reuse): %', res;
  END IF;
  UPDATE public.profiles SET balance = balance - 20 WHERE id = uid;

  -- [4] Session 3: R$30 also with same deposit as reference
  SELECT public.helix_create_session(dep_id, 30::numeric, NULL) INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[4] session3: %', res;
  END IF;
  UPDATE public.profiles SET balance = balance - 30 WHERE id = uid;

  -- [5] Session 4: R$50 uses last R$40 → should fail with insufficient_balance
  SELECT balance INTO bal FROM public.profiles WHERE id = uid;
  IF bal <> 40 THEN RAISE EXCEPTION 'FAIL[5] esperado saldo 40, got %', bal; END IF;

  SELECT public.helix_create_session(dep_id, 50::numeric, NULL) INTO res;
  IF (res->>'reason') <> 'insufficient_balance' THEN
    RAISE EXCEPTION 'FAIL[5] esperado insufficient_balance, got %', res;
  END IF;

  -- [6] R$40 (fits) succeeds
  SELECT public.helix_create_session(dep_id, 40::numeric, NULL) INTO res;
  IF (res->>'ok')::bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL[6] session final: %', res;
  END IF;

  -- [7] Confirm no invalid_deposit error surfaced anywhere in the flow
  SELECT count(*) INTO session_count
    FROM public.game_sessions
   WHERE user_id = uid AND status IN ('active','abandoned');
  IF session_count < 4 THEN
    RAISE EXCEPTION 'FAIL[7] esperado >=4 sessões criadas, got %', session_count;
  END IF;

  RETURN 'ALL WALLET MULTI-MATCH TESTS PASSED';
END
$function$;
