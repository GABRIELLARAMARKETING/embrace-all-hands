CREATE POLICY "Self assign gerente role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'gerente'::app_role);