#!/usr/bin/env bash
# Deploy BOTH frontend + backend on SAME VPS (no Docker)
# Safe next to other PM2 apps: uses port 5010 + name billing-api
set -euo pipefail

APP_DIR="/opt/Billing-software"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
WEB_ROOT="/var/www/billing-frontend"
API_PORT="5010"
PM2_NAME="billing-api"
SERVER_DOMAIN="${DOMAIN:-app.dealingindia.com}"
PUBLIC_URL="http://${SERVER_DOMAIN}"

echo "==> Using public URL: $PUBLIC_URL"

if ss -tlnp | grep -q ":${API_PORT} "; then
  if ! pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    echo "ERROR: Port $API_PORT already used by another app. Edit API_PORT in this script."
    ss -tlnp | grep ":${API_PORT} "
    exit 1
  fi
fi

wait_for_apt_lock() {
  local max_wait=30
  local waited=0
  while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    if [ $waited -ge $max_wait ]; then
      echo "Notice: apt lock is still held by background process. Proceeding..."
      break
    fi
    echo "Waiting for background apt update to finish (${waited}s)..."
    sleep 3
    waited=$((waited + 3))
  done
}

echo "==> Checking system dependencies (Node 20, Git, Nginx, PM2)"
NEED_NODE=0
NEED_GIT=0
NEED_NGINX=0

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  NEED_NODE=1
fi
if ! command -v git >/dev/null 2>&1; then
  NEED_GIT=1
fi
if ! command -v nginx >/dev/null 2>&1; then
  NEED_NGINX=1
fi

if [[ $NEED_NODE -eq 1 || $NEED_GIT -eq 1 || $NEED_NGINX -eq 1 ]]; then
  echo "==> Installing missing packages..."
  wait_for_apt_lock
  apt-get update -y || true
  if [[ $NEED_NODE -eq 1 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || true
    apt-get install -y nodejs build-essential git || true
  fi
  if [[ $NEED_GIT -eq 1 ]]; then
    apt-get install -y git || true
  fi
  if [[ $NEED_NGINX -eq 1 ]]; then
    apt-get install -y nginx || true
  fi
else
  echo "==> Node 20+, Git, and Nginx are already installed. Skipping apt update."
fi

command -v pm2 >/dev/null 2>&1 || npm i -g pm2

if ss -tln | grep -q ':27017 '; then
  echo "==> MongoDB is already active on port 27017."
elif command -v mongod >/dev/null 2>&1 || systemctl is-active --quiet mongod; then
  echo "==> Starting existing MongoDB service..."
  systemctl start mongod || true
else
  echo "==> MongoDB not found — installing MongoDB for Ubuntu/Debian"
  if [[ -f /var/lib/dpkg/info/openssh-server.postinst ]]; then
    sed -i 's/deb-systemd-invoke/echo deb-systemd-invoke/g' /var/lib/dpkg/info/openssh-server.postinst 2>/dev/null || true
  fi
  dpkg --configure -a 2>/dev/null || true
  wait_for_apt_lock
  apt-get install -y gnupg curl || true
  . /etc/os-release
  if [[ "${VERSION_CODENAME:-}" == "noble" ]]; then
    rm -f /etc/apt/sources.list.d/mongodb-org-7.0.list
    curl -fsSL https://pgp.mongodb.com/server-8.0.asc | gpg --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" > /etc/apt/sources.list.d/mongodb-org.list
  elif [[ "${ID:-}" == "debian" ]]; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --yes -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian ${VERSION_CODENAME}/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org.list
  else
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --yes -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org.list
  fi
  apt-get update -y || true
  apt-get install -y mongodb-org || true
  systemctl daemon-reload || true
  systemctl enable --now mongod || systemctl start mongod || true
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "==> Cloning repository to $APP_DIR..."
  git clone https://github.com/vazahat-pixel/Billing-software.git "$APP_DIR"
elif [[ -d "$APP_DIR/.git" ]]; then
  echo "==> Pulling latest changes from git..."
  git -C "$APP_DIR" pull origin main || true
fi

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "ERROR: $BACKEND_DIR missing. Check git clone or project upload."
  exit 1
fi

if [[ -f "$BACKEND_DIR/.env" ]] && grep -q '^JWT_SECRET=' "$BACKEND_DIR/.env"; then
  JWT_SECRET="$(grep '^JWT_SECRET=' "$BACKEND_DIR/.env" | cut -d= -f2-)"
else
  JWT_SECRET="$(openssl rand -base64 32)"
fi

cat > "$BACKEND_DIR/.env" <<EOF
NODE_ENV=production
PORT=${API_PORT}
MONGO_URI=mongodb://127.0.0.1:27017/billing_software
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRES=8h
JWT_REFRESH_DAYS=30
FRONTEND_URL=${PUBLIC_URL}
RATE_LIMIT_MAX=1000
BACKUP_DIR=./backups
LOG_LEVEL=info
EOF

echo "==> Backend dependencies + migrate + seed"
cd "$BACKEND_DIR"
rm -rf node_modules package-lock.json
npm install --omit=dev --no-audit --no-fund
npm run migrate || true
node seed.js || true

echo "==> PM2 start/restart $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start server.js --name "$PM2_NAME" --time
fi
pm2 save

echo "==> Build frontend (same-origin /api)"
cd "$FRONTEND_DIR"
# Empty VITE_API_URL => browser uses relative /api (nginx proxies it)
rm -f .env.production.local
printf 'VITE_API_URL=\n' > .env.production.local
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund
npm run build

mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -a dist/. "$WEB_ROOT/"
# SPA fallback for deep links if using apache elsewhere; nginx handles try_files

echo "==> Nginx site (frontend + /api proxy) — does not remove other sites"
cat > /etc/nginx/sites-available/billing.conf <<EOF
server {
    listen 80;
    server_name ${SERVER_DOMAIN};

    root ${WEB_ROOT};
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /health {
        proxy_pass http://127.0.0.1:${API_PORT}/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/billing.conf /etc/nginx/sites-enabled/billing.conf
nginx -t
systemctl reload nginx

echo ""
echo "================ DONE ================"
echo "Frontend:  ${PUBLIC_URL}"
echo "API:       ${PUBLIC_URL}/api"
echo "Health:    ${PUBLIC_URL}/health/ready"
echo "Admin:     admin@textileerp.com / Admin@123"
echo "PM2:       pm2 logs ${PM2_NAME}"
echo "JWT saved in: ${BACKEND_DIR}/.env"
echo "======================================"
curl -sS "http://127.0.0.1:${API_PORT}/health/ready" || true
echo ""
