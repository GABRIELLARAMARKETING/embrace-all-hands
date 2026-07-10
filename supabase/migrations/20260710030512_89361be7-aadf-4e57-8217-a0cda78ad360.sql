
CREATE OR REPLACE FUNCTION public.reconcile_payments()
RETURNS TABLE(
  kind text,
  deposit_id uuid,
  user_id uuid,
  expected numeric,
  actual numeric,
  detail text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 1) Depósito 'paid' sem wallet_transaction correspondente
  RETURN QUERY
  SELECT 'missing_wallet_tx'::text, d.id, d.user_id, d.amount::numeric, NULL::numeric,
         format('Depósito %s pago em %s sem lançamento na carteira', d.id, d.paid_at)
  FROM public.deposits d
  LEFT JOIN public.wallet_transactions wt
    ON wt.deposit_id = d.id AND wt.type = 'deposit'
  WHERE d.status IN ('paid','approved')
    AND d.credited_at IS NOT NULL
    AND wt.id IS NULL;

  -- 2) Wallet_transaction com valor diferente do depósito
  RETURN QUERY
  SELECT 'wallet_amount_mismatch'::text, d.id, d.user_id, d.amount::numeric, wt.amount::numeric,
         format('Depósito %s: esperado %s, carteira %s', d.id, d.amount, wt.amount)
  FROM public.deposits d
  JOIN public.wallet_transactions wt
    ON wt.deposit_id = d.id AND wt.type = 'deposit'
  WHERE d.status IN ('paid','approved')
    AND ROUND(d.amount::numeric,2) <> ROUND(wt.amount::numeric,2);

  -- 3) Depósito pago sem credited_at (fluxo incompleto)
  RETURN QUERY
  SELECT 'paid_without_credit'::text, d.id, d.user_id, d.amount::numeric, NULL::numeric,
         format('Depósito %s marcado como %s mas credited_at NULL', d.id, d.status)
  FROM public.deposits d
  WHERE d.status IN ('paid','approved') AND d.credited_at IS NULL;

  -- 4) Saldo do perfil diverge do extrato (soma de depositos - saques - apostas + prêmios etc.)
  --    Consideramos apenas type='deposit' vs balance_after do último lançamento por usuário.
  RETURN QUERY
  WITH last_tx AS (
    SELECT DISTINCT ON (user_id) user_id, balance_after, created_at
    FROM public.wallet_transactions
    ORDER BY user_id, created_at DESC, id DESC
  )
  SELECT 'profile_balance_mismatch'::text, NULL::uuid, p.id, lt.balance_after::numeric, p.balance::numeric,
         format('Usuário %s: extrato=%s perfil=%s', p.id, lt.balance_after, p.balance)
  FROM public.profiles p
  JOIN last_tx lt ON lt.user_id = p.id
  WHERE ROUND(p.balance::numeric,2) <> ROUND(lt.balance_after::numeric,2);

  -- 5) Depósito elegível a comissão (usuário não-demo, com manager) sem NENHUMA comissão
  RETURN QUERY
  SELECT 'missing_commissions'::text, d.id, d.user_id, d.amount::numeric, 0::numeric,
         format('Depósito %s elegível (user=%s, manager=%s) sem comissões', d.id, d.user_id, p.manager_id)
  FROM public.deposits d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.status IN ('paid','approved')
    AND d.credited_at IS NOT NULL
    AND COALESCE(p.is_demo,false) = false
    AND p.manager_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.commissions c WHERE c.deposit_id = d.id);

  -- 6) Soma das comissões maior que orçamento configurado do gerente
  RETURN QUERY
  SELECT 'commission_over_budget'::text, d.id, d.user_id,
         ROUND(d.amount * mp.total_budget_percent / 100.0, 2)::numeric,
         COALESCE(SUM(c.amount),0)::numeric,
         format('Depósito %s: orçamento=%s pago=%s', d.id,
                ROUND(d.amount * mp.total_budget_percent / 100.0, 2),
                COALESCE(SUM(c.amount),0))
  FROM public.deposits d
  JOIN public.profiles p ON p.id = d.user_id
  JOIN public.manager_profiles mp ON mp.user_id = p.manager_id
  LEFT JOIN public.commissions c ON c.deposit_id = d.id
  WHERE d.status IN ('paid','approved')
    AND d.credited_at IS NOT NULL
  GROUP BY d.id, d.amount, mp.total_budget_percent, d.user_id, p.manager_id
  HAVING COALESCE(SUM(c.amount),0) > ROUND(d.amount * mp.total_budget_percent / 100.0, 2) + 0.01;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_reconciliation()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n int;
  report text;
BEGIN
  SELECT count(*) INTO n FROM public.reconcile_payments();
  IF n = 0 THEN
    RETURN 'RECONCILIATION OK: 0 divergences';
  END IF;
  SELECT string_agg(format('- [%s] user=%s dep=%s expected=%s actual=%s :: %s',
                           kind, user_id, deposit_id, expected, actual, detail),
                    E'\n')
    INTO report
    FROM public.reconcile_payments();
  RAISE EXCEPTION E'RECONCILIATION FAILED: % divergences\n%', n, report;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_payments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_reconciliation() FROM PUBLIC, anon, authenticated;
