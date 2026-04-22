#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT_DIR/apps/worker"
WEB_DIR="$ROOT_DIR/apps/web"
WRANGLER_TOML="$WORKER_DIR/wrangler.toml"
WEB_ENV_PROD="$WEB_DIR/.env.production"

DB_NAME="${D1_DB_NAME:-i-call-on}"
PAGES_PROJECT="${PAGES_PROJECT_NAME:-i-call-on-web}"
MIGRATION_FILE="./migrations/0001_init.sql"

log() {
  echo "[deploy] $*"
}

fail() {
  echo "[deploy] ERROR: $*" >&2
  exit 1
}

run_wrangler() {
  (
    cd "$WORKER_DIR"
    npx wrangler "$@"
  )
}

run_wrangler_capture() {
  local output
  local status
  set +e
  output="$(run_wrangler "$@" 2>&1)"
  status=$?
  set -e
  printf '%s' "$output"
  return "$status"
}

extract_db_id_from_list() {
  local db_name="$1"
  node -e 'const fs = require("fs"); const input = fs.readFileSync(0, "utf8").trim(); if (!input) process.exit(0); const dbs = JSON.parse(input); const match = dbs.find((db) => db.name === process.argv[1]); if (match?.uuid) process.stdout.write(String(match.uuid));' "$db_name"
}

extract_db_id_from_create_output() {
  node -e 'const fs = require("fs"); const input = fs.readFileSync(0, "utf8"); const match = input.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i); if (match) process.stdout.write(match[1]);'
}

ensure_pages_project() {
  local output
  if output="$(run_wrangler_capture pages project create "$PAGES_PROJECT" --production-branch main)"; then
    log "Pages project ready: $PAGES_PROJECT"
    return 0
  fi

  if echo "$output" | grep -Eqi "already exists"; then
    log "Pages project already exists: $PAGES_PROJECT"
    return 0
  fi

  if echo "$output" | grep -Eqi "must be verified|must been verified|code:\s*8000077"; then
    fail "Cloudflare account email is not verified. Verify your email in Cloudflare dashboard, then rerun deployment."
  fi

  fail "Could not create Pages project '$PAGES_PROJECT'. Wrangler output: $output"
}

update_wrangler_ids() {
  local db_id="$1"
  local preview_db_id="$2"
  node - "$WRANGLER_TOML" "$db_id" "$preview_db_id" <<'NODE'
const fs = require("fs");
const [file, dbId, previewDbId] = process.argv.slice(2);
let content = fs.readFileSync(file, "utf8");
content = content.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${dbId}"`);
content = content.replace(/preview_database_id\s*=\s*"[^"]*"/, `preview_database_id = "${previewDbId}"`);
fs.writeFileSync(file, content);
NODE
}

update_wrangler_app_origin() {
  local origin="$1"
  node - "$WRANGLER_TOML" "$origin" <<'NODE'
const fs = require("fs");
const [file, origin] = process.argv.slice(2);
let content = fs.readFileSync(file, "utf8");
content = content.replace(/APP_ORIGIN\s*=\s*"[^"]*"/, `APP_ORIGIN = "${origin}"`);
fs.writeFileSync(file, content);
NODE
}

set_web_env_api_base_url() {
  local api_url="$1"
  if [[ ! -f "$WEB_ENV_PROD" ]]; then
    printf 'VITE_API_BASE_URL=%s\n' "$api_url" > "$WEB_ENV_PROD"
    return
  fi

  if grep -q '^VITE_API_BASE_URL=' "$WEB_ENV_PROD"; then
    node - "$WEB_ENV_PROD" "$api_url" <<'NODE'
const fs = require("fs");
const [file, apiUrl] = process.argv.slice(2);
let content = fs.readFileSync(file, "utf8");
content = content.replace(/^VITE_API_BASE_URL=.*$/m, `VITE_API_BASE_URL=${apiUrl}`);
fs.writeFileSync(file, content);
NODE
  else
    printf '\nVITE_API_BASE_URL=%s\n' "$api_url" >> "$WEB_ENV_PROD"
  fi
}

is_authenticated() {
  local whoami_output
  whoami_output="$(run_wrangler_capture whoami || true)"
  if echo "$whoami_output" | grep -Eqi "not authenticated|run \`?wrangler login\`?"; then
    return 1
  fi
  return 0
}

log "Starting Cloudflare deployment for i-call-on-game"

if ! is_authenticated; then
  cat <<'MSG'
[deploy] You are not authenticated with Cloudflare.
[deploy] Run this once, then rerun deployment:
[deploy]   cd apps/worker && npx wrangler login
MSG
  exit 1
fi

log "Ensuring D1 database exists: $DB_NAME"
d1_list_json="[]"
if d1_list_output="$(run_wrangler_capture d1 list --json)"; then
  d1_list_json="$d1_list_output"
fi
db_id="$(printf '%s' "$d1_list_json" | extract_db_id_from_list "$DB_NAME")"

if [[ -z "$db_id" ]]; then
  log "D1 database not found. Creating: $DB_NAME"
  d1_create_output="$(run_wrangler_capture d1 create "$DB_NAME")" || fail "Could not create D1 database '$DB_NAME'."
  db_id="$(printf '%s' "$d1_create_output" | extract_db_id_from_create_output)"
fi

if [[ -z "$db_id" ]]; then
  if d1_list_output="$(run_wrangler_capture d1 list --json)"; then
    db_id="$(printf '%s' "$d1_list_output" | extract_db_id_from_list "$DB_NAME")"
  fi
fi

[[ -n "$db_id" ]] || fail "Could not resolve D1 database id for '$DB_NAME'"
preview_db_id="$db_id"
log "Using D1 database id: $db_id"

log "Updating D1 ids in apps/worker/wrangler.toml"
update_wrangler_ids "$db_id" "$preview_db_id"

pages_origin="https://${PAGES_PROJECT}.pages.dev"
log "Setting APP_ORIGIN to $pages_origin"
update_wrangler_app_origin "$pages_origin"

log "Applying D1 migration: $MIGRATION_FILE"
run_wrangler d1 execute "$DB_NAME" --remote --file="$MIGRATION_FILE" >/dev/null

log "Ensuring Pages project exists: $PAGES_PROJECT"
ensure_pages_project

log "Deploying worker"
if ! worker_output="$(run_wrangler_capture deploy)"; then
  if echo "$worker_output" | grep -Eqi "verify your email|code:\s*10034"; then
    fail "Cloudflare account email is not verified for Workers. Verify your email in Cloudflare dashboard, then rerun deployment."
  fi
  fail "Worker deploy failed. Wrangler output: $worker_output"
fi
printf '%s\n' "$worker_output"

worker_url="$(printf '%s\n' "$worker_output" | grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' | head -n1 || true)"
if [[ -z "$worker_url" ]]; then
  fail "Could not parse workers.dev URL from worker deploy output."
fi
log "Worker URL: $worker_url"

log "Updating apps/web/.env.production API base URL"
set_web_env_api_base_url "$worker_url"

log "Building and deploying web app"
npm run deploy:web

cat <<MSG
[deploy] Deployment complete.
[deploy] Web:    https://${PAGES_PROJECT}.pages.dev
[deploy] API:    ${worker_url}
[deploy] Config: ${WEB_ENV_PROD}
MSG
