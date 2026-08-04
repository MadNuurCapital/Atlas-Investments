#!/usr/bin/env bash
#
# Run the Row Level Security test suite against a throwaway database.
#
# Builds the database from scratch every run — shim, then every migration in
# order, then the tests. If a migration cannot build a clean database, this
# fails, which is exactly the guarantee we want before deploying.
#
# Usage:
#   scripts/test-rls.sh                 # uses PGHOST/PGPORT/PGUSER from env
#   PGPORT=54322 scripts/test-rls.sh    # e.g. against `supabase start`
set -euo pipefail

cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-54322}"
export PGUSER="${PGUSER:-postgres}"
DB="${ATLAS_TEST_DB:-atlas_rls_test}"

echo "→ Rebuilding ${DB} on ${PGHOST}:${PGPORT}"
psql -q -d postgres -c "drop database if exists ${DB};" >/dev/null
psql -q -d postgres -c "create database ${DB};" >/dev/null

echo "→ Applying Supabase test shim"
for file in supabase/tests/harness/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${file}" >/dev/null
done

echo "→ Applying migrations"
for file in supabase/migrations/*.sql; do
  echo "   $(basename "${file}")"
  psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${file}" >/dev/null
done

echo "→ Running RLS tests"
status=0
for file in supabase/tests/*.test.sql; do
  echo ""
  echo "   $(basename "${file}")"
  # Assertions are reported through RAISE NOTICE, which psql writes to stderr.
  if ! psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${file}" 2>&1; then
    status=1
  fi
done

echo ""
if [ "${status}" -eq 0 ]; then
  echo "✓ All Row Level Security tests passed."
else
  echo "✖ Row Level Security tests FAILED. Do not deploy."
fi
exit "${status}"
