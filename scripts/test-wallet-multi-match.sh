#!/usr/bin/env bash
# Regressão: duas e várias partidas sequenciais usando o mesmo saldo não podem
# disparar "Deposit is not valid for this user". Executa dentro de uma transação
# revertida (nada persiste no banco).
#
# Uso: ./scripts/test-wallet-multi-match.sh
# Requer PGHOST/PGUSER/PGPASSWORD/PGDATABASE (ambiente sandbox já os define).
set -euo pipefail
if [ -z "${PGHOST:-}" ]; then
  echo "SKIP: PGHOST não definido (rode dentro do sandbox Lovable)"
  exit 0
fi
out=$(psql -v ON_ERROR_STOP=1 -tA \
  -c "BEGIN; SELECT public.test_wallet_multi_match_flow(); ROLLBACK;" 2>&1)
echo "$out"
echo "$out" | grep -q "ALL WALLET MULTI-MATCH TESTS PASSED"
