-- 1. Atualiza handle_new_user para copiar email/phone/cpf para profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF ref_code IS NOT NULL THEN
    SELECT id, manager_id INTO ref_owner, ref_owner_manager
      FROM public.profiles WHERE affiliate_code = ref_code LIMIT 1;
    IF ref_owner = NEW.id THEN ref_owner := NULL; END IF;
  END IF;

  IF ref_owner IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = ref_owner AND role IN ('gerente','admin','super_admin')) THEN
      new_manager := ref_owner;
    ELSE
      new_manager := ref_owner_manager;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, display_name, full_name, email, phone, cpf,
    referred_by_id, manager_id, is_influencer
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    NULLIF(NEW.raw_user_meta_data->>'display_name',''),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone',''), NEW.phone),
    NULLIF(NEW.raw_user_meta_data->>'cpf',''),
    ref_owner, new_manager, false
  );

  INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'jogador') ON CONFLICT DO NOTHING;

  IF ref_owner IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
      VALUES (ref_owner, NEW.id, new_manager, 1, ref_code) ON CONFLICT DO NOTHING;
    SELECT referred_by_id INTO lvl2_ref FROM public.profiles WHERE id = ref_owner;
    IF lvl2_ref IS NOT NULL AND lvl2_ref <> NEW.id THEN
      INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
        VALUES (lvl2_ref, NEW.id, new_manager, 2, ref_code) ON CONFLICT DO NOTHING;
      SELECT referred_by_id INTO lvl3_ref FROM public.profiles WHERE id = lvl2_ref;
      IF lvl3_ref IS NOT NULL AND lvl3_ref <> NEW.id THEN
        INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
          VALUES (lvl3_ref, NEW.id, new_manager, 3, ref_code) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
    INSERT INTO public.referral_logs(referrer_id, referred_id, source_code)
      VALUES (ref_owner, NEW.id, ref_code);
  END IF;

  SELECT id INTO default_theme_id FROM public.game_themes WHERE is_default = true LIMIT 1;
  IF default_theme_id IS NOT NULL THEN
    INSERT INTO public.user_theme_inventory (user_id, theme_id, source)
      VALUES (NEW.id, default_theme_id, 'default') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_theme_preferences (user_id, selected_theme_id)
      VALUES (NEW.id, default_theme_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- 2. Backfill dos perfis existentes a partir de auth.users
UPDATE public.profiles p
   SET email = COALESCE(p.email, u.email),
       phone = COALESCE(p.phone, NULLIF(u.raw_user_meta_data->>'phone',''), u.phone),
       cpf   = COALESCE(p.cpf,   NULLIF(u.raw_user_meta_data->>'cpf',''))
  FROM auth.users u
 WHERE u.id = p.id
   AND (p.email IS NULL OR p.phone IS NULL OR p.cpf IS NULL);