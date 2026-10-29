#!/usr/bin/env bash
# Runs CargoTrack on one development machine: PostgreSQL, the core API, a
# stand-in for Zitadel (cmd/devauth) and an M-Pesa simulator
# (cmd/devmpesa). For seeing and testing the app; never for real users.
#
#   scripts/devstack.sh start    start everything (data kept in .devdata/)
#   scripts/devstack.sh stop     stop everything
#   scripts/devstack.sh status   show what is running
#   scripts/devstack.sh reset    stop and delete all development data
#
# A phone on USB reaches the stack through `adb reverse`; then run the app:
#   cd frontends/app && npx expo start --localhost   (with .env.local from below)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.devdata"
CORE="$ROOT/services/core"
PGPORT=5544

pg_running() { pg_ctl -D "$DATA/pg" status >/dev/null 2>&1; }

start_pg() {
  command -v pg_ctl >/dev/null || { echo "PostgreSQL 17+ (pg_ctl, initdb) is required" >&2; exit 1; }
  if [[ ! -d "$DATA/pg" ]]; then
    mkdir -p "$DATA"
    initdb -D "$DATA/pg" -U postgres -A trust -E UTF8 >/dev/null
  fi
  if ! pg_running; then
    pg_ctl -D "$DATA/pg" -o "-p $PGPORT -k $DATA -c listen_addresses=localhost" -l "$DATA/pg.log" start >/dev/null
    for _ in $(seq 1 30); do pg_isready -h "$DATA" -p "$PGPORT" >/dev/null 2>&1 && break; sleep 0.5; done
  fi
  # An ordinary role, as in production: a superuser would bypass row-level security.
  psql -h "$DATA" -p "$PGPORT" -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='cargotrack'" | grep -q 1 ||
    psql -h "$DATA" -p "$PGPORT" -U postgres -qc "CREATE ROLE cargotrack LOGIN PASSWORD 'cargotrack'"
  psql -h "$DATA" -p "$PGPORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cargotrack'" | grep -q 1 ||
    psql -h "$DATA" -p "$PGPORT" -U postgres -qc "CREATE DATABASE cargotrack OWNER cargotrack"
}

run() { # name, command...
  local name=$1; shift
  if [[ -f "$DATA/$name.pid" ]] && kill -0 "$(cat "$DATA/$name.pid")" 2>/dev/null; then return; fi
  nohup "$@" >"$DATA/$name.log" 2>&1 &
  echo $! >"$DATA/$name.pid"
}

start() {
  start_pg
  (cd "$CORE" && go build -o "$DATA/bin/core" ./cmd/core && go build -o "$DATA/bin/devauth" ./cmd/devauth &&
    go build -o "$DATA/bin/devmpesa" ./cmd/devmpesa)

  run devauth "$DATA/bin/devauth" -addr :9000 -issuer http://localhost:9000 -audience cargotrack-dev
  run devmpesa "$DATA/bin/devmpesa" -addr :9100
  CORE_HTTP_ADDR=:8080 \
  DATABASE_URL="postgres://cargotrack:cargotrack@localhost:$PGPORT/cargotrack" \
  OIDC_ISSUER=http://localhost:9000 OIDC_AUDIENCE=cargotrack-dev \
  MPESA_ENVIRONMENT=sandbox MPESA_BASE_URL=http://localhost:9100 \
  MPESA_CONSUMER_KEY=dev MPESA_CONSUMER_SECRET=dev MPESA_SHORTCODE=174379 MPESA_PASSKEY=dev \
  MPESA_CALLBACK_TOKEN=dev MPESA_CALLBACK_URL="http://localhost:8080/v1/payments/mpesa/callback?token=dev" \
    run core "$DATA/bin/core"

  for _ in $(seq 1 30); do curl -sf localhost:8080/readyz >/dev/null && break; sleep 0.5; done
  curl -sf localhost:8080/readyz >/dev/null || { echo "core did not start; see $DATA/core.log" >&2; exit 1; }

  if command -v adb >/dev/null && adb get-state >/dev/null 2>&1; then
    for port in 8080 9000 8081; do adb reverse "tcp:$port" "tcp:$port" >/dev/null; done
    echo "Phone connected: ports 8080, 9000 and 8081 forwarded over USB."
  fi

  cat <<EOF
CargoTrack development stack is running.
  core API      http://localhost:8080
  sign-in       http://localhost:9000   (choose a demo user)
  M-Pesa        http://localhost:9100   (numbers ending 000 simulate a cancel)
  logs          $DATA/*.log

frontends/app/.env.local for this stack:
  EXPO_PUBLIC_API_URL=http://localhost:8080
  EXPO_PUBLIC_OIDC_ISSUER=http://localhost:9000
  EXPO_PUBLIC_OIDC_CLIENT_ID=cargotrack-dev-app
  EXPO_PUBLIC_OIDC_PROJECT_ID=cargotrack-dev
EOF
}

stop() {
  for name in core devauth devmpesa; do
    if [[ -f "$DATA/$name.pid" ]]; then kill "$(cat "$DATA/$name.pid")" 2>/dev/null || true; rm -f "$DATA/$name.pid"; fi
  done
  if pg_running; then pg_ctl -D "$DATA/pg" stop -m fast >/dev/null; fi
  echo "stopped"
}

status() {
  for name in core devauth devmpesa; do
    if [[ -f "$DATA/$name.pid" ]] && kill -0 "$(cat "$DATA/$name.pid")" 2>/dev/null; then echo "$name: running"; else echo "$name: stopped"; fi
  done
  pg_running && echo "postgres: running" || echo "postgres: stopped"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  reset) stop; rm -rf "$DATA"; echo "development data deleted" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
