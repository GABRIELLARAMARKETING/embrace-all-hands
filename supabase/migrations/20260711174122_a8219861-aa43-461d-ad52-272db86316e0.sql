
-- 1) Campo de saldo demo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_balance numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.demo_balance IS
  'Saldo demo/promocional criado por gerente. Nunca sacável, nunca convertível em saldo real, nunca gera comissão.';
COMMENT ON COLUMN public.profiles.is_demo IS
  'Marca conta como demo. Contas demo não podem sacar, não geram comissão e não recebem depósito real.';

-- 2) Endurecer a trigger que protege campos financeiros
CREATE OR REPLACE FUNCTION public.protect_profile_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.affiliate_balance IS DISTINCT FROM OLD.affiliate_balance
       OR NEW.coins            IS DISTINCT FROM OLD.coins
       OR NEW.level            IS DISTINCT FROM OLD.level
       OR NEW.total_received   IS DISTINCT FROM OLD.total_received
       OR NEW.status           IS DISTINCT FROM OLD.status
       OR NEW.manager_id       IS DISTINCT FROM OLD.manager_id
       OR NEW.is_demo          IS DISTINCT FROM OLD.is_demo
       OR NEW.demo_balance     IS DISTINCT FROM OLD.demo_balance THEN
      RAISE EXCEPTION 'Alteração de campos protegidos não permitida.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Helper: usuário é demo?
CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_demo FROM public.profiles WHERE id = _user_id), false)
$$;

-- 4) Bloqueia depósito real em conta demo (defesa em profundidade)
CREATE OR REPLACE FUNCTION public.credit_deposit_atomic(_deposit_id uuid, _expected_amount numeric, _provider_tx_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  p record;
  new_balance numeric(14,2);
  allowed_amounts numeric[] := ARRAY[5,10,20,30,50,100]::numeric[];
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  END IF;

  IF d.credited_at IS NOT NULL OR d.status IN ('paid','approved') THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited', 'deposit_id', d.id);
  END IF;

  IF public.is_demo_user(d.user_id) THEN
    UPDATE public.deposits
       SET status = 'failed',
           last_error = 'demo account cannot receive real deposit',
           updated_at = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'demo_account_blocked');
  END IF;

  IF NOT (ROUND(d.amount::numeric,2) = ANY(allowed_amounts)) THEN
    UPDATE public.deposits
       SET status = 'failed',
           last_error = format('unsupported deposit amount: %s', d.amount),
           updated_at = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount', 'amount', d.amount);
  END IF;

  IF _expected_amount IS NOT NULL AND ROUND(d.amount::numeric,2) <> ROUND(_expected_amount::numeric,2) THEN
    UPDATE public.deposits
       SET last_error = format('amount mismatch: expected %s got %s', d.amount, _expected_amount),
           updated_at = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;

  IF _provider_tx_id IS NOT NULL AND d.external_id IS NOT NULL AND d.external_id <> _provider_tx_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_tx_mismatch');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = d.user_id FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  new_balance := COALESCE(p.balance,0) + d.amount;

  UPDATE public.profiles SET balance = new_balance, updated_at = now() WHERE id = p.id;

  UPDATE public.deposits
     SET status = 'paid',
         paid_at = COALESCE(d.paid_at, now()),
         credited_at = now(),
         external_id = COALESCE(d.external_id, _provider_tx_id),
         updated_at = now(),
         last_error = null
   WHERE id = d.id;

  INSERT INTO public.wallet_transactions(user_id, deposit_id, type, amount, balance_before, balance_after, description)
  VALUES (p.id, d.id, 'deposit', d.amount, COALESCE(p.balance,0), new_balance, 'Depósito PIX confirmado - ' || d.provider)
  ON CONFLICT DO NOTHING;

  PERFORM public.process_deposit_commissions(d.id);

  RETURN jsonb_build_object('ok', true, 'deposit_id', d.id, 'amount', d.amount, 'new_balance', new_balance);
END;
$$;

