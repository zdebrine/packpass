#!/usr/bin/env bash
# Screen tests: builds the member app (web), the partner dashboard and the website against a throwaway local
# database, serves them, and clicks through them in Chromium with Playwright. Nothing touches the live
# Supabase project, Stripe or email: Supabase is the migrations in local Postgres behind PostgREST, with
# apps/member/e2e/live/gateway.mjs standing in for Auth and Storage (every sign-up code is 123456).
#
# Needs: Postgres 15+ on PGHOST/PGPORT (trusting 127.0.0.1), Node 20+, and PostgREST: Docker, or a
# PostgREST binary in POSTGREST_BIN. Builds are skipped when SKIP_BUILD=1 (reuses e2e/.out).
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres e2e/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$here/.."
out="$here/.out"
export DB=packpass_screens
SECRET=packpass-local-test-secret-0123456789abcdef
API=http://127.0.0.1:54399

DB=$DB SKIP_TESTS=1 "$repo/supabase/tests/run-local.sh"
psql -q -d $DB -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if; end \$\$; grant anon, authenticated, service_role to authenticator;"

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; [ -n "${POSTGREST_BIN:-}" ] || docker rm -f packpass-postgrest-screens >/dev/null 2>&1 || true; }
trap cleanup EXIT
pgrst_env=(PGRST_DB_URI="postgres://authenticator@127.0.0.1:${PGPORT}/$DB" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET=$SECRET PGRST_SERVER_PORT=3011)
if [ -n "${POSTGREST_BIN:-}" ]; then
  env "${pgrst_env[@]}" "$POSTGREST_BIN" > "$here/postgrest.log" 2>&1 & pids+=($!)
else
  docker rm -f packpass-postgrest-screens >/dev/null 2>&1 || true
  docker run -d --name packpass-postgrest-screens --network host $(printf -- '-e %s ' "${pgrst_env[@]}") postgrest/postgrest:v12.2.3 >/dev/null
fi
node "$repo/apps/member/e2e/live/gateway.mjs" > "$here/gateway.log" 2>&1 & pids+=($!)

ANON=$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'supabase',exp:4102444800});console.log(h+'.'+p+'.'+c.createHmac('sha256','$SECRET').update(h+'.'+p).digest('base64url'))")

if [ "${SKIP_BUILD:-}" != 1 ]; then
  rm -rf "$out" && mkdir -p "$out"
  (cd "$repo/apps/member" && EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=$API EXPO_PUBLIC_SUPABASE_KEY=$ANON EXPO_PUBLIC_SITE_URL=http://127.0.0.1:8083 EXPO_PUBLIC_SENTRY_DSN= \
    npx expo export -p web --clear --output-dir "$out/member" > "$out/member-build.log" 2>&1) || { tail -30 "$out/member-build.log"; exit 1; }
  (cd "$repo/apps/partner" && VITE_SUPABASE_URL=$API VITE_SUPABASE_KEY=$ANON VITE_SITE_URL=http://127.0.0.1:8083 \
    npx vite build --outDir "$out/partner" --emptyOutDir > "$out/partner-build.log" 2>&1) || { tail -30 "$out/partner-build.log"; exit 1; }
  (cd "$repo/apps/web" && VITE_SUPABASE_URL=$API VITE_SUPABASE_KEY=$ANON VITE_DASHBOARD_URL=http://127.0.0.1:8082 npm run build > "$out/web-build.log" 2>&1 \
    && cp -r dist "$out/web") || { tail -30 "$out/web-build.log"; exit 1; }
fi

node "$here/serve.mjs" "$out/member" 8081 & pids+=($!)
node "$here/serve.mjs" "$out/partner" 8082 & pids+=($!)
node "$here/serve.mjs" "$out/web" 8083 & pids+=($!)
for _ in $(seq 30); do curl -sf "$API/rest/v1/" -o /dev/null && break; sleep 1; done

cd "$here"
DB=$DB API=$API npx playwright test "$@"
