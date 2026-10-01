#!/usr/bin/env bash
# =============================================================================
# Automated 1-Click Fast Deployment Script for Billing Software
# Usage: ./deploy.sh
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "🚀 STARTING FAST AUTOMATED DEPLOYMENT"
echo "=========================================="
echo ""

# 1. Pull Latest Code
echo "📥 [1/4] Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

# 2. Backend Check & Restart
echo ""
echo "⚙️  [2/4] Updating & Restarting Backend..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install --omit=dev --no-audit --no-fund
fi

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe billing-api >/dev/null 2>&1; then
    pm2 restart billing-api --update-env
  else
    pm2 start server.js --name billing-api --time
  fi
  pm2 save >/dev/null 2>&1 || true
else
  echo "⚠️ PM2 not found, skipping PM2 restart."
fi

# 3. Deploy Frontend (Pre-built, 0 npm install needed on VPS!)
echo ""
echo "📦 [3/4] Deploying Frontend to /var/www/billing-frontend/..."
mkdir -p /var/www/billing-frontend

if [ -d "$SCRIPT_DIR/frontend/dist" ] && [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
  echo "Found pre-built frontend bundle. Deploying instantly..."
  rm -rf /var/www/billing-frontend/*
  cp -a "$SCRIPT_DIR/frontend/dist/." /var/www/billing-frontend/
else
  echo "Building frontend bundle on server..."
  cd "$SCRIPT_DIR/frontend"
  if [ ! -d "node_modules" ]; then
    npm install --no-audit --no-fund
  fi
  npm run build
  rm -rf /var/www/billing-frontend/*
  cp -a dist/. /var/www/billing-frontend/
fi

chown -R www-data:www-data /var/www/billing-frontend 2>/dev/null || true
chmod -R 755 /var/www/billing-frontend 2>/dev/null || true

# 4. Reload Nginx
echo ""
echo "🔄 [4/4] Reloading Nginx Web Server..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx || true
elif command -v service >/dev/null 2>&1; then
  service nginx reload || true
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETED SUCCESSFULLY in seconds!"
echo "🌐 URL: https://app.dealingindia.com"
echo "=========================================="
echo ""
