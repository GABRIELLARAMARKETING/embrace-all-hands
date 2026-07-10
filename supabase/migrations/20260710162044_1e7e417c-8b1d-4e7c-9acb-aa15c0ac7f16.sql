
-- Índice de lookup de código (garante unicidade também)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_affiliate_code_uidx
  ON public.profiles (affiliate_code) WHERE affiliate_code IS NOT NULL;

-- Tabela de cliques
CREATE TABLE public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_type text NOT NULL DEFAULT 'unknown', -- 'gerente'|'afiliado'|'usuario'|'unknown'
  tracking_id text NOT NULL,
  ip_hash text,
  user_agent text,
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  converted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX referral_clicks_owner_idx    ON public.referral_clicks (owner_user_id, created_at DESC);
CREATE INDEX referral_clicks_code_idx     ON public.referral_clicks (code, created_at DESC);
CREATE INDEX referral_clicks_tid_idx      ON public.referral_clicks (tracking_id);
CREATE INDEX referral_clicks_iphash_idx   ON public.referral_clicks (ip_hash, created_at DESC);
CREATE INDEX referral_clicks_converted_idx ON public.referral_clicks (converted_at DESC) WHERE converted_user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.referral_clicks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_clicks TO authenticated;
GRANT ALL ON public.referral_clicks TO service_role;

ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante pode registrar clique (anon precisa para tracking pré-cadastro)
CREATE POLICY "anon insert click" ON public.referral_clicks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Dono do link vê os próprios cliques + admin vê tudo
CREATE POLICY "owner or admin read" ON public.referral_clicks
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Update permitido só para admin / service_role (conversão vem de serverFn com bearer)
CREATE POLICY "admin update" ON public.referral_clicks
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_clicks;

-- Anti-fraude: cria alerta quando um IP produz muitos cadastros em 24h
CREATE OR REPLACE FUNCTION public.referral_click_flag_ip_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.converted_user_id IS NULL OR NEW.ip_hash IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.converted_user_id IS NOT NULL THEN
    RETURN NEW; -- já era conversão, não reprocessar
  END IF;

  SELECT count(DISTINCT converted_user_id) INTO cnt
    FROM public.referral_clicks
   WHERE ip_hash = NEW.ip_hash
     AND converted_user_id IS NOT NULL
     AND converted_at > now() - interval '24 hours';

  IF cnt >= 3 THEN
    INSERT INTO public.risk_alerts (user_id, type, severity, title, description)
    VALUES (
      NEW.converted_user_id,
      'referral_ip_abuse',
      'high',
      'Múltiplos cadastros por indicação no mesmo IP',
      format('IP hash %s produziu %s cadastros nas últimas 24h.', NEW.ip_hash, cnt)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER referral_clicks_flag_ip
AFTER UPDATE OF converted_user_id ON public.referral_clicks
FOR EACH ROW EXECUTE FUNCTION public.referral_click_flag_ip_abuse();
