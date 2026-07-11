CREATE OR REPLACE FUNCTION public.helix_finish_session(_session_id uuid, _reason text DEFAULT 'player_finished'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  s record;
  p record;
  validated int;
  reward_c int;
  reward_reais numeric(14,2);
  new_bal numeric(14,2);
  dep_amt_cents int;
  dep_amt numeric(14,2);
  bal_before numeric(14,2);
  actual_delta numeric(14,2);
  is_gameover boolean;
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
    RETURN jsonb_build_object(
      'ok', true,
      'reason', 'already_finished',
      'session_id', s.id,
      'validated_platforms_passed', s.validated_platforms_passed,
      'reward_cents', s.reward_cents
    );
  END IF;

  is_gameover := (_reason = 'player_lost');

  SELECT COUNT(*) INTO validated
    FROM public.helix_platform_events e
   WHERE e.session_id = s.id
     AND e.is_valid = true;

  SELECT ROUND(amount * 100)::int, amount::numeric(14,2)
    INTO dep_amt_cents, dep_amt
    FROM public.deposits
   WHERE id = s.deposit_id;

  SELECT * INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  bal_before := COALESCE(p.balance, 0)::numeric(14,2);

  IF is_gameover THEN
    reward_c := 0;
    reward_reais := 0;
    -- Regra do produto: em game-over/abandono, o saldo jogável deve zerar.
    new_bal := 0::numeric(14,2);
    tx_type := 'game_loss';
  ELSE
    reward_c := CASE
      WHEN s.payout_per_platform_cents > 0 AND validated > 0
        THEN validated * s.payout_per_platform_cents
      ELSE 0
    END;
    reward_reais := (reward_c / 100.0)::numeric(14,2);
    -- O depósito pago foi a entrada da partida: ao terminar, ele é consumido.
    -- Mantém apenas outros saldos já existentes e a recompensa desta sessão.
    new_bal := (GREATEST(bal_before - COALESCE(dep_amt, 0), 0) + reward_reais)::numeric(14,2);
    tx_type := CASE WHEN reward_c > 0 THEN 'game_reward' ELSE 'game_loss' END;
  END IF;

  actual_delta := (new_bal - bal_before)::numeric(14,2);

  IF bal_before IS DISTINCT FROM new_bal THEN
    UPDATE public.profiles
       SET balance = new_bal,
           updated_at = now()
     WHERE id = uid;
  END IF;

  INSERT INTO public.wallet_transactions(
    user_id, deposit_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    uid,
    s.deposit_id,
    tx_type,
    actual_delta,
    bal_before,
    new_bal,
    CASE
      WHEN is_gameover AND actual_delta = 0 THEN 'Game over Helix - saldo já estava zerado'
      WHEN is_gameover THEN 'Perda Helix - saldo zerado (R$ ' || to_char(-actual_delta, 'FM999999990.00') || ')'
      WHEN reward_c > 0 THEN 'Partida Helix finalizada - entrada consumida e recompensa de R$ ' || to_char(reward_reais, 'FM999999990.00')
      ELSE 'Partida Helix finalizada - entrada consumida sem recompensa'
    END
  );

  UPDATE public.game_sessions
     SET status = CASE WHEN is_gameover THEN 'gameover' ELSE 'finished' END,
         validated_platforms_passed = validated,
         reward_cents = reward_c,
         credited_at = now(),
         finished_at = now()
   WHERE id = s.id;

  UPDATE public.deposits
     SET status = 'spent',
         updated_at = now()
   WHERE id = s.deposit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', s.id,
    'deposit_amount_cents', dep_amt_cents,
    'payout_per_platform_cents', s.payout_per_platform_cents,
    'validated_platforms_passed', validated,
    'reward_cents', reward_c,
    'new_balance', new_bal,
    'lost', is_gameover
  );
END
$function$;

REVOKE ALL ON FUNCTION public.helix_finish_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_finish_session(uuid, text) TO authenticated, service_role;