CREATE OR REPLACE FUNCTION public.helix_payout_cents(_amount_cents integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _amount_cents IS NULL OR _amount_cents <= 0 THEN NULL
    ELSE GREATEST(1, ROUND(_amount_cents * 0.10)::int)
  END
$$;

CREATE OR REPLACE FUNCTION public.helix_minimum_withdraw_cents(_deposit_amount_cents integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _deposit_amount_cents IS NULL OR _deposit_amount_cents <= 0 THEN NULL
    ELSE _deposit_amount_cents * 5
  END
$$;