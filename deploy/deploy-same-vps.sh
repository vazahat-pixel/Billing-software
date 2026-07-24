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
SERVER_IP="${SERVER_IP:-200.97.175.23}"
PUBLIC_URL="http://${SERVER_IP}"

echo "==> Using public URL: $PUBLIC_URL"

if ss -tlnp | grep -q ":${API_PORT} "; then
  if ! pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    echo "ERROR: Port $API_PORT already used by another app. Edit API_PORT in this script."
    ss -tlnp | grep ":${API_PORT} "
    exit 1
  fi
fi

echo "==> Ensure Node 20, nginx, pm2"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs build-essential
fi
apt-get install -y nginx
command -v pm2 >/dev/null 2>&1 || npm i -g pm2

if ! command -v mongod >/dev/null 2>&1 && ! systemctl is-active --quiet mongod; then
  echo "==> MongoDB not found — installing MongoDB 7"
  apt-get install -y gnupg curl
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  . /etc/os-release
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -y
  apt-get install -y mongodb-org || true
  systemctl enable --now mongod || true
fi

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "ERROR: $BACKEND_DIR missing. Upload project first."
  exit 1
fi

JWT_SECRET="$(openssl rand -base64 32)"
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

echo "==> Backend npm ci + migrate + seed"
cd "$BACKEND_DIR"
npm ci
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
npm ci
npm run build

mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -a dist/. "$WEB_ROOT/"
# SPA fallback for deep links if using apache elsewhere; nginx handles try_files

echo "==> Nginx site (frontend + /api proxy) — does not remove other sites"
cat > /etc/nginx/sites-available/billing <<EOF
server {
    listen 80;
    server_name ${SERVER_IP};

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

ln -sf /etc/nginx/sites-available/billing /etc/nginx/sites-enabled/billing
nginx -t
systemctl reload nginx

ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

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