-- 5) Bloqueio de saque para conta demo
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

  SELECT ROUND(COALESCE(balance, 0) * 100)::int INTO bal_cents
    FROM public.profiles WHERE id = uid;

  SELECT ROUND(MAX(amount) * 100)::int INTO top_dep_cents
    FROM public.deposits
    WHERE user_id = uid AND status IN ('paid', 'approved') AND provider <> 'admin_manual';

  IF top_dep_cents IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'has_deposit', false,
      'available_reward_cents', COALESCE(bal_cents, 0),
      'minimum_withdraw_cents', NULL,
      'can_withdraw', false,
      'missing_to_withdraw_cents', NULL,
      'message', 'Faça um depósito para desbloquear saques.'
    );
  END IF;

  min_cents := public.helix_minimum_withdraw_cents(top_dep_cents);

  RETURN jsonb_build_object(
    'ok', true,
    'has_deposit', true,
    'reference_deposit_cents', top_dep_cents,
    'available_reward_cents', COALESCE(bal_cents, 0),
    'minimum_withdraw_cents', min_cents,
    'can_withdraw', COALESCE(bal_cents, 0) >= min_cents,
    'missing_to_withdraw_cents', GREATEST(min_cents - COALESCE(bal_cents, 0), 0)
  );
END $$;

-- 6) helix_finish_session — creditar em demo_balance quando is_demo
CREATE OR REPLACE FUNCTION public.helix_finish_session(_session_id uuid, _reason text DEFAULT 'player_finished'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s record;
  p record;
  validated int;
  reward_c int;
  reward_reais numeric(14,2);
  new_bal numeric(14,2);
  new_demo_bal numeric(14,2);
  dep_amt_cents int;
  dep_amt numeric(14,2);
  bal_before numeric(14,2);
  demo_before numeric(14,2);
  actual_delta numeric(14,2);
  is_gameover boolean;
  is_demo boolean;
  tx_type text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO s FROM public.game_sessions WHERE id = _session_id FOR UPDATE;
  IF s IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found');
  END IF;
  IF s.user_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF s.credited_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_finished',
      'session_id', s.id,
      'validated_platforms_passed', s.validated_platforms_passed,
      'reward_cents', s.reward_cents);
  END IF;

  is_gameover := (_reason = 'player_lost');

  SELECT COUNT(*) INTO validated
    FROM public.helix_platform_events e
   WHERE e.session_id = s.id AND e.is_valid = true;

  SELECT ROUND(amount * 100)::int, amount::numeric(14,2)
    INTO dep_amt_cents, dep_amt
    FROM public.deposits WHERE id = s.deposit_id;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  is_demo := COALESCE(p.is_demo, false);
  bal_before := COALESCE(p.balance, 0)::numeric(14,2);
  demo_before := COALESCE(p.demo_balance, 0)::numeric(14,2);

  IF is_gameover THEN
    reward_c := 0;
    reward_reais := 0;
    tx_type := 'game_loss';
  ELSE
    reward_c := CASE
      WHEN s.payout_per_platform_cents > 0 AND validated > 0
        THEN validated * s.payout_per_platform_cents
      ELSE 0 END;
    reward_reais := (reward_c / 100.0)::numeric(14,2);
    tx_type := CASE WHEN reward_c > 0 THEN 'game_reward' ELSE 'game_loss' END;
  END IF;

  IF is_demo THEN
    -- Conta demo: consome demo_balance como entrada e credita recompensa em demo_balance.
    -- Nunca toca profiles.balance.
    IF is_gameover THEN
      new_demo_bal := GREATEST(demo_before - COALESCE(dep_amt, 0), 0)::numeric(14,2);
    ELSE
      new_demo_bal := (GREATEST(demo_before - COALESCE(dep_amt, 0), 0) + reward_reais)::numeric(14,2);
    END IF;
    actual_delta := (new_demo_bal - demo_before)::numeric(14,2);

    IF demo_before IS DISTINCT FROM new_demo_bal THEN
      UPDATE public.profiles
         SET demo_balance = new_demo_bal, updated_at = now()
       WHERE id = uid;
    END IF;

    INSERT INTO public.wallet_transactions(
      user_id, deposit_id, type, amount, balance_before, balance_after, description
    ) VALUES (
      uid, s.deposit_id,
      CASE WHEN is_gameover THEN 'demo_game_loss'
           WHEN reward_c > 0 THEN 'demo_game_reward'
           ELSE 'demo_game_loss' END,
      actual_delta, demo_before, new_demo_bal,
      'DEMO — não sacável — ' || CASE WHEN is_gameover THEN 'perda' WHEN reward_c > 0 THEN 'recompensa demo R$ ' || to_char(reward_reais, 'FM999999990.00') ELSE 'sem recompensa' END
    );
    new_bal := bal_before;
  ELSE
    IF is_gameover THEN
      new_bal := 0::numeric(14,2);
    ELSE
      new_bal := (GREATEST(bal_before - COALESCE(dep_amt, 0), 0) + reward_reais)::numeric(14,2);
    END IF;
    actual_delta := (new_bal - bal_before)::numeric(14,2);

    IF bal_before IS DISTINCT FROM new_bal THEN
      UPDATE public.profiles SET balance = new_bal, updated_at = now() WHERE id = uid;
    END IF;

    INSERT INTO public.wallet_transactions(
      user_id, deposit_id, type, amount, balance_before, balance_after, description
    ) VALUES (
      uid, s.deposit_id, tx_type, actual_delta, bal_before, new_bal,
      CASE
        WHEN is_gameover AND actual_delta = 0 THEN 'Game over Helix - saldo já estava zerado'
        WHEN is_gameover THEN 'Perda Helix - saldo zerado (R$ ' || to_char(-actual_delta, 'FM999999990.00') || ')'
        WHEN reward_c > 0 THEN 'Partida Helix finalizada - entrada consumida e recompensa de R$ ' || to_char(reward_reais, 'FM999999990.00')
        ELSE 'Partida Helix finalizada - entrada consumida sem recompensa'
      END
    );
  END IF;

  UPDATE public.game_sessions
     SET status = CASE WHEN is_gameover THEN 'gameover' ELSE 'finished' END,
         validated_platforms_passed = validated,
         reward_cents = reward_c,
         credited_at = now(),
         finished_at = now()
   WHERE id = s.id;

  UPDATE public.deposits SET updated_at = now() WHERE id = s.deposit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', s.id,
    'is_demo', is_demo,
    'deposit_amount_cents', dep_amt_cents,
    'payout_per_platform_cents', s.payout_per_platform_cents,
    'validated_platforms_passed', validated,
    'reward_cents', reward_c,
    'new_balance', new_bal,
    'new_demo_balance', COALESCE(new_demo_bal, demo_before),
    'lost', is_gameover
  );
