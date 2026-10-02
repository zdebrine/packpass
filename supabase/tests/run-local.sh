#!/usr/bin/env bash
# Applies the migrations and seed to a throwaway database on a plain Postgres 15+ and runs the
# SQL tests. Usage: PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/run-local.sh
# DB=name sets the database; SKIP_TESTS=1 just builds it (for pointing PostgREST at it).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-packpass_test}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d $DB -f "$1"; }
run tests/shim.sql
for f in migrations/*.sql; do run "$f"; done
run catalog.sql
run seed.sql
if [ -n "${SKIP_TESTS:-}" ]; then echo "Built $DB."; exit 0; fi
for t in tests/*.test.sql; do echo "== $t"; run "$t"; done
echo "All SQL tests passed."
