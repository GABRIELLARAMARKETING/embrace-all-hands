
-- ============================================================
-- 1) SECURITY HARDENING: revoke public execute on privileged fns
-- ============================================================
REVOKE ALL ON FUNCTION public.reconcile_payments()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_reconciliation()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.test_multilevel_flow()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.test_helix_flow()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._test_signup(uuid, text, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_invite_codes()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_deposit_commissions(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_deposit_atomic(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit_event(text,text,text,text,text,jsonb,text,text,text,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_affiliate_code()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_affiliate_code()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_financials()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_manager_budget()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_click_flag_ip_abuse()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_commission_created()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_helix_session_finished()     FROM PUBLIC, anon, authenticated;

-- Player-facing helpers stay callable by authenticated users only:
REVOKE ALL ON FUNCTION public.helix_create_session(uuid, uuid)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helix_finish_session(uuid, text)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helix_withdrawal_rules()                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role)                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid)                                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helix_payout_cents(integer)                             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helix_minimum_withdraw_cents(integer)                   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.helix_create_session(uuid, uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.helix_register_platform(uuid, integer, bigint, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.helix_finish_session(uuid, text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.helix_withdrawal_rules()                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.helix_payout_cents(integer)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.helix_minimum_withdraw_cents(integer)                   TO authenticated;

-- ============================================================
-- 2) PERFORMANCE INDEXES (hot paths for 500+ users/day)
-- ============================================================
CREATE INDEX IF NOT EXISTS wallet_tx_user_created_idx
  ON public.wallet_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_tx_deposit_idx
  ON public.wallet_transactions (deposit_id) WHERE deposit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commissions_deposit_idx
  ON public.commissions (deposit_id);

CREATE INDEX IF NOT EXISTS commissions_source_user_idx
  ON public.commissions (source_user_id);

CREATE INDEX IF NOT EXISTS deposits_user_created_idx
  ON public.deposits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deposits_status_created_idx
  ON public.deposits (status, created_at DESC);

CREATE INDEX IF NOT EXISTS game_sessions_user_status_idx
  ON public.game_sessions (user_id, status);

CREATE INDEX IF NOT EXISTS game_sessions_user_created_idx
  ON public.game_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS helix_events_session_valid_idx
  ON public.helix_platform_events (session_id) WHERE is_valid = true;

CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON public.audit_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS referral_clicks_ip_conv_idx
  ON public.referral_clicks (ip_hash, converted_at DESC)
  WHERE converted_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx
  ON public.profiles (referred_by_id) WHERE referred_by_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_logs_created_idx
  ON public.payment_webhook_logs (created_at DESC);
