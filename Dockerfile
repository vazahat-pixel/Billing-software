# Textile ERP SaaS — production image
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
ENV NODE_ENV=production
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/health/live || exit 1
CMD ["node", "server.js"]
