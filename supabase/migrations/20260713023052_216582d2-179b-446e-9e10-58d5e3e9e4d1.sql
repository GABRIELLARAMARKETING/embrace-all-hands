
-- Torna helix_create_session tolerante a depósito ausente/inválido.
-- Regra passa a ser: exigir apenas saldo real suficiente. Se um depósito válido
-- for informado, ele é anexado à sessão para auditoria; caso contrário, criamos
-- a sessão sem deposit_id. Isso evita bloqueios após o depósito ser marcado como
-- "spent" ou quando o saldo veio de ajuste admin.

CREATE OR REPLACE FUNCTION public.helix_create_session(_deposit_id uuid, _amount numeric, _theme_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  d record;
  p record;
  payout integer;
  existing uuid;
  new_id uuid;
  expires timestamptz;
  amount_cents integer;
  effective_deposit uuid := NULL;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  amount_cents := ROUND(_amount * 100)::int;
  payout := public.helix_payout_cents(amount_cents);
  IF payout IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_amount');
  END IF;

  -- Perfil primeiro — é o que garante saldo suficiente para a partida.
  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found'); END IF;
  IF COALESCE(p.is_demo, false) THEN RETURN jsonb_build_object('ok', false, 'reason', 'demo_account'); END IF;
  IF COALESCE(p.balance, 0) < _amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance');
  END IF;

  -- Depósito é opcional. Se o cliente enviou um id, tentamos vinculá-lo,
  -- mas nunca bloqueamos a partida caso ele já esteja "spent"/inválido.
  IF _deposit_id IS NOT NULL THEN
    SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
    IF d.user_id = uid
       AND d.status IN ('paid','approved','spent')
       AND d.credited_at IS NOT NULL THEN
      effective_deposit := d.id;
    END IF;
  END IF;

  -- Se nenhum depósito válido veio no request, tentamos localizar o mais
  -- recente do próprio usuário só para efeito de auditoria.
  IF effective_deposit IS NULL THEN
    SELECT id INTO effective_deposit
      FROM public.deposits
     WHERE user_id = uid
       AND status IN ('paid','approved','spent')
       AND credited_at IS NOT NULL
     ORDER BY paid_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  -- Bloqueia se já existe partida ativa não creditada.
  SELECT id INTO existing
    FROM public.game_sessions
   WHERE user_id = uid
     AND credited_at IS NULL
     AND status IN ('active','started')
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_already_active', 'session_id', existing);
  END IF;

  expires := now() + interval '30 minutes';
  INSERT INTO public.game_sessions(
    user_id, theme_id, status, deposit_id,
    payout_per_platform_cents, stake_cents,
    expires_at, idempotency_key
  ) VALUES (
    uid, _theme_id, 'active', effective_deposit,
    payout, amount_cents,
    expires, 'helix_session:' || uid::text || ':' || extract(epoch from clock_timestamp())::bigint::text || ':' || substr(md5(random()::text), 1, 8)
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', new_id,
    'payout_per_platform_cents', payout,
    'stake_cents', amount_cents,
    'deposit_id', effective_deposit,
    'expires_at', expires
  );
END $$;

REVOKE ALL ON FUNCTION public.helix_create_session(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_create_session(uuid, numeric, uuid) TO authenticated, service_role;
