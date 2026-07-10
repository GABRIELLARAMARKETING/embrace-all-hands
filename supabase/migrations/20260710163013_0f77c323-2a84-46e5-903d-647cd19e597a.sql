
-- Enum tipos de código
DO $$ BEGIN
  CREATE TYPE public.invite_code_kind AS ENUM ('referral','affiliate','manager','invite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invite_code_status AS ENUM ('active','inactive','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind public.invite_code_kind NOT NULL,
  status public.invite_code_status NOT NULL DEFAULT 'active',
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_kind ON public.invite_codes(kind);
CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON public.invite_codes(status);
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_at ON public.invite_codes(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_codes TO authenticated;
GRANT ALL ON public.invite_codes TO service_role;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invite codes"
  ON public.invite_codes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Auditoria
CREATE TABLE IF NOT EXISTS public.invite_code_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  code text NOT NULL,
  action text NOT NULL,  -- created | activated | deactivated | expired | updated | deleted
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_code_audit_code ON public.invite_code_audit(code_id);
CREATE INDEX IF NOT EXISTS idx_invite_code_audit_created_at ON public.invite_code_audit(created_at DESC);

GRANT SELECT, INSERT ON public.invite_code_audit TO authenticated;
GRANT ALL ON public.invite_code_audit TO service_role;

ALTER TABLE public.invite_code_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit"
  ON public.invite_code_audit FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert audit"
  ON public.invite_code_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_invite_codes_updated ON public.invite_codes;
CREATE TRIGGER trg_invite_codes_updated
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função utilitária para expirar códigos vencidos
CREATE OR REPLACE FUNCTION public.expire_invite_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.invite_codes
       SET status = 'expired', updated_at = now()
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at < now()
     RETURNING id, code
  )
  INSERT INTO public.invite_code_audit(code_id, code, action, detail)
  SELECT id, code, 'expired', jsonb_build_object('reason','ttl')
    FROM upd;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
