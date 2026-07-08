
-- ============================================================
-- 1) profiles: bloquear escrita em colunas financeiras
--    Regrant coluna-a-coluna para authenticated (apenas colunas seguras)
-- ============================================================
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

-- Trigger de defesa em profundidade: mesmo com a policy, garantimos que
-- affiliate_balance, coins, level e total_received só possam mudar via
-- service_role (server functions/admin) ou funções SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.protect_profile_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permitir alterações somente quando executadas fora do contexto de
  -- um usuário autenticado do PostgREST (ex.: service_role/admin).
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
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

DROP TRIGGER IF EXISTS protect_profile_financials ON public.profiles;
CREATE TRIGGER protect_profile_financials
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_financials();

-- ============================================================
-- 2) live_matches: remover SELECT público direto (usar a view)
-- ============================================================
DROP POLICY IF EXISTS "Live matches safe columns via view" ON public.live_matches;
REVOKE SELECT ON public.live_matches FROM anon, authenticated;

-- Política somente para service_role (admin/edge). Ninguém mais lê direto.
DROP POLICY IF EXISTS "Live matches admin read" ON public.live_matches;
CREATE POLICY "Live matches admin read"
  ON public.live_matches
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- 3) SECURITY DEFINER: revogar EXECUTE de anon
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
