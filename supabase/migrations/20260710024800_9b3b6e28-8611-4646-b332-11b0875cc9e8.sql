DELETE FROM auth.users WHERE id IN (
  SELECT id FROM public.profiles
  WHERE display_name ~ '^test[0-9]+$'
     OR display_name LIKE 'scanner%'
);