-- Executa a suíte de auditoria multinível dentro de transação revertida.
-- Uso: psql -f supabase/tests/multilevel_flow.sql
-- A lógica real vive em public.test_multilevel_flow() (migration).
BEGIN;
SELECT public.test_multilevel_flow();
ROLLBACK;
