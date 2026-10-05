#!/usr/bin/env bash
# =============================================================================
# Production Deployment Script for Billing Software Backend & Frontend
# Usage:
#   cd /opt/Billing-software
#   ./deploy.sh
#   or:
#   bash scripts/deploy-production.sh
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
API_PORT="${API_PORT:-5010}"
WEB_ROOT="/var/www/billing-frontend"
PM2_APP_NAME="billing-api"

echo ""
echo "=================================================="
echo "🚀 STARTING PRODUCTION DEPLOYMENT: Billing Software"
echo "   Branch: $DEPLOY_BRANCH"
echo "   Directory: $SCRIPT_DIR"
echo "   Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=================================================="
echo ""

# 1. Detect and preserve current Git state
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "📌 Current commit: $PREV_COMMIT"

DEPLOYMENT_STATE="INITIALIZING"

# Rollback handler
rollback() {
  local exit_code=$?
  if [ "$DEPLOYMENT_STATE" = "COMPLETED" ]; then
    return 0
  fi

  echo ""
  echo "🚨 ==============================================="
  echo "🚨 DEPLOYMENT FAILED (Exit Code: $exit_code)"
  echo "🚨 INITIATING AUTOMATED ROLLBACK"
  echo "🚨 ==============================================="
  echo ""

  if [ "$PREV_COMMIT" != "unknown" ]; then
    echo "🔄 Rolling back Git working tree to: $PREV_COMMIT"
    git checkout -f "$PREV_COMMIT" || true

    if [ -d "$SCRIPT_DIR/backend" ]; then
      echo "🔄 Restoring backend dependencies for previous commit..."
      cd "$SCRIPT_DIR/backend"
      if [ -f "package-lock.json" ]; then
        npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund || true
      fi
      cd "$SCRIPT_DIR"
    fi

    if [ -n "${PM2_CMD:-}" ]; then
      echo "🔄 Reloading PM2 process with previous working version..."
      $PM2_CMD reload "$SCRIPT_DIR/ecosystem.config.cjs" --update-env || $PM2_CMD restart "$PM2_APP_NAME" || true
    fi

    echo "⚠️ Rollback completed to $PREV_COMMIT. Please investigate failure logs."
  else
    echo "⚠️ No previous commit known to roll back to."
  fi

  exit "$exit_code"
}

trap rollback ERR

# 2. Safely preserve local uncommitted modifications
echo "🔍 [1/7] Checking Git working tree..."
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  STASH_NAME="deploy-stash-$(date +%s)"
  echo "⚠️ Working tree has modified tracked files. Stashing safely as: $STASH_NAME"
  git stash push -u -m "$STASH_NAME" || true
fi

# 3. Pull latest changes from target branch
echo "📥 [2/7] Fetching and updating from origin/$DEPLOY_BRANCH..."
git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git merge --ff-only "origin/$DEPLOY_BRANCH" || git reset --hard "origin/$DEPLOY_BRANCH"

NEW_COMMIT=$(git rev-parse HEAD)
echo "✅ Checked out new commit: $NEW_COMMIT"

DEPLOYMENT_STATE="UPDATING"

# 4. Verify Node and npm environment
echo "⚙️  [3/7] Verifying Node.js & npm runtime..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not found in PATH." >&2
  exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo "   Node: $NODE_VER"
echo "   npm:  $NPM_VER"

# 5. Deterministic Dependency Installation
echo "📦 [4/7] Installing backend dependencies deterministically..."
cd "$SCRIPT_DIR/backend"

if [ ! -f "package.json" ]; then
  echo "❌ backend/package.json not found!" >&2
  exit 1
fi

if [ ! -f "package-lock.json" ]; then
  echo "❌ backend/package-lock.json missing! Generating lockfile..." >&2
  npm install --package-lock-only --no-audit --no-fund
fi

