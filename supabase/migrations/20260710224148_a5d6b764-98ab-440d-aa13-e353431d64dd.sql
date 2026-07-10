
-- Trigger: log de comissões criadas
CREATE OR REPLACE FUNCTION public.audit_commission_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_audit_event(
    _event_type := 'COMMISSION_CREATED',
    _module := 'commissions',
    _severity := 'success',
    _title := format('Comissão nível %s: R$ %s', NEW.level, NEW.amount),
    _message := NULL,
    _metadata := jsonb_build_object(
      'level', NEW.level,
      'amount', NEW.amount,
      'percentage', NEW.percentage,
      'base_amount', NEW.base_amount,
      'affiliate_id', NEW.affiliate_id,
      'manager_id', NEW.manager_id,
      'source_user_id', NEW.source_user_id,
      'deposit_id', NEW.deposit_id
    ),
    _entity_type := 'commission',
    _entity_id := NEW.id::text,
    _user_id := NEW.affiliate_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_commission_created ON public.commissions;
CREATE TRIGGER trg_audit_commission_created
  AFTER INSERT ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_commission_created();

-- Trigger: log de sessão Helix finalizada com recompensa
CREATE OR REPLACE FUNCTION public.audit_helix_session_finished()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credited_at IS NOT NULL AND OLD.credited_at IS NULL THEN
    PERFORM public.log_audit_event(
      _event_type := CASE WHEN NEW.status = 'gameover' THEN 'HELIX_SESSION_GAMEOVER' ELSE 'HELIX_SESSION_FINISHED' END,
      _module := 'helix',
      _severity := CASE WHEN NEW.reward_cents > 0 THEN 'success' ELSE 'info' END,
      _title := format('Sessão Helix finalizada: %s plataformas / R$ %s',
                       COALESCE(NEW.validated_platforms_passed, 0),
                       (COALESCE(NEW.reward_cents, 0) / 100.0)::numeric(10,2)),
      _metadata := jsonb_build_object(
        'session_id', NEW.id,
        'deposit_id', NEW.deposit_id,
        'status', NEW.status,
        'validated_platforms_passed', NEW.validated_platforms_passed,
        'payout_per_platform_cents', NEW.payout_per_platform_cents,
        'reward_cents', NEW.reward_cents,
        'anti_fraud_score', NEW.anti_fraud_score
      ),
      _entity_type := 'game_session',
      _entity_id := NEW.id::text,
      _user_id := NEW.user_id,
      _status := NEW.status
    );

    -- Sinaliza alerta se houver score anti-fraude relevante
    IF COALESCE(NEW.anti_fraud_score, 0) >= 3 THEN
      PERFORM public.log_audit_event(
        _event_type := 'HELIX_ANTIFRAUD_ALERT',
        _module := 'helix',
        _severity := 'warning',
        _title := format('Anti-fraude Helix: score %s na sessão %s', NEW.anti_fraud_score, NEW.id),
        _metadata := jsonb_build_object(
          'session_id', NEW.id,
          'anti_fraud_score', NEW.anti_fraud_score,
          'validated_platforms_passed', NEW.validated_platforms_passed,
          'platforms_passed', NEW.platforms_passed
        ),
        _entity_type := 'game_session',
        _entity_id := NEW.id::text,
        _user_id := NEW.user_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_helix_session_finished ON public.game_sessions;
CREATE TRIGGER trg_audit_helix_session_finished
  AFTER UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_helix_session_finished();
