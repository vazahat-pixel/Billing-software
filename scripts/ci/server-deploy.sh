#!/usr/bin/env bash
# Runs ON THE SERVER, called by .github/workflows/deploy.yml after it has checked out the new commit.
#   bash scripts/ci/server-deploy.sh <previous-commit>
# Backend: npm ci, pm2 restart, health check. Website: copy the CI-built dist (never builds on the
# server). Desktop: publish the CI-built installer + auto-update feed. Any failure rolls back.
set -Eeuo pipefail

PREV="${1:?previous commit required}"
APP_DIR="${APP_DIR:-/opt/Billing-software}"
WEB_ROOT="${WEB_ROOT:-/var/www/billing-frontend}"
API_PORT="${API_PORT:-5010}"
PM2_APP="${PM2_APP:-billing-api}"
INBOX="${INBOX:-/tmp/billing-deploy}"
WEB_BACKUP="/root/billing-frontend-last"

cd "$APP_DIR"
NEW="$(git rev-parse --short HEAD)"
echo "deploy: $PREV -> $NEW"

health() {
  for _ in $(seq 1 30); do
    if curl -fs "http://127.0.0.1:$API_PORT/api/health" | grep -q healthy; then return 0; fi
    sleep 2
  done
  return 1
}

rollback() {
  echo "deploy FAILED - rolling back to $PREV"
  git checkout -f "$PREV"
  (cd backend && npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund) || true
  pm2 restart "$PM2_APP" --update-env || true
  if [ -d "$WEB_BACKUP" ]; then
    rsync -a --delete --exclude downloads "$WEB_BACKUP/" "$WEB_ROOT/" || true
  fi
  exit 1
}
trap rollback ERR

bash scripts/ci/check-no-obfuscation.sh
command -v rsync >/dev/null || apt-get install -y rsync >/dev/null

echo "backend: installing dependencies"
(cd backend && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund))
pm2 restart "$PM2_APP" --update-env
health || { echo "health check failed"; false; }
echo "backend: healthy"

if [ -f "$INBOX/frontend-dist.tgz" ]; then
  echo "website: publishing"
  rm -rf "$INBOX/web" && mkdir -p "$INBOX/web"
  tar xzf "$INBOX/frontend-dist.tgz" -C "$INBOX/web"
  [ -f "$INBOX/web/index.html" ] || { echo "dist has no index.html"; false; }
  rm -rf "$WEB_BACKUP" && rsync -a --exclude downloads "$WEB_ROOT/" "$WEB_BACKUP/"
  rsync -a --delete --exclude downloads "$INBOX/web/" "$WEB_ROOT/"
fi

if [ -d "$INBOX/updates" ] && [ -f "$INBOX/updates/latest.yml" ]; then
  echo "desktop: publishing installer and update feed"
  mkdir -p "$WEB_ROOT/downloads/updates"
  cp "$INBOX"/updates/* "$WEB_ROOT/downloads/updates/"
  cp "$(ls "$INBOX"/updates/TextileERP-Setup-*.exe | head -1)" "$WEB_ROOT/downloads/BillingSoftware-Setup.exe"
fi

chown -R www-data:www-data "$WEB_ROOT"
rm -rf "$INBOX"
trap - ERR
echo "deploy OK: $NEW is live"
