#!/usr/bin/env bash
# Valida que contas demo NÃO geram deposits, saques, nem wallet_transactions reais.
# Roda em transação revertida — nada persiste.
set -euo pipefail
if [ -z "${PGHOST:-}" ]; then
  echo "SKIP: PGHOST não definido (rode dentro do sandbox Lovable)"
  exit 0
fi
here="$(cd "$(dirname "$0")" && pwd)"
sql="$here/../supabase/tests/demo_account_isolation.sql"
out=$(psql -v ON_ERROR_STOP=1 -X -tA <<SQL 2>&1
BEGIN;
$(cat "$sql")
ROLLBACK;
SQL
)
echo "$out"
echo "$out" | grep -q "ALL DEMO ISOLATION TESTS PASSED"
