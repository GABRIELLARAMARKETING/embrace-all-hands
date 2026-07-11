#!/usr/bin/env bash
# Valida (em transação revertida) que contas demo NÃO geram deposits,
# saques nem wallet_transactions reais. Chama a função server-side
# `public.test_demo_account_isolation()`.
set -euo pipefail
if [ -z "${PGHOST:-}" ]; then
  echo "SKIP: PGHOST não definido (rode dentro do sandbox Lovable)"
  exit 0
fi
out=$(psql -v ON_ERROR_STOP=1 -tA \
  -c "BEGIN; SELECT public.test_demo_account_isolation(); ROLLBACK;" 2>&1)
echo "$out"
echo "$out" | grep -q "ALL DEMO ISOLATION TESTS PASSED"
