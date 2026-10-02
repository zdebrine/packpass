#!/usr/bin/env bash
# Live-mode end-to-end check: runs the app's real store and API code (src/store, src/api) against
# the Supabase migrations through PostgREST, with a small stand-in for Supabase Auth (gateway.mjs).
#
# Needs: Postgres 15+ on PGHOST/PGPORT (trusting 127.0.0.1), Docker, Node 20+.
#   PGHOST=/tmp PGPORT=5499 PGUSER=postgres apps/member/e2e/live/run.sh
# Postgres must accept TCP on 127.0.0.1:$PGPORT for the PostgREST container.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="$here/../.."
repo="$app/../.."
export DB=packpass_api
SECRET=packpass-local-test-secret-0123456789abcdef

DB=$DB SKIP_TESTS=1 "$repo/supabase/tests/run-local.sh"
psql -q -d $DB -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if; end \$\$; grant anon, authenticated, service_role to authenticator;"

docker rm -f packpass-postgrest >/dev/null 2>&1 || true
docker run -d --name packpass-postgrest --network host \
  -e PGRST_DB_URI="postgres://authenticator@127.0.0.1:${PGPORT}/$DB" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=$SECRET -e PGRST_SERVER_PORT=3011 postgrest/postgrest:v12.2.3 >/dev/null
node "$here/gateway.mjs" & gw=$!
trap 'kill $gw; docker rm -f packpass-postgrest >/dev/null' EXIT
sleep 3

ANON=$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'supabase',exp:4102444800});console.log(h+'.'+p+'.'+c.createHmac('sha256','$SECRET').update(h+'.'+p).digest('base64url'))")
out="$(mktemp -d)/member-flow.mjs"
cd "$app"
npx --yes esbuild@0.24.0 "$here/member-flow.ts" --bundle --platform=node --format=esm --outfile="$out" --log-level=warning \
  --alias:@=./src --alias:react-native="$here/stubs/rn.js" --alias:@react-native-async-storage/async-storage="$here/stubs/async-storage.js" \
  --alias:react-native-url-polyfill/auto="$here/stubs/empty.js" --loader:.jpg=empty \
  --define:process.env.EXPO_PUBLIC_SUPABASE_URL='"http://127.0.0.1:54399"' --define:process.env.EXPO_PUBLIC_SUPABASE_KEY="\"$ANON\"" \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
node "$out"
