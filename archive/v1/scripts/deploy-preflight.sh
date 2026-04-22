#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_TOML="$ROOT_DIR/apps/worker/wrangler.toml"
WEB_ENV_PROD="$ROOT_DIR/apps/web/.env.production"

failures=()

if [[ ! -f "$WORKER_TOML" ]]; then
  failures+=("Missing worker config: apps/worker/wrangler.toml")
else
  db_id="$(grep -E '^database_id\s*=' "$WORKER_TOML" | head -n1 | sed -E 's/.*"([^"]+)"/\1/' || true)"
  preview_db_id="$(grep -E '^preview_database_id\s*=' "$WORKER_TOML" | head -n1 | sed -E 's/.*"([^"]+)"/\1/' || true)"

  if [[ -z "$db_id" ]]; then
    failures+=("database_id is not set in apps/worker/wrangler.toml")
  elif [[ "$db_id" == "00000000-0000-0000-0000-000000000000" ]]; then
    failures+=("database_id is still placeholder in apps/worker/wrangler.toml")
  fi

  if [[ -z "$preview_db_id" ]]; then
    failures+=("preview_database_id is not set in apps/worker/wrangler.toml")
  elif [[ "$preview_db_id" == "00000000-0000-0000-0000-000000000000" ]]; then
    failures+=("preview_database_id is still placeholder in apps/worker/wrangler.toml")
  fi
fi

if [[ ! -f "$WEB_ENV_PROD" ]]; then
  failures+=("Missing apps/web/.env.production (copy from apps/web/.env.production.example)")
else
  api_base_url="$(grep -E '^VITE_API_BASE_URL=' "$WEB_ENV_PROD" | head -n1 | cut -d'=' -f2- || true)"
  if [[ -z "$api_base_url" ]]; then
    failures+=("VITE_API_BASE_URL is missing in apps/web/.env.production")
  elif [[ "$api_base_url" == *"<your-subdomain>"* ]]; then
    failures+=("VITE_API_BASE_URL still contains placeholder in apps/web/.env.production")
  fi
fi

whoami_output="$(npm --workspace apps/worker exec wrangler whoami 2>&1 || true)"
if echo "$whoami_output" | grep -Eqi "not authenticated|run \`?wrangler login\`?"; then
  failures+=("Not authenticated with Cloudflare CLI. Run: npm --workspace apps/worker exec wrangler login")
fi

if (( ${#failures[@]} > 0 )); then
  echo "Deployment preflight failed. Fix the following:"
  for item in "${failures[@]}"; do
    echo "- $item"
  done
  exit 1
fi

echo "Deployment preflight passed. Ready to run: npm run deploy:prod"