END
$$;

-- 7) RPC para o gerente creditar saldo demo em um usuário demo vinculado
CREATE OR REPLACE FUNCTION public.manager_credit_demo_balance(
  _target_user_id uuid,
  _amount numeric,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  target record;
  before_bal numeric(14,2);
  after_bal  numeric(14,2);
  is_mgr boolean;
  is_admin_role boolean;
  MAX_CREDIT constant numeric := 1000;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF _amount > MAX_CREDIT THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'above_max', 'max', MAX_CREDIT);
  END IF;

  is_admin_role := public.is_admin(caller);
  is_mgr := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = caller AND role = 'gerente');
  IF NOT (is_admin_role OR is_mgr) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO target FROM public.profiles WHERE id = _target_user_id FOR UPDATE;
  IF target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target_not_found');
  END IF;
  IF NOT COALESCE(target.is_demo, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target_not_demo');
  END IF;
  IF NOT is_admin_role AND target.manager_id IS DISTINCT FROM caller THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_your_demo');
  END IF;

  before_bal := COALESCE(target.demo_balance, 0)::numeric(14,2);
  after_bal := (before_bal + _amount)::numeric(14,2);

  UPDATE public.profiles
     SET demo_balance = after_bal, updated_at = now()
   WHERE id = target.id;

  INSERT INTO public.wallet_transactions(
    user_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    target.id, 'demo_credit', _amount, before_bal, after_bal,
    'DEMO — não sacável — crédito por gerente ' || caller::text ||
      COALESCE(' — ' || _reason, '')
  );

  PERFORM public.log_audit_event(
    _event_type := 'MANAGER_DEMO_BALANCE_ADDED',
    _module := 'demo_accounts',
    _severity := 'info',
    _title := format('Saldo demo +R$ %s', _amount),
    _metadata := jsonb_build_object(
      'target_user_id', target.id,
      'manager_id', caller,
      'amount', _amount,
      'balance_before', before_bal,
      'balance_after', after_bal,
      'reason', _reason,
      'withdrawable', false
    ),
    _entity_type := 'profile',
    _entity_id := target.id::text,
    _user_id := caller
  );

  RETURN jsonb_build_object(
    'ok', true,
    'target_user_id', target.id,
    'demo_balance_before', before_bal,
    'demo_balance_after', after_bal,
    'withdrawable', false
  );
END $$;

GRANT EXECUTE ON FUNCTION public.manager_credit_demo_balance(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_user(uuid) TO authenticated;
