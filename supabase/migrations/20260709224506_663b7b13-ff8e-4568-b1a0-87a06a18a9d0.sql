-- Allow anyone (anon + authenticated) to read only the helix_difficulty row so the game can subscribe via Realtime.
GRANT SELECT ON public.platform_settings TO anon;

CREATE POLICY "public read helix_difficulty"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (key = 'helix_difficulty');

-- Enable Realtime for platform_settings
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;