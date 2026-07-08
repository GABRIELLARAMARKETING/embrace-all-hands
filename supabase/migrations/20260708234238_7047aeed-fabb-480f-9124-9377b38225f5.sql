
-- =========================================================
-- FASE 1 — Painel Gerente: multinível, comissões, demos
-- =========================================================

-- 1) Extensões novas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_code text,
  ADD COLUMN IF NOT EXISTS referred_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_influencer boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_affiliate_code_uidx
  ON public.profiles(affiliate_code) WHERE affiliate_code IS NOT NULL;

-- 2) Gerador de código de afiliado (6 chars, colisão-safe)
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text;
  i     int;
  tries int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE affiliate_code = code);
    tries := tries + 1;
    IF tries > 20 THEN
      code := code || substr(md5(random()::text), 1, 2);
      EXIT;
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_affiliate_code() FROM public, anon;

-- Trigger: garante affiliate_code em novos profiles
CREATE OR REPLACE FUNCTION public.ensure_affiliate_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.affiliate_code IS NULL OR NEW.affiliate_code = '' THEN
    NEW.affiliate_code := public.generate_affiliate_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_affiliate_code ON public.profiles;
CREATE TRIGGER trg_profiles_affiliate_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_affiliate_code();

-- Backfill códigos ausentes
UPDATE public.profiles SET affiliate_code = public.generate_affiliate_code()
WHERE affiliate_code IS NULL;

-- 3) manager_profiles: percentuais por gerente
CREATE TABLE IF NOT EXISTS public.manager_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_budget_percent numeric(5,2) NOT NULL DEFAULT 70,
  level1_percent numeric(5,2) NOT NULL DEFAULT 50,
  level2_percent numeric(5,2) NOT NULL DEFAULT 5,
  level3_percent numeric(5,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.manager_profiles TO authenticated;
GRANT ALL ON public.manager_profiles TO service_role;
ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager reads own profile" ON public.manager_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "manager updates own profile" ON public.manager_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "admin inserts manager profile" ON public.manager_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR user_id = auth.uid());

CREATE TRIGGER trg_manager_profiles_updated_at
BEFORE UPDATE ON public.manager_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: proteger total_budget_percent (gerente não pode aumentar)
CREATE OR REPLACE FUNCTION public.protect_manager_budget()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NEW.total_budget_percent > OLD.total_budget_percent
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can increase total budget';
  END IF;
  -- soma dos níveis não pode passar do orçamento
  IF (COALESCE(NEW.level1_percent,0) + COALESCE(NEW.level2_percent,0) + COALESCE(NEW.level3_percent,0)) > NEW.total_budget_percent THEN
    RAISE EXCEPTION 'Sum of levels exceeds total budget';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_manager_budget ON public.manager_profiles;
CREATE TRIGGER trg_protect_manager_budget
BEFORE UPDATE ON public.manager_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_manager_budget();

-- Seed manager_profiles para admins existentes (que atuam como gerentes)
INSERT INTO public.manager_profiles(user_id)
SELECT DISTINCT ur.user_id FROM public.user_roles ur
WHERE ur.role IN ('gerente','admin','super_admin')
ON CONFLICT (user_id) DO NOTHING;

-- 4) referrals (cadeia multinível)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  source_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id, level)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_id, level);
CREATE INDEX IF NOT EXISTS referrals_manager_idx  ON public.referrals(manager_id);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own network" ON public.referrals
  FOR SELECT TO authenticated
  USING (
    referrer_id = auth.uid()
    OR referred_id = auth.uid()
    OR manager_id  = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- 5) referral_logs
CREATE TABLE IF NOT EXISTS public.referral_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_code text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_logs TO authenticated;
GRANT ALL ON public.referral_logs TO service_role;
ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads referral logs" ON public.referral_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 6) deposits + status
DO $$ BEGIN
  CREATE TYPE public.deposit_status AS ENUM ('pending','approved','paid','rejected','canceled','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status public.deposit_status NOT NULL DEFAULT 'pending',
  payment_method text,
  external_id text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deposits_user_idx ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON public.deposits(status);

GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own deposits" ON public.deposits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.referrals r
               WHERE r.referred_id = deposits.user_id AND r.manager_id = auth.uid()));

CREATE POLICY "user creates own deposit" ON public.deposits
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_deposits_updated_at
BEFORE UPDATE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) commissions: acrescentar deposit_id + level + unicidade idempotente
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS level smallint;
CREATE UNIQUE INDEX IF NOT EXISTS commissions_deposit_level_uidx
  ON public.commissions(deposit_id, COALESCE(level, 0), affiliate_id)
  WHERE deposit_id IS NOT NULL;

-- 8) demo accounts
CREATE TABLE IF NOT EXISTS public.demo_account_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_pattern text NOT NULL,
  password_pattern text,
  quantity int NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.demo_account_batches TO authenticated;
GRANT ALL ON public.demo_account_batches TO service_role;
ALTER TABLE public.demo_account_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager reads own batches" ON public.demo_account_batches
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "manager inserts batches" ON public.demo_account_batches
  FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.demo_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.demo_account_batches(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone text NOT NULL,
  affiliate_code text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demo_accounts_manager_idx ON public.demo_accounts(manager_id);
GRANT SELECT, INSERT ON public.demo_accounts TO authenticated;
GRANT ALL ON public.demo_accounts TO service_role;
ALTER TABLE public.demo_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager reads own demos" ON public.demo_accounts
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "manager creates demos" ON public.demo_accounts
  FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid());