echo "   Running npm ci --omit=dev..."
if ! npm ci --omit=dev --no-audit --no-fund; then
  echo "⚠️ npm ci failed on initial run. Checking for npm cache corruption..."
  npm cache clean --force || true
  if ! npm ci --omit=dev --no-audit --no-fund; then
    echo "⚠️ npm ci still failing. Upgrading npm to latest to avoid known 10.8.2 resolution bugs..."
    npm install -g npm@latest || true
    npm ci --omit=dev --no-audit --no-fund
  fi
fi

# Verify critical modules resolve
node -e "require('mongoose'); require('mongodb'); require('express');" || {
  echo "❌ Critical backend dependencies failed to load after installation!" >&2
  exit 1
}
echo "✅ Backend dependencies successfully installed and verified."

# 6. Verify environment configuration
echo "🔐 [5/7] Verifying environment configuration..."
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  if [ -f "$SCRIPT_DIR/deploy/backend.env.production.example" ]; then
    echo "⚠️ backend/.env missing. Creating initial backend/.env from template..."
    cp "$SCRIPT_DIR/deploy/backend.env.production.example" "$SCRIPT_DIR/backend/.env"
  elif [ -f "$SCRIPT_DIR/backend/.env.example" ]; then
    echo "⚠️ backend/.env missing. Copying .env.example..."
    cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
  fi
fi

# Ensure port matches API_PORT in .env
if [ -f "$SCRIPT_DIR/backend/.env" ]; then
  if ! grep -q '^PORT=' "$SCRIPT_DIR/backend/.env"; then
    echo "PORT=$API_PORT" >> "$SCRIPT_DIR/backend/.env"
  else
    sed -i "s/^PORT=.*/PORT=$API_PORT/" "$SCRIPT_DIR/backend/.env" 2>/dev/null || true
  fi
fi

# Validate production environment settings (fails fast if weak or missing JWT_SECRET / MONGO_URI)
NODE_ENV=production node -e "
  try {
    const { assertProductionEnv } = require('./utils/startupChecks');
    assertProductionEnv();
    console.log('   Environment check: OK');
  } catch (err) {
    console.error('❌ Environment configuration error:', err.message);
    process.exit(1);
  }
"

# Ensure MongoDB service is running if local systemctl is active
if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files mongod.service >/dev/null 2>&1; then
    if ! systemctl is-active --quiet mongod 2>/dev/null; then
      echo "   Starting local mongod service..."
      systemctl start mongod || true
    fi
  fi
fi

# 7. Detect PM2 Command
PM2_CMD=""
if command -v pm2 >/dev/null 2>&1; then
  PM2_CMD="pm2"
elif [ -f "/usr/local/bin/pm2" ]; then
  PM2_CMD="/usr/local/bin/pm2"
elif [ -f "/usr/bin/pm2" ]; then
  PM2_CMD="/usr/bin/pm2"
else
  CANDIDATE=$(find /root/.nvm /home/*/.nvm /root/.npm-global /home/*/.npm-global -name pm2 -type f -perm /111 2>/dev/null | head -n 1)
  if [ -n "$CANDIDATE" ]; then
    PM2_CMD="$CANDIDATE"
  fi
fi

if [ -z "$PM2_CMD" ]; then
  echo "⚠️ PM2 not found in system paths. Installing pm2 globally..."
  npm install -g pm2 || true
  if command -v pm2 >/dev/null 2>&1; then
    PM2_CMD="pm2"
  fi
fi

if [ -z "$PM2_CMD" ]; then
  echo "❌ Unable to locate or install PM2. Aborting deployment." >&2
  exit 1
fi

# 8. Reload / Restart PM2 with Zero-Downtime Safe Reload
echo "🔄 [6/7] Updating PM2 process ($PM2_APP_NAME)..."
cd "$SCRIPT_DIR"

if $PM2_CMD describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  echo "   Reloading $PM2_APP_NAME with ecosystem.config.cjs..."
  $PM2_CMD reload "$SCRIPT_DIR/ecosystem.config.cjs" --update-env || $PM2_CMD restart "$PM2_APP_NAME" --update-env
