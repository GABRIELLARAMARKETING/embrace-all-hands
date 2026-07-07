
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  coins integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================
-- GAME_THEMES
-- =========================
CREATE TABLE public.game_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  label text NOT NULL,
  description text,
  category text,
  rarity text NOT NULL DEFAULT 'free',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  unlock_type text NOT NULL DEFAULT 'free',
  unlock_price integer NOT NULL DEFAULT 0,
  min_level integer NOT NULL DEFAULT 0,
  preview_config jsonb NOT NULL,
  gameplay_config jsonb NOT NULL,
  ui_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_themes TO authenticated;
GRANT ALL ON public.game_themes TO service_role;
ALTER TABLE public.game_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active themes are public" ON public.game_themes
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- =========================
-- USER_THEME_INVENTORY
-- =========================
CREATE TABLE public.user_theme_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.game_themes(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'free',
  UNIQUE (user_id, theme_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_theme_inventory TO authenticated;
GRANT ALL ON public.user_theme_inventory TO service_role;
ALTER TABLE public.user_theme_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own inventory" ON public.user_theme_inventory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own inventory" ON public.user_theme_inventory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =========================
-- USER_THEME_PREFERENCES
-- =========================
CREATE TABLE public.user_theme_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_theme_id uuid REFERENCES public.game_themes(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_theme_preferences TO authenticated;
GRANT ALL ON public.user_theme_preferences TO service_role;
ALTER TABLE public.user_theme_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preference" ON public.user_theme_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- GAME_SESSIONS
-- =========================
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  theme_id uuid REFERENCES public.game_themes(id) ON DELETE SET NULL,
  score integer NOT NULL DEFAULT 0,
  level_reached integer NOT NULL DEFAULT 1,
  duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'started',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.game_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.game_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- LIVE_MATCHES
-- =========================
CREATE TABLE public.live_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid REFERENCES public.game_themes(id) ON DELETE SET NULL,
  fake_or_real text NOT NULL DEFAULT 'real',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT SELECT ON public.live_matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_matches TO authenticated;
GRANT ALL ON public.live_matches TO service_role;
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Live matches public read" ON public.live_matches
  FOR SELECT TO anon, authenticated USING (true);

-- =========================
-- updated_at helper
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_themes_updated BEFORE UPDATE ON public.game_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prefs_updated BEFORE UPDATE ON public.user_theme_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Auto-provision profile + default theme on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE default_theme_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

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
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
