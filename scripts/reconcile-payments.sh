#!/usr/bin/env bash
# Verificação automatizada de conciliação de pagamentos.
# Falha com relatório detalhado quando qualquer divergência for encontrada.
set -euo pipefail

echo "=== Relatório de divergências ==="
psql -X -A -F ' | ' -c "SELECT kind, deposit_id, user_id, expected, actual, detail FROM public.reconcile_payments();" || true

echo ""
echo "=== Asserção final ==="
psql -X -v ON_ERROR_STOP=1 -c "SELECT public.assert_reconciliation();"