else
  echo "   Starting $PM2_APP_NAME with ecosystem.config.cjs..."
  $PM2_CMD start "$SCRIPT_DIR/ecosystem.config.cjs"
fi
$PM2_CMD save >/dev/null 2>&1 || true

# 9. Health Check Verification Loop
echo "🩺 [7/7] Waiting for API startup and running health checks..."
HEALTH_URL_1="http://127.0.0.1:$API_PORT/health"
HEALTH_URL_2="http://127.0.0.1:$API_PORT/api/health"

HEALTHY=0
MAX_ATTEMPTS=15
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  sleep 2
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL_1" 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL_2" 2>/dev/null || echo "000")

  if [ "$STATUS_CODE" = "200" ]; then
    HEALTH_BODY=$(curl -s "$HEALTH_URL_1" 2>/dev/null || curl -s "$HEALTH_URL_2" 2>/dev/null || echo "{}")
    echo "✅ Health check passed on attempt $ATTEMPT (HTTP $STATUS_CODE)!"
    echo "   Response: $HEALTH_BODY"
    HEALTHY=1
    break
  fi

  echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS: API returned HTTP $STATUS_CODE. Waiting..."
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $HEALTHY -ne 1 ]; then
  echo "❌ Health check failed after $MAX_ATTEMPTS attempts." >&2
  echo "📜 Last 30 lines of PM2 logs:" >&2
  $PM2_CMD logs "$PM2_APP_NAME" --lines 30 --nostream || true
  exit 1
fi

# 10. Optional: Update Frontend if web root is present
if [ -d "$WEB_ROOT" ]; then
  echo ""
  echo "📦 Updating frontend static files in $WEB_ROOT..."

  # Preserve installer downloads if already present on server
  if [ -d "$WEB_ROOT/downloads" ] && [ "$(ls -A "$WEB_ROOT/downloads" 2>/dev/null)" ]; then
    echo "   Preserving existing installer files in $WEB_ROOT/downloads..."
    mkdir -p /tmp/billing_downloads_backup
    cp -a "$WEB_ROOT/downloads/." /tmp/billing_downloads_backup/
  fi

  if [ -d "$SCRIPT_DIR/frontend/dist" ] && [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    echo "   Deploying pre-built bundle..."
    rm -rf "${WEB_ROOT:?}/"*
    cp -a "$SCRIPT_DIR/frontend/dist/." "$WEB_ROOT/"
  else
    echo "   Building frontend..."
    cd "$SCRIPT_DIR/frontend"
    if [ -f "package-lock.json" ]; then
      npm ci --no-audit --no-fund || npm install --no-audit --no-fund
    else
      npm install --no-audit --no-fund
    fi
    npm run build
    rm -rf "${WEB_ROOT:?}/"*
    cp -a dist/. "$WEB_ROOT/"
  fi

  # Restore preserved downloads
  if [ -d /tmp/billing_downloads_backup ]; then
    echo "   Restoring preserved installer files to $WEB_ROOT/downloads..."
    mkdir -p "$WEB_ROOT/downloads"
    cp -an /tmp/billing_downloads_backup/. "$WEB_ROOT/downloads/"
    rm -rf /tmp/billing_downloads_backup
  fi

  chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
  chmod -R 755 "$WEB_ROOT" 2>/dev/null || true
fi

# 11. Optional: Reload Nginx
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "🔄 Reloading Nginx..."
    systemctl reload nginx || true
  fi
elif command -v service >/dev/null 2>&1; then
  service nginx reload 2>/dev/null || true
fi

DEPLOYMENT_STATE="COMPLETED"

echo ""
echo "=================================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "   Previous Commit: $PREV_COMMIT"
echo "   Deployed Commit: $NEW_COMMIT"
echo "   Health Endpoint: http://127.0.0.1:$API_PORT/health"
echo "   PM2 Process:     $PM2_APP_NAME"
echo "=================================================="
echo ""
