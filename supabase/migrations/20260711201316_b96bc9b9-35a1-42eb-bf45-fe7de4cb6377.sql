
-- ============================================================
-- IMPERSONATION SESSIONS
-- ============================================================
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_role text,
  reason text NOT NULL,
  mode text NOT NULL DEFAULT 'read_only',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  ip text,
  user_agent text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT impersonation_status_valid CHECK (status IN ('active','ended','expired','revoked','failed')),
  CONSTRAINT impersonation_mode_valid   CHECK (mode   IN ('read_only','support_limited'))
);

GRANT SELECT ON public.impersonation_sessions TO authenticated;
GRANT ALL    ON public.impersonation_sessions TO service_role;

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read impersonation sessions"
  ON public.impersonation_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_impersonation_sessions_admin  ON public.impersonation_sessions(admin_user_id, started_at DESC);
CREATE INDEX idx_impersonation_sessions_target ON public.impersonation_sessions(target_user_id, started_at DESC);
CREATE INDEX idx_impersonation_sessions_status ON public.impersonation_sessions(status);

CREATE TRIGGER trg_impersonation_sessions_updated
  BEFORE UPDATE ON public.impersonation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- IMPERSONATION AUDIT LOGS
-- ============================================================
CREATE TABLE public.impersonation_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonation_session_id uuid NOT NULL REFERENCES public.impersonation_sessions(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL,
  route text,
  method text,
  status_code integer,
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.impersonation_audit_logs TO authenticated;
GRANT ALL    ON public.impersonation_audit_logs TO service_role;

ALTER TABLE public.impersonation_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read impersonation audit logs"
  ON public.impersonation_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_impersonation_audit_session ON public.impersonation_audit_logs(impersonation_session_id, created_at DESC);
CREATE INDEX idx_impersonation_audit_admin   ON public.impersonation_audit_logs(admin_user_id, created_at DESC);
CREATE INDEX idx_impersonation_audit_target  ON public.impersonation_audit_logs(target_user_id, created_at DESC);

-- ============================================================
-- RPC: impersonation_start
-- ============================================================
CREATE OR REPLACE FUNCTION public.impersonation_start(
  _target_user_id uuid,
  _reason text,
  _confirmation text,
  _mode text DEFAULT 'read_only',
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _ttl_minutes int DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  target_exists boolean;
  recent_count int;
  new_id uuid;
  target_role_txt text;
  ttl int := GREATEST(1, LEAST(60, COALESCE(_ttl_minutes, 15)));
  expires timestamptz;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(caller, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _target_user_id IS NULL OR _target_user_id = caller THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_target');
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  IF upper(btrim(COALESCE(_confirmation, ''))) <> 'ENTRAR COMO USUÁRIO' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'confirmation_required');
  END IF;
  IF _mode NOT IN ('read_only', 'support_limited') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_mode');
  END IF;

  SELECT true INTO target_exists FROM public.profiles WHERE id = _target_user_id;
  IF NOT COALESCE(target_exists, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target_not_found');
  END IF;

  IF public.has_role(_target_user_id, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_impersonate_super_admin');
  END IF;

  SELECT count(*) INTO recent_count
    FROM public.impersonation_sessions
   WHERE admin_user_id = caller
     AND started_at > now() - interval '1 hour';
  IF recent_count >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  UPDATE public.impersonation_sessions
     SET status = 'revoked', ended_at = now()
   WHERE admin_user_id = caller AND status = 'active';

  SELECT role::text INTO target_role_txt
    FROM public.user_roles
   WHERE user_id = _target_user_id
   ORDER BY CASE role::text
     WHEN 'super_admin' THEN 0
     WHEN 'admin'       THEN 1
     WHEN 'gerente'     THEN 2
     ELSE 3
   END
   LIMIT 1;

  expires := now() + make_interval(mins => ttl);

  INSERT INTO public.impersonation_sessions (
    admin_user_id, target_user_id, target_role, reason, mode,
    expires_at, ip, user_agent
  ) VALUES (
    caller, _target_user_id, target_role_txt, btrim(_reason), _mode,
    expires, _ip, _user_agent
  ) RETURNING id INTO new_id;

  INSERT INTO public.impersonation_audit_logs (
    impersonation_session_id, admin_user_id, target_user_id,
    action, metadata, ip, user_agent
  ) VALUES (
    new_id, caller, _target_user_id,
    'IMPERSONATION_STARTED',
    jsonb_build_object('reason', _reason, 'mode', _mode, 'ttl_minutes', ttl),
    _ip, _user_agent
  );

  PERFORM public.log_audit_event(
    _event_type := 'IMPERSONATION_STARTED',
    _module     := 'impersonation',
    _severity   := 'warning',
    _title      := format('Impersonação iniciada por %s → %s', caller, _target_user_id),
    _message    := _reason,
    _metadata   := jsonb_build_object(
      'impersonation_session_id', new_id,
      'admin_user_id',  caller,
      'target_user_id', _target_user_id,
      'target_role',    target_role_txt,
      'mode',           _mode,
      'expires_at',     expires
    ),
    _entity_type := 'impersonation_session',
    _entity_id   := new_id::text,
    _user_id     := caller
  );

  RETURN jsonb_build_object(
    'ok', true,
    'impersonation_session_id', new_id,
    'expires_at', expires,
    'mode', _mode,
    'target_role', target_role_txt
  );
END $$;

REVOKE ALL ON FUNCTION public.impersonation_start(uuid, text, text, text, text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.impersonation_start(uuid, text, text, text, text, text, int) TO authenticated;

-- ============================================================
-- RPC: impersonation_stop
-- ============================================================
CREATE OR REPLACE FUNCTION public.impersonation_stop(
  _session_id uuid,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  s record;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO s FROM public.impersonation_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF s.admin_user_id <> caller AND NOT public.has_role(caller, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF s.status <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_ended');
  END IF;

  UPDATE public.impersonation_sessions
     SET status = 'ended', ended_at = now()
   WHERE id = s.id;

  INSERT INTO public.impersonation_audit_logs (
    impersonation_session_id, admin_user_id, target_user_id, action, metadata
  ) VALUES (
    s.id, s.admin_user_id, s.target_user_id,
    'IMPERSONATION_ENDED',
    jsonb_build_object('stop_reason', _reason, 'stopped_by', caller)
  );

  PERFORM public.log_audit_event(
    _event_type := 'IMPERSONATION_ENDED',
    _module     := 'impersonation',
    _severity   := 'info',
    _title      := format('Impersonação encerrada: admin %s → alvo %s', s.admin_user_id, s.target_user_id),
    _metadata   := jsonb_build_object('impersonation_session_id', s.id, 'stopped_by', caller),
    _entity_type := 'impersonation_session',
    _entity_id   := s.id::text,
    _user_id     := caller
  );

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.impersonation_stop(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.impersonation_stop(uuid, text) TO authenticated;
