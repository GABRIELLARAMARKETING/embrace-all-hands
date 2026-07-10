
-- Minimum withdrawal per deposit tier (all in cents)
CREATE OR REPLACE FUNCTION public.helix_minimum_withdraw_cents(_deposit_amount_cents integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _deposit_amount_cents
    WHEN 500   THEN 2500
    WHEN 1000  THEN 5000
    WHEN 2000  THEN 10000
    WHEN 3000  THEN 15000
    WHEN 5000  THEN 25000
    WHEN 10000 THEN 50000
    ELSE NULL
  END
$$;

-- Returns the withdrawal rule that applies to the authenticated user.
-- Rule: uses the HIGHEST paid deposit amount as the reference tier
-- (strictest applicable minimum).
CREATE OR REPLACE FUNCTION public.helix_withdrawal_rules()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  bal_cents integer;
  top_dep_cents integer;
  min_cents integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT ROUND(COALESCE(balance, 0) * 100)::int INTO bal_cents
    FROM public.profiles WHERE id = uid;

  SELECT ROUND(MAX(amount) * 100)::int INTO top_dep_cents
    FROM public.deposits
    WHERE user_id = uid AND status IN ('paid', 'approved');

  IF top_dep_cents IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'has_deposit', false,
      'available_reward_cents', COALESCE(bal_cents, 0),
      'minimum_withdraw_cents', NULL,
      'can_withdraw', false,
      'missing_to_withdraw_cents', NULL,
      'message', 'Faça um depósito para desbloquear saques.'
    );
  END IF;

  min_cents := public.helix_minimum_withdraw_cents(top_dep_cents);

  RETURN jsonb_build_object(
    'ok', true,
    'has_deposit', true,
    'reference_deposit_cents', top_dep_cents,
    'available_reward_cents', COALESCE(bal_cents, 0),
    'minimum_withdraw_cents', min_cents,
    'can_withdraw', COALESCE(bal_cents, 0) >= min_cents,
    'missing_to_withdraw_cents', GREATEST(min_cents - COALESCE(bal_cents, 0), 0)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.helix_minimum_withdraw_cents(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.helix_withdrawal_rules() TO authenticated;
