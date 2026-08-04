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

# Each test file gets a database built from scratch. Slower than sharing
# one, but test files cannot then contaminate each other's fixtures — and
# it re-proves on every run that the migrations build a clean database from
# nothing, which is the guarantee wanted before any deploy.
build_database() {
  # `local` is not optional here. Without it this function would clobber the
  # caller's loop variable, and the runner would silently re-apply the last
  # migration instead of running the test file.
  local sql_file

  # FORCE disconnects any session still holding the database open. Without
  # it a lingering connection makes the drop fail and the old schema
  # survives into the next run.
  psql -q -v ON_ERROR_STOP=1 -d postgres \
    -c "drop database if exists ${DB} with (force);" >/dev/null 2>&1
  psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database ${DB};" >/dev/null

  for sql_file in supabase/tests/harness/*.sql; do
    psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${sql_file}" >/dev/null
  done
  for sql_file in supabase/migrations/*.sql; do
    psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${sql_file}" >/dev/null
  done
}

echo "→ Migrations to apply:"
for migration in supabase/migrations/*.sql; do
  echo "   $(basename "${migration}")"
done

status=0
for test_file in supabase/tests/*.test.sql; do
  echo ""
  echo "→ $(basename "${test_file}") (fresh database)"
  build_database
  # Assertions are reported through RAISE NOTICE, which psql writes to stderr.
  if ! psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${test_file}" 2>&1; then
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
