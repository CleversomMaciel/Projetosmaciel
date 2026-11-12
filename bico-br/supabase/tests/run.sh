#!/usr/bin/env bash
# Sobe um Postgres descartável, aplica stub + migrations, roda os testes de RLS/fluxos
# e valida que as reversões (rollback) e a reaplicação funcionam.
# Uso: supabase/tests/run.sh   (requer binários do PostgreSQL 15+; como root, usa o usuário postgres)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
PGBIN="${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | tail -1 || command -v initdb)")}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then
  cp -r "$ROOT" "$WORK/supabase"; ROOT="$WORK/supabase"; HERE="$ROOT/tests"
  chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --)
fi
cleanup() { "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust -E UTF8 --no-locale >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -c listen_addresses='' -k $WORK" -w start >/dev/null
PSQL=("${RUNAS[@]}" "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "create database bico" postgres
apply() { for f in "$ROOT"/migrations/*.sql; do echo "  aplicando $(basename "$f")"; "${PSQL[@]}" -d bico -f "$f"; done; }

echo "== stub do Supabase";            "${PSQL[@]}" -d bico -f "$HERE/00_supabase_stub.sql"
echo "== migrations";                  apply
echo "== testes";                      "${PSQL[@]}" -d bico -f "$HERE/10_rls_e_fluxos.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
echo "== reversão (ordem inversa)"
for f in $(ls -r "$ROOT"/rollback/*.down.sql); do echo "  revertendo $(basename "$f")"; "${PSQL[@]}" -d bico -f "$f"; done
LEFT=$("${PSQL[@]}" -d bico -Atc "select count(*) from pg_tables where schemaname='public'")
[ "$LEFT" = "0" ] || { echo "FALHOU: restaram $LEFT tabelas após a reversão"; exit 1; }
echo "== reaplicação após reversão";   apply >/dev/null
echo "OK: migrations, testes, reversão e reaplicação"
