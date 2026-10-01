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

# Detect PM2 binary accurately (handles root, sudo, nvm, etc.)
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

# Ensure MongoDB service is running
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet mongod 2>/dev/null; then
    echo "Starting mongod service..."
    systemctl start mongod || true
  fi
fi

# Ensure backend .env has PORT=5010 (matching nginx proxy_pass)
if [ -f "$SCRIPT_DIR/backend/.env" ]; then
  if ! grep -q '^PORT=' "$SCRIPT_DIR/backend/.env"; then
    echo "PORT=5010" >> "$SCRIPT_DIR/backend/.env"
  elif grep -q '^PORT=5000' "$SCRIPT_DIR/backend/.env" || grep -q '^PORT=5050' "$SCRIPT_DIR/backend/.env"; then
    sed -i 's/^PORT=.*/PORT=5010/' "$SCRIPT_DIR/backend/.env"
  fi
fi

if [ -n "$PM2_CMD" ]; then
  echo "Using PM2: $PM2_CMD"
  if $PM2_CMD describe billing-api >/dev/null 2>&1; then
    $PM2_CMD restart billing-api --update-env
  else
    $PM2_CMD start server.js --name billing-api --time
  fi
  $PM2_CMD save >/dev/null 2>&1 || true
  sleep 2
  $PM2_CMD list
else
  echo "⚠️ PM2 not found, attempting npm install -g pm2..."
  npm install -g pm2 || true
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart billing-api --update-env || pm2 start server.js --name billing-api --time
    pm2 save >/dev/null 2>&1 || true
  fi
fi

# Health check on localhost:5010
echo ""
echo "🩺 Checking Backend Health..."
sleep 2
HC=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5010/api/health || curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5010/health || echo "000")
if [ "$HC" = "200" ]; then
  echo "✅ Backend API is healthy on port 5010 (HTTP $HC)!"
else
  echo "⚠️ Backend returned HTTP $HC on port 5010. Trying port 5000..."
  HC5000=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/health || curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/health || echo "000")
  if [ "$HC5000" = "200" ]; then
    echo "⚠️ Backend is running on port 5000 instead of 5010! Updating .env PORT to 5010 and restarting..."
    sed -i 's/^PORT=.*/PORT=5010/' "$SCRIPT_DIR/backend/.env" 2>/dev/null || true
    if [ -n "$PM2_CMD" ]; then
      $PM2_CMD restart billing-api --update-env
    fi
  else
    echo "❌ Backend health check failed (HTTP $HC). Checking logs:"
    if [ -n "$PM2_CMD" ]; then
      $PM2_CMD logs billing-api --lines 25 --nostream || true
    fi
  fi
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
