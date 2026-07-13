# Security Memory

## App
Helix — real-money skill game with affiliate/manager network, deposits, withdrawals, and admin console. Supabase-backed with RLS across all public tables.

## Invariants (never allow)
- No client-side privileged operations. All balance/deposit/withdrawal/session state changes go through SECURITY DEFINER RPCs or server functions authenticated via `requireSupabaseAuth`.
- `payment_webhook_logs` SELECT stays admin-only (Realtime is enabled on this table).
- `demo_accounts` mutations stay locked from client RLS — managed exclusively by SECURITY DEFINER functions / service_role.
- `invite_codes` direct access stays admin-only; public/anonymous invite validation must go through SECURITY DEFINER RPCs.
- `user_roles` never becomes writable by non-admins; role checks always go through `has_role` / `is_admin` SECURITY DEFINER functions.

## Scanner guidance
- Do not flag `demo_accounts` missing UPDATE/DELETE RLS policies — intentional default-deny.
- Do not flag `invite_codes` admin-only ALL policy as blocking signup — validation flow uses SECURITY DEFINER RPC.
- Do not flag `payment_webhook_logs` Realtime publication while the SELECT policy remains admin-only.
