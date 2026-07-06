# ── Build Stage ──
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY backend/package.json backend/tsconfig.json ./backend/
COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/postcss.config.js frontend/tailwind.config.js ./frontend/
COPY frontend/index.html ./frontend/

# Install all deps (including devDeps for build)
RUN npm ci

# Copy source
COPY shared/src ./shared/src
COPY backend/src ./backend/src
COPY frontend/src ./frontend/src

# Build shared, backend, then frontend
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend
RUN npm run build --workspace=frontend

# Prune devDeps
RUN npm prune --omit=dev

# ── Runtime Stage ──
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy built artifacts + production node_modules (workspace hoists to root)
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_DIST_PATH=/app/frontend/dist

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
