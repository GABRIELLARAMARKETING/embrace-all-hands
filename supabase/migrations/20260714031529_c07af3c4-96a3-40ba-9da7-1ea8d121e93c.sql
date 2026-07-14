CREATE OR REPLACE FUNCTION public.protect_game_session_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.reward_cents IS DISTINCT FROM OLD.reward_cents
     OR NEW.payout_per_platform_cents IS DISTINCT FROM OLD.payout_per_platform_cents
     OR NEW.credited_at IS DISTINCT FROM OLD.credited_at
     OR NEW.validated_platforms_passed IS DISTINCT FROM OLD.validated_platforms_passed
     OR NEW.anti_fraud_score IS DISTINCT FROM OLD.anti_fraud_score
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deposit_id IS DISTINCT FROM OLD.deposit_id
     OR NEW.stake_cents IS DISTINCT FROM OLD.stake_cents
     OR NEW.demo_stake_cents IS DISTINCT FROM OLD.demo_stake_cents
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Financial/status fields on game_sessions can only be modified by server-side logic'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;