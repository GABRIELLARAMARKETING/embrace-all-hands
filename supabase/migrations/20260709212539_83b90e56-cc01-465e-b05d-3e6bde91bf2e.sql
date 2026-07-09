UPDATE public.game_themes SET is_default = false WHERE slug <> 'candy';
UPDATE public.game_themes SET is_active = false WHERE slug <> 'candy';
UPDATE public.game_themes SET is_active = true, is_default = true WHERE slug = 'candy';