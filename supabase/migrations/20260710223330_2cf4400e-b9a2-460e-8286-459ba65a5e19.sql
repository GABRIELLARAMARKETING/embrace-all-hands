
-- ============ audit_events ============
CREATE TABLE public.audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  module text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text,
  title text NOT NULL,
  message text,
  technical_message text,
  user_id uuid,
  admin_user_id uuid,
  manager_user_id uuid,
  affiliate_user_id uuid,
  entity_type text,
  entity_id text,
  route text,
  method text,
  status_code integer,
  request_id text,
  correlation_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  stack_trace text,
  resolved_at timestamptz,
  resolved_by_admin_id uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_severity_chk CHECK (severity IN ('info','success','warning','error','critical'))
);
CREATE INDEX audit_events_created_at_idx ON public.audit_events (created_at DESC);
CREATE INDEX audit_events_severity_idx ON public.audit_events (severity);
CREATE INDEX audit_events_module_idx ON public.audit_events (module);
CREATE INDEX audit_events_event_type_idx ON public.audit_events (event_type);
CREATE INDEX audit_events_user_id_idx ON public.audit_events (user_id);
CREATE INDEX audit_events_correlation_idx ON public.audit_events (correlation_id);

GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update audit events"
  ON public.audit_events FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER audit_events_set_updated_at
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ admin_notifications ============
CREATE TABLE public.admin_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_event_id uuid REFERENCES public.audit_events(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_notifications_created_at_idx ON public.admin_notifications (created_at DESC);
CREATE INDEX admin_notifications_unread_idx ON public.admin_notifications (created_at DESC) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update notifications"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER admin_notifications_set_updated_at
  BEFORE UPDATE ON public.admin_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ log_audit_event RPC (SECURITY DEFINER) ============
-- Permite emitir eventos de auditoria de qualquer usuário autenticado
-- sem precisar de service role. Sanitiza campos e cria notificação
-- admin automaticamente para severidade warning/error/critical.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _event_type text,
  _module text,
  _severity text,
  _title text,
  _message text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _entity_type text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _correlation_id text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _status text DEFAULT NULL,
  _technical_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_id uuid;
  sev text := COALESCE(_severity, 'info');
  uid uuid := COALESCE(_user_id, auth.uid());
BEGIN
  IF sev NOT IN ('info','success','warning','error','critical') THEN
    sev := 'info';
  END IF;

  INSERT INTO public.audit_events (
    event_type, module, severity, status, title, message,
    technical_message, user_id, entity_type, entity_id,
    correlation_id, metadata
  ) VALUES (
    _event_type, _module, sev, _status, _title, _message,
    _technical_message, uid, _entity_type, _entity_id,
    _correlation_id, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO ev_id;

  IF sev IN ('warning','error','critical') THEN
    INSERT INTO public.admin_notifications (type, severity, title, message, payload, audit_event_id)
    VALUES (_event_type, sev, _title, _message, COALESCE(_metadata,'{}'::jsonb), ev_id);
  END IF;

  RETURN ev_id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(
  text, text, text, text, text, jsonb, text, text, text, uuid, text, text
) TO authenticated, service_role;

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
