# syntax=docker/dockerfile:1

# ── Base ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
WORKDIR /app
# El hook de husky (prepare) solo tiene sentido en desarrollo.
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare
COPY apps/api/package.json apps/api/
# postinstall ejecuta `prisma generate`, que necesita el schema y la config.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/

# ── Dependencias completas + build ─────────────────────────────────────
FROM base AS build
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run prisma:generate -w apps/api && npm run build -w apps/api

# ── Solo dependencias de producción (incluye el CLI de prisma para migrar) ─
FROM base AS prod-deps
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false

# ── Imagen final ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    APP_PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app ./
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
RUN mkdir -p /data/media && chown node:node /data/media
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica las migraciones pendientes y arranca la app.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
