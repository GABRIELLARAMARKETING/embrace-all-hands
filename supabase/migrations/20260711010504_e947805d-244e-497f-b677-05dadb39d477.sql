
-- Credita manualmente R$ 5,00 para ALCIDES LUIZ (deposit não vinculado por divergência de checkout)
DO $$
DECLARE
  v_user uuid := '7556ef41-3238-4d85-8717-290d25b676cb';
  v_amount numeric := 5.00;
  v_before numeric;
  v_after numeric;
  v_dep uuid;
BEGIN
  SELECT coins INTO v_before FROM public.profiles WHERE id = v_user FOR UPDATE;
  v_after := COALESCE(v_before,0) + v_amount;

  INSERT INTO public.deposits (user_id, amount, status, provider, payment_method, external_id, paid_at, credited_at, confirmed_at)
  VALUES (v_user, v_amount, 'paid', 'manual', 'pix', 'manual-alcides-20260711-5', now(), now(), now())
  RETURNING id INTO v_dep;

  UPDATE public.profiles SET coins = v_after, updated_at = now() WHERE id = v_user;

  INSERT INTO public.wallet_transactions (user_id, deposit_id, type, amount, balance_before, balance_after, status, description)
  VALUES (v_user, v_dep, 'deposit', v_amount, COALESCE(v_before,0), v_after, 'completed', 'Crédito manual: depósito Diggion R$5 (customer estimaofc@gmail.com)');
END $$;
