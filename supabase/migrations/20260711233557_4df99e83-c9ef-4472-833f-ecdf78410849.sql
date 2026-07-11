CREATE OR REPLACE FUNCTION public.helix_withdrawal_rules()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  bal_cents integer;
  top_dep_cents integer;
  min_cents integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF public.is_demo_user(uid) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'demo_account',
      'has_deposit', false,
      'available_reward_cents', 0,
      'minimum_withdraw_cents', NULL,
      'can_withdraw', false,
      'missing_to_withdraw_cents', NULL,
      'message', 'Contas demo não podem sacar.'
    );
  END IF;

  SELECT ROUND(COALESCE(balance, 0) * 100)::int
    INTO bal_cents
    FROM public.profiles
   WHERE id = uid;

  -- A referência de saque precisa sobreviver ao jogo: quando a partida termina,
  -- o depósito/crédito usado é marcado como "spent". Se ele já foi confirmado e
  -- creditado, continua sendo uma referência válida para liberar o saque do prêmio.
  SELECT ROUND(MAX(amount) * 100)::int
    INTO top_dep_cents
    FROM public.deposits
   WHERE user_id = uid
     AND status IN ('paid', 'approved', 'spent')
     AND credited_at IS NOT NULL
     AND ROUND(amount * 100)::int IN (500, 1000, 2000, 3000, 5000, 10000);

  IF top_dep_cents IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'has_deposit', false,
      'available_reward_cents', COALESCE(bal_cents, 0),
      'minimum_withdraw_cents', NULL,
      'can_withdraw', false,
      'missing_to_withdraw_cents', NULL,
      'message', 'Faça um depósito confirmado ou receba um crédito jogável do admin para desbloquear saques.'
    );
  END IF;

  min_cents := public.helix_minimum_withdraw_cents(top_dep_cents);

  RETURN jsonb_build_object(
    'ok', true,
    'has_deposit', true,
    'reference_deposit_cents', top_dep_cents,
    'available_reward_cents', COALESCE(bal_cents, 0),
    'minimum_withdraw_cents', min_cents,
    'can_withdraw', min_cents IS NOT NULL AND COALESCE(bal_cents, 0) >= min_cents,
    'missing_to_withdraw_cents', CASE
      WHEN min_cents IS NULL THEN NULL
      ELSE GREATEST(min_cents - COALESCE(bal_cents, 0), 0)
    END
  );
END $$;

REVOKE ALL ON FUNCTION public.helix_withdrawal_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_withdrawal_rules() TO authenticated, service_role;