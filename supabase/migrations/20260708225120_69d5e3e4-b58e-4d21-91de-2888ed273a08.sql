
-- Enums
DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM (
    'commission_created','commission_approved','commission_canceled',
    'withdrawal_requested','withdrawal_approved','withdrawal_paid','withdrawal_rejected',
    'manual_adjustment_positive','manual_adjustment_negative'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commission_status AS ENUM ('pending','approved','canceled','available','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_alert_status AS ENUM ('open','reviewing','resolved','ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_before NUMERIC(14,2),
  balance_after NUMERIC(14,2),
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all transactions" ON public.transactions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX transactions_user_id_idx ON public.transactions(user_id);
CREATE INDEX transactions_created_at_idx ON public.transactions(created_at DESC);

-- commissions
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  base_amount NUMERIC(14,2) NOT NULL,
  percentage NUMERIC(6,2) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  available_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own commissions read" ON public.commissions FOR SELECT TO authenticated USING (auth.uid() = affiliate_id OR auth.uid() = manager_id);
CREATE POLICY "admins read all commissions" ON public.commissions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX commissions_affiliate_idx ON public.commissions(affiliate_id);
CREATE INDEX commissions_manager_idx ON public.commissions(manager_id);
CREATE INDEX commissions_status_idx ON public.commissions(status);
CREATE TRIGGER commissions_set_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- risk_alerts
CREATE TABLE public.risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  withdrawal_id UUID REFERENCES public.affiliate_withdrawals(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  severity public.risk_severity NOT NULL DEFAULT 'low',
  title TEXT NOT NULL,
  description TEXT,
  status public.risk_alert_status NOT NULL DEFAULT 'open',
  assigned_to_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.risk_alerts TO authenticated;
GRANT ALL ON public.risk_alerts TO service_role;
ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read risk alerts" ON public.risk_alerts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX risk_alerts_status_idx ON public.risk_alerts(status);
CREATE INDEX risk_alerts_severity_idx ON public.risk_alerts(severity);
CREATE TRIGGER risk_alerts_set_updated_at BEFORE UPDATE ON public.risk_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- platform_settings
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  updated_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- login_logs
CREATE TABLE public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  ip TEXT,
  user_agent TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.login_logs TO authenticated;
GRANT ALL ON public.login_logs TO service_role;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read login logs" ON public.login_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX login_logs_email_idx ON public.login_logs(email);
CREATE INDEX login_logs_created_at_idx ON public.login_logs(created_at DESC);

-- report_exports
CREATE TABLE public.report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  filters JSONB,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_exports TO authenticated;
GRANT ALL ON public.report_exports TO service_role;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read report exports" ON public.report_exports FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Seed critical settings keys (structure only, defaults)
INSERT INTO public.platform_settings (key, value, type, description, is_critical) VALUES
  ('minimumWithdrawalAmount', '50'::jsonb, 'number', 'Valor mínimo de saque em BRL', true),
  ('withdrawalFeePercentage', '0'::jsonb, 'number', 'Taxa (%) sobre saques', true),
  ('dailyWithdrawalLimit', '5000'::jsonb, 'number', 'Limite diário de saque por usuário', true),
  ('commissionReleaseDays', '7'::jsonb, 'number', 'Dias para liberar comissão', true),
  ('allowNegativeBalance', 'false'::jsonb, 'boolean', 'Permitir saldo negativo', true),
  ('autoBlockSuspiciousUsers', 'false'::jsonb, 'boolean', 'Bloqueio automático de suspeitos', true),
  ('maintenanceMode', 'false'::jsonb, 'boolean', 'Modo manutenção', true),
  ('defaultAffiliateCommissionRate', '50'::jsonb, 'number', '% padrão para afiliados', false),
  ('defaultManagerCommissionRate', '5'::jsonb, 'number', '% padrão para gerentes', false)
ON CONFLICT (key) DO NOTHING;
