-- Regressão: várias partidas sequenciais usando o saldo restante da carteira
-- não devem disparar "Deposit is not valid for this user".
-- Uso: psql -f supabase/tests/wallet_multi_match.sql
-- A lógica real vive em public.test_wallet_multi_match_flow() (migration).
BEGIN;
SELECT public.test_wallet_multi_match_flow();
ROLLBACK;
