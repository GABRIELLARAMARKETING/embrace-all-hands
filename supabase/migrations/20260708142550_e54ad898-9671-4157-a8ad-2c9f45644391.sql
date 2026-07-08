
CREATE OR REPLACE FUNCTION public.protect_profile_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- current_user = 'authenticated' quando a chamada vem do PostgREST
  -- com sessão de usuário logado (não service_role, não superuser).
  IF current_user = 'authenticated' THEN
    IF NEW.affiliate_balance IS DISTINCT FROM OLD.affiliate_balance
       OR NEW.coins            IS DISTINCT FROM OLD.coins
       OR NEW.level            IS DISTINCT FROM OLD.level
       OR NEW.total_received   IS DISTINCT FROM OLD.total_received
       OR NEW.status           IS DISTINCT FROM OLD.status
       OR NEW.manager_id       IS DISTINCT FROM OLD.manager_id THEN
      RAISE EXCEPTION 'Alteração de campos protegidos não permitida.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
