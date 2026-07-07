
-- Remove broad public read on live_matches (exposed sensitive fake_or_real column)
DROP POLICY IF EXISTS "Live matches public read" ON public.live_matches;
REVOKE SELECT ON public.live_matches FROM anon, authenticated;

-- Safe public view that excludes the sensitive fake_or_real column
CREATE OR REPLACE VIEW public.live_matches_public
WITH (security_invoker = true) AS
SELECT id, status, theme_id, created_at, expires_at
FROM public.live_matches
WHERE status = 'active';

GRANT SELECT ON public.live_matches_public TO anon, authenticated;

-- Owner-less table still needs a narrow policy so the view (security_invoker) can read
CREATE POLICY "Live matches safe columns via view"
ON public.live_matches
FOR SELECT
TO anon, authenticated
USING (true);

-- But hide fake_or_real by revoking column-level select on that column
REVOKE SELECT (fake_or_real) ON public.live_matches FROM anon, authenticated;
GRANT SELECT (id, status, theme_id, created_at, expires_at) ON public.live_matches TO anon, authenticated;
