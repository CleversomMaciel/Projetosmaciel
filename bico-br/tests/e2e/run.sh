#!/usr/bin/env bash
# Teste de ponta a ponta LOCAL: Postgres + PostgREST + gateway de teste + servidor real + navegador.
# Requer: PostgreSQL 15+, Playwright/Chromium e o binário do PostgREST (POSTGREST_BIN, ou baixa a v12.2.3).
# E2E_SERVE=1 mantém o ambiente no ar depois do teste (para navegar manualmente).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; APP="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | tail -1 || command -v initdb)")}"
WORK="$(mktemp -d)"; chmod 755 "$WORK"
PGPORT=54331; PGRST_PORT=3301; GW_PORT=3302; APP_PORT=3303
JWT_SECRET="segredo-de-teste-com-pelo-menos-32-caracteres!!"; export MP_WEBHOOK_SECRET="segredo-webhook-e2e"
OUT="${E2E_OUT:-$WORK/out}"; mkdir -p "$OUT"

POSTGREST_BIN="${POSTGREST_BIN:-$HOME/.cache/bico-br/postgrest}"
if [ ! -x "$POSTGREST_BIN" ]; then
  mkdir -p "$(dirname "$POSTGREST_BIN")"
  curl -fsSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C "$(dirname "$POSTGREST_BIN")"
fi

RUNAS=(); SUPA="$APP/supabase"; SETUP="$HERE/setup.sql"
if [ "$(id -u)" = "0" ]; then
  cp -r "$APP/supabase" "$WORK/supabase"; cp "$HERE/setup.sql" "$WORK/"; chown -R postgres "$WORK"
  RUNAS=(runuser -u postgres --); SUPA="$WORK/supabase"; SETUP="$WORK/setup.sql"
fi
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; [ -n "${E2E_OUT:-}" ] && rm -rf "$WORK/data" "$WORK/supabase" || rm -rf "$WORK"; }
trap cleanup EXIT

"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust -E UTF8 --no-locale >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PGPORT -c listen_addresses='' -k $WORK" -w start >/dev/null
PSQL=("${RUNAS[@]}" "$PGBIN/psql" -h "$WORK" -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database bico" postgres
"${PSQL[@]}" -d bico -f "$SUPA/tests/00_supabase_stub.sql" 2>/dev/null
for f in "$SUPA"/migrations/*.sql; do "${PSQL[@]}" -d bico -f "$f" 2>/dev/null; done
"${PSQL[@]}" -d bico -f "$SETUP"

PGRST_DB_URI="postgres://authenticator@/bico?host=$WORK&port=$PGPORT" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=$PGRST_PORT PGRST_SERVER_HOST=127.0.0.1 PGRST_LOG_LEVEL=error \
  "$POSTGREST_BIN" > "$OUT/postgrest.log" 2>&1 & PIDS+=($!)
PORT=$GW_PORT PGRST_URL="http://127.0.0.1:$PGRST_PORT" JWT_SECRET="$JWT_SECRET" APP_URL="http://127.0.0.1:$APP_PORT" \
  node "$HERE/gateway.mjs" > "$OUT/gateway.log" 2>&1 & PIDS+=($!)
for i in $(seq 1 60); do curl -fs "http://127.0.0.1:$GW_PORT/fake/tokens" >/dev/null 2>&1 && curl -fs "http://127.0.0.1:$PGRST_PORT/categories?limit=1" >/dev/null 2>&1 && break; sleep 0.25; done
TOKENS="$(curl -fs "http://127.0.0.1:$GW_PORT/fake/tokens")"
ANON="$(node -e "console.log(JSON.parse(process.argv[1]).anon)" "$TOKENS")"; SERVICE="$(node -e "console.log(JSON.parse(process.argv[1]).service)" "$TOKENS")"

(cd "$APP" && npm run build >/dev/null 2>&1)
NODE_ENV=test PORT=$APP_PORT PUBLIC_URL="http://127.0.0.1:$APP_PORT" SUPABASE_URL="http://127.0.0.1:$GW_PORT" \
  SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SERVICE" \
  VIACEP_BASE_URL="http://127.0.0.1:$GW_PORT/fake/viacep" BRASILAPI_BASE_URL="http://127.0.0.1:$GW_PORT/fake/brasilapi" CEP_PROVIDERS=viacep \
  MP_ACCESS_TOKEN="TEST-TOKEN" MP_API_BASE="http://127.0.0.1:$GW_PORT/fake/mp" MP_CLIENT_ID="app-e2e" MP_CLIENT_SECRET="segredo-app-e2e" \
  MP_AUTH_URL="http://127.0.0.1:$GW_PORT/fake/mp/authorize" MP_TOKEN_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  node "$APP/server/src/index.js" > "$OUT/app.log" 2>&1 & PIDS+=($!)
for i in $(seq 1 60); do curl -fs "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1 && break; sleep 0.25; done

set +e
APP_URL="http://127.0.0.1:$APP_PORT" GW_URL="http://127.0.0.1:$GW_PORT" ANON_KEY="$ANON" OUT="$OUT" node "$HERE/fluxo.e2e.cjs"
CODE=$?
set -e
if [ $CODE -ne 0 ]; then echo "---- app.log"; tail -15 "$OUT/app.log"; echo "---- gateway.log"; tail -8 "$OUT/gateway.log"; echo "---- postgrest.log"; tail -8 "$OUT/postgrest.log"; fi
if [ -n "${E2E_SERVE:-}" ]; then echo "Ambiente no ar em http://127.0.0.1:$APP_PORT (Ctrl+C para encerrar)"; wait; fi
exit $CODE
