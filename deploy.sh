#!/usr/bin/env bash
# =============================================================================
# Automated 1-Click Deployment Script for Billing Software
# Usage: ./deploy.sh
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "🚀 STARTING AUTOMATED DEPLOYMENT"
echo "=========================================="
echo ""

# 1. Pull Latest Code
echo "📥 [1/5] Pulling latest code from GitHub..."
git pull origin main

# 2. Backend Check & Restart
echo ""
echo "⚙️  [2/5] Updating & Restarting Backend..."
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

# 3. Frontend Build
echo ""
echo "🎨 [3/5] Building Frontend..."
cd "$SCRIPT_DIR/frontend"

# If vite is missing or node_modules broken, install cleanly
if [ ! -f "node_modules/.bin/vite" ]; then
  echo "Vite missing in node_modules, installing cleanly..."
  rm -rf node_modules package-lock.json
  npm install --legacy-peer-deps --no-audit --no-fund
fi

npm run build

# 4. Copy to Web Root
echo ""
echo "📦 [4/5] Deploying build to /var/www/billing-frontend/..."
mkdir -p /var/www/billing-frontend
rm -rf /var/www/billing-frontend/*
cp -a dist/. /var/www/billing-frontend/

# 5. Reload Nginx
echo ""
echo "🔄 [5/5] Reloading Nginx Web Server..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx || true
elif command -v service >/dev/null 2>&1; then
  service nginx reload || true
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "🌐 URL: https://app.dealingindia.com"
echo "=========================================="
echo ""
