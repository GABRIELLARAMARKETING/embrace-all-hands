INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'gerente'::app_role FROM auth.users u WHERE lower(u.email) = 'futfelpzz@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;