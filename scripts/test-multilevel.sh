#!/usr/bin/env bash
# Executa a suíte de auditoria do sistema multinível dentro de uma transação
# revertida (nada persiste no banco). Retorna código 0 em sucesso, != 0 em falha.
#
# Uso: ./scripts/test-multilevel.sh
# Requer PGHOST/PGUSER/PGPASSWORD/PGDATABASE (ambiente sandbox já os define).
set -euo pipefail
if [ -z "${PGHOST:-}" ]; then
  echo "SKIP: PGHOST não definido (rode dentro do sandbox Lovable)"
  exit 0
fi
out=$(psql -v ON_ERROR_STOP=1 -tA \
  -c "BEGIN; SELECT public.test_multilevel_flow(); ROLLBACK;" 2>&1)
echo "$out"
echo "$out" | grep -q "ALL MULTILEVEL TESTS PASSED"
