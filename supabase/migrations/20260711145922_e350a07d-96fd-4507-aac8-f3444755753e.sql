DROP POLICY "admin inserts manager profile" ON public.manager_profiles;
CREATE POLICY "admin inserts manager profile" ON public.manager_profiles FOR INSERT WITH CHECK (is_admin(auth.uid()));
DROP POLICY "manager updates own profile" ON public.manager_profiles;
CREATE POLICY "manager updates own profile" ON public.manager_profiles FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));