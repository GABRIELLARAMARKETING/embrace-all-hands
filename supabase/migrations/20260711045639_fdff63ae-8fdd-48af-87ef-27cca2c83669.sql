ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY['deposit','withdraw','commission','adjustment','refund','game_reward','game_loss']));

CREATE OR REPLACE FUNCTION public.helix_abandon_active_sessions(_grace_seconds int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  s record;
  abandoned int := 0;
  finish_reason text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  FOR s IN
    SELECT id, status
      FROM public.game_sessions
     WHERE user_id = uid
       AND credited_at IS NULL
       AND deposit_id IS NOT NULL
       AND (
         (status IN ('active','started') AND created_at < now() - make_interval(secs => _grace_seconds))
         OR status IN ('gameover','finished')
       )
  LOOP
    finish_reason := CASE WHEN s.status = 'finished' THEN 'player_finished' ELSE 'player_lost' END;
    PERFORM public.helix_finish_session(s.id, finish_reason);
    abandoned := abandoned + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'abandoned', abandoned);
END $$;

REVOKE ALL ON FUNCTION public.helix_abandon_active_sessions(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helix_abandon_active_sessions(int) TO authenticated, service_role;

DO $$
DECLARE
  r record;
  bal_before numeric(14,2);
  new_bal numeric(14,2);
  dep_amt numeric(14,2);
  validated int;
  reward_c int;
  reward_reais numeric(14,2);
  actual_delta numeric(14,2);
  tx_type text;
BEGIN
  FOR r IN
    SELECT gs.id AS session_id,
           gs.user_id,
           gs.deposit_id,
           gs.status,
           gs.payout_per_platform_cents
      FROM public.game_sessions gs
     WHERE gs.credited_at IS NULL
       AND gs.deposit_id IS NOT NULL
       AND gs.status IN ('gameover','finished')
  LOOP
    SELECT COALESCE(balance, 0)::numeric(14,2)
      INTO bal_before
      FROM public.profiles
     WHERE id = r.user_id
     FOR UPDATE;

    SELECT amount::numeric(14,2)
      INTO dep_amt
      FROM public.deposits
     WHERE id = r.deposit_id;

    IF r.status = 'gameover' THEN
      validated := 0;
      reward_c := 0;
      reward_reais := 0;
      new_bal := 0::numeric(14,2);
      tx_type := 'game_loss';
    ELSE
      SELECT COUNT(*) INTO validated
        FROM public.helix_platform_events e
       WHERE e.session_id = r.session_id
         AND e.is_valid = true;
      reward_c := CASE
        WHEN COALESCE(r.payout_per_platform_cents, 0) > 0 AND validated > 0
          THEN validated * r.payout_per_platform_cents
        ELSE 0
      END;
      reward_reais := (reward_c / 100.0)::numeric(14,2);
      new_bal := (GREATEST(bal_before - COALESCE(dep_amt, 0), 0) + reward_reais)::numeric(14,2);
      tx_type := CASE WHEN reward_c > 0 THEN 'game_reward' ELSE 'game_loss' END;
    END IF;

    actual_delta := (new_bal - bal_before)::numeric(14,2);

    IF bal_before IS DISTINCT FROM new_bal THEN
      UPDATE public.profiles
         SET balance = new_bal,
             updated_at = now()
       WHERE id = r.user_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions wt
       WHERE wt.deposit_id = r.deposit_id
         AND wt.user_id = r.user_id
         AND wt.type IN ('game_loss','game_reward')
    ) THEN
      INSERT INTO public.wallet_transactions(
        user_id, deposit_id, type, amount, balance_before, balance_after, description
      ) VALUES (
        r.user_id,
        r.deposit_id,
        tx_type,
        actual_delta,
        bal_before,
        new_bal,
        CASE
          WHEN r.status = 'gameover' THEN 'Correção automática: game-over Helix conciliado e saldo zerado'
          WHEN reward_c > 0 THEN 'Correção automática: partida Helix conciliada com recompensa'
          ELSE 'Correção automática: partida Helix conciliada sem recompensa'
        END
      );
    END IF;

    UPDATE public.game_sessions
       SET credited_at = now(),
           finished_at = COALESCE(finished_at, now()),
           validated_platforms_passed = COALESCE(validated_platforms_passed, validated),
           reward_cents = COALESCE(reward_cents, reward_c)
     WHERE id = r.session_id;
  END LOOP;
END $$;