-- 9) handle_new_user estendido: aplica ref + monta cadeia
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_theme_id uuid;
  ref_code text;
  ref_owner uuid;
  ref_owner_manager uuid;
  lvl2_ref uuid;
  lvl3_ref uuid;
  new_manager uuid;
BEGIN
  ref_code := NULLIF(NEW.raw_user_meta_data->>'ref','');

  -- Resolver dono do ref
  IF ref_code IS NOT NULL THEN
    SELECT id, manager_id INTO ref_owner, ref_owner_manager
      FROM public.profiles WHERE affiliate_code = ref_code LIMIT 1;
    IF ref_owner = NEW.id THEN ref_owner := NULL; END IF;
  END IF;

  -- manager herdado: se ref_owner é gerente, ele mesmo; senão manager do ref_owner
  IF ref_owner IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = ref_owner AND role IN ('gerente','admin','super_admin')) THEN
      new_manager := ref_owner;
    ELSE
      new_manager := ref_owner_manager;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, referred_by_id, manager_id, is_influencer)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    ref_owner,
    new_manager,
    ref_owner IS NOT NULL
  );

  -- referrals: nível 1
  IF ref_owner IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
      VALUES (ref_owner, NEW.id, new_manager, 1, ref_code)
      ON CONFLICT DO NOTHING;
    -- nível 2
    SELECT referred_by_id INTO lvl2_ref FROM public.profiles WHERE id = ref_owner;
    IF lvl2_ref IS NOT NULL AND lvl2_ref <> NEW.id THEN
      INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
        VALUES (lvl2_ref, NEW.id, new_manager, 2, ref_code)
        ON CONFLICT DO NOTHING;
      -- nível 3
      SELECT referred_by_id INTO lvl3_ref FROM public.profiles WHERE id = lvl2_ref;
      IF lvl3_ref IS NOT NULL AND lvl3_ref <> NEW.id THEN
        INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
          VALUES (lvl3_ref, NEW.id, new_manager, 3, ref_code)
          ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    INSERT INTO public.referral_logs(referrer_id, referred_id, source_code)
      VALUES (ref_owner, NEW.id, ref_code);
  END IF;

  -- Tema default (mantém comportamento anterior)
  SELECT id INTO default_theme_id FROM public.game_themes WHERE is_default = true LIMIT 1;
  IF default_theme_id IS NOT NULL THEN
    INSERT INTO public.user_theme_inventory (user_id, theme_id, source)
      VALUES (NEW.id, default_theme_id, 'default')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_theme_preferences (user_id, selected_theme_id)
      VALUES (NEW.id, default_theme_id)
      ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 10) Processador de comissões (idempotente por deposit_id)
CREATE OR REPLACE FUNCTION public.process_deposit_commissions(_deposit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dep record;
  is_demo boolean;
  mgr uuid;
  mp record;
  base numeric;
  ref_lvl record;
  used numeric := 0;
  amount_lvl numeric;
  remainder numeric;
BEGIN
  SELECT * INTO dep FROM public.deposits WHERE id = _deposit_id;
  IF dep IS NULL OR dep.status NOT IN ('approved','paid') THEN RETURN; END IF;

  SELECT p.is_demo, p.manager_id INTO is_demo, mgr FROM public.profiles p WHERE p.id = dep.user_id;
  IF is_demo THEN RETURN; END IF;
  IF mgr IS NULL THEN RETURN; END IF;

  SELECT * INTO mp FROM public.manager_profiles WHERE user_id = mgr;
  IF mp IS NULL THEN
    INSERT INTO public.manager_profiles(user_id) VALUES (mgr) RETURNING * INTO mp;
  END IF;

  base := dep.amount;

  FOR ref_lvl IN
    SELECT level, referrer_id FROM public.referrals
    WHERE referred_id = dep.user_id AND manager_id = mgr
    ORDER BY level
  LOOP
    amount_lvl := ROUND(base * (
      CASE ref_lvl.level
        WHEN 1 THEN mp.level1_percent
        WHEN 2 THEN mp.level2_percent
        WHEN 3 THEN mp.level3_percent
      END / 100.0)::numeric, 2);
    IF amount_lvl > 0 THEN
      INSERT INTO public.commissions(affiliate_id, manager_id, source_user_id, base_amount, percentage, amount, status, deposit_id, level)
      VALUES (
        ref_lvl.referrer_id, mgr, dep.user_id, base,
        CASE ref_lvl.level WHEN 1 THEN mp.level1_percent WHEN 2 THEN mp.level2_percent ELSE mp.level3_percent END,
        amount_lvl, 'available', dep.id, ref_lvl.level
      ) ON CONFLICT DO NOTHING;
      used := used + amount_lvl;
    END IF;
  END LOOP;

  -- Restante para o gerente
  remainder := ROUND(base * (mp.total_budget_percent / 100.0)::numeric, 2) - used;
  IF remainder > 0 THEN
    INSERT INTO public.commissions(affiliate_id, manager_id, source_user_id, base_amount, percentage, amount, status, deposit_id, level)
    VALUES (mgr, mgr, dep.user_id, base, mp.total_budget_percent, remainder, 'available', dep.id, 0)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_deposit_commissions(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.process_deposit_commissions(uuid) TO service_role;

-- 11) Platform setting: APP_PUBLIC_URL
INSERT INTO public.platform_settings(key, value, type, description, is_critical)
VALUES ('app_public_url', to_jsonb('https://helixfast.lovable.app'::text), 'string', 'Base URL used for referral links', false)
ON CONFLICT (key) DO NOTHING;
