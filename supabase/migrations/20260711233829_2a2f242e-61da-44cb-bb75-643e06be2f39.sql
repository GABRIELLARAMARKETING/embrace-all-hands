CREATE OR REPLACE FUNCTION public.sync_profile_balance_from_wallet_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type IS NULL OR NEW.type NOT LIKE 'demo_%' THEN
    UPDATE public.profiles
       SET balance = COALESCE(NEW.balance_after, 0)::numeric(14,2),
           updated_at = now()
     WHERE id = NEW.user_id
       AND ROUND(COALESCE(balance, 0)::numeric, 2) <> ROUND(COALESCE(NEW.balance_after, 0)::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_balance_from_wallet_transaction ON public.wallet_transactions;
CREATE TRIGGER trg_sync_profile_balance_from_wallet_transaction
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_balance_from_wallet_transaction();

WITH latest_non_demo_wallet AS (
  SELECT DISTINCT ON (wt.user_id)
         wt.user_id,
         wt.balance_after::numeric(14,2) AS balance_after
    FROM public.wallet_transactions wt
   WHERE wt.type IS NULL OR wt.type NOT LIKE 'demo_%'
   ORDER BY wt.user_id, wt.created_at DESC, wt.id DESC
)
UPDATE public.profiles p
   SET balance = l.balance_after,
       updated_at = now()
  FROM latest_non_demo_wallet l
 WHERE p.id = l.user_id
   AND ROUND(COALESCE(p.balance, 0)::numeric, 2) <> ROUND(COALESCE(l.balance_after, 0)::numeric, 2);

REVOKE ALL ON FUNCTION public.sync_profile_balance_from_wallet_transaction() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_balance_from_wallet_transaction() TO service_role;