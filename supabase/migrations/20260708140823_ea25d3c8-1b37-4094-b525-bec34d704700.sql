
-- ============================================================
-- FASE 1: RBAC + Audit logs
-- ============================================================

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'gerente', 'afiliado');

-- user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Any admin-or-above check
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;

-- Users read their own roles; admins read all
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed first super admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'gabriellara.luizz@gmail.com'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Audit logs
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_actor_idx ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id, created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read; no client writes/updates/deletes (server functions use service_role)
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- FASE 2: Saques admin — estender affiliate_withdrawals
-- ============================================================

-- Novo enum de status
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending', 'in_review', 'approved', 'paid', 'rejected', 'cancelled', 'failed'
);

-- Converter coluna status: drop default, cast, novo default
ALTER TABLE public.affiliate_withdrawals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.affiliate_withdrawals
  ALTER COLUMN status TYPE public.withdrawal_status
  USING (
    CASE lower(status)
      WHEN 'pending'   THEN 'pending'::public.withdrawal_status
      WHEN 'pendente'  THEN 'pending'::public.withdrawal_status
      WHEN 'approved'  THEN 'approved'::public.withdrawal_status
      WHEN 'aprovado'  THEN 'approved'::public.withdrawal_status
      WHEN 'paid'      THEN 'paid'::public.withdrawal_status
      WHEN 'pago'      THEN 'paid'::public.withdrawal_status
      WHEN 'rejected'  THEN 'rejected'::public.withdrawal_status
      WHEN 'recusado'  THEN 'rejected'::public.withdrawal_status
      ELSE 'pending'::public.withdrawal_status
    END
  );
ALTER TABLE public.affiliate_withdrawals ALTER COLUMN status SET DEFAULT 'pending'::public.withdrawal_status;

-- Colunas de gestão administrativa
ALTER TABLE public.affiliate_withdrawals
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN paid_at timestamptz,
  ADD COLUMN rejection_reason text,
  ADD COLUMN admin_notes text,
  ADD COLUMN request_ip text,
  ADD COLUMN request_user_agent text;

CREATE INDEX affiliate_withdrawals_status_idx
  ON public.affiliate_withdrawals (status, created_at DESC);

-- Policies admin
CREATE POLICY "Admins read all withdrawals" ON public.affiliate_withdrawals
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update withdrawals" ON public.affiliate_withdrawals
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
