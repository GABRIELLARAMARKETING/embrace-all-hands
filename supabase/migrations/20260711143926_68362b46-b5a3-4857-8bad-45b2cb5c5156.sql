CREATE OR REPLACE FUNCTION public.reconcile_payments()
 RETURNS TABLE(kind text, deposit_id uuid, user_id uuid, expected numeric, actual numeric, detail text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 'missing_wallet_tx'::text, d.id, d.user_id, d.amount::numeric, NULL::numeric,
         format('Depósito %s pago em %s sem lançamento na carteira', d.id, d.paid_at)
  FROM public.deposits d
  LEFT JOIN public.wallet_transactions wt
    ON wt.deposit_id = d.id AND wt.type = 'deposit'
  WHERE d.status IN ('paid','approved') AND d.credited_at IS NOT NULL AND wt.id IS NULL
    AND d.provider <> 'admin_manual';

  RETURN QUERY
  SELECT 'wallet_amount_mismatch'::text, d.id, d.user_id, d.amount::numeric, wt.amount::numeric,
         format('Depósito %s: esperado %s, carteira %s', d.id, d.amount, wt.amount)
  FROM public.deposits d
  JOIN public.wallet_transactions wt ON wt.deposit_id = d.id AND wt.type = 'deposit'
  WHERE d.status IN ('paid','approved')
    AND ROUND(d.amount::numeric,2) <> ROUND(wt.amount::numeric,2)
    AND d.provider <> 'admin_manual';

  RETURN QUERY
  SELECT 'paid_without_credit'::text, d.id, d.user_id, d.amount::numeric, NULL::numeric,
         format('Depósito %s marcado como %s mas credited_at NULL', d.id, d.status)
  FROM public.deposits d
  WHERE d.status IN ('paid','approved') AND d.credited_at IS NULL
    AND d.provider <> 'admin_manual';

  RETURN QUERY
  WITH last_tx AS (
    SELECT DISTINCT ON (wt.user_id) wt.user_id AS uid, wt.balance_after, wt.created_at
    FROM public.wallet_transactions wt
    ORDER BY wt.user_id, wt.created_at DESC, wt.id DESC
  )
  SELECT 'profile_balance_mismatch'::text, NULL::uuid, p.id, lt.balance_after::numeric, p.balance::numeric,
         format('Usuário %s: extrato=%s perfil=%s', p.id, lt.balance_after, p.balance)
  FROM public.profiles p
  JOIN last_tx lt ON lt.uid = p.id
  WHERE ROUND(p.balance::numeric,2) <> ROUND(lt.balance_after::numeric,2);

  RETURN QUERY
  SELECT 'missing_commissions'::text, d.id, d.user_id, d.amount::numeric, 0::numeric,
         format('Depósito %s elegível (user=%s, manager=%s) sem comissões', d.id, d.user_id, p.manager_id)
  FROM public.deposits d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.status IN ('paid','approved')
    AND d.credited_at IS NOT NULL
    AND COALESCE(p.is_demo,false) = false
    AND p.manager_id IS NOT NULL
    AND d.provider <> 'admin_manual'
    AND NOT EXISTS (SELECT 1 FROM public.commissions c WHERE c.deposit_id = d.id);

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
  WHERE d.status IN ('paid','approved') AND d.credited_at IS NOT NULL
    AND d.provider <> 'admin_manual'
  GROUP BY d.id, d.amount, mp.total_budget_percent, d.user_id, p.manager_id
  HAVING COALESCE(SUM(c.amount),0) > ROUND(d.amount * mp.total_budget_percent / 100.0, 2) + 0.01;
END;
$function$;