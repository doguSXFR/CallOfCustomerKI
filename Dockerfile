# ── Build Stage ──
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY backend/package.json backend/tsconfig.json ./backend/

# Install all deps (including devDeps for build)
RUN npm ci

# Copy source
COPY shared/src ./shared/src
COPY backend/src ./backend/src

# Build shared first, then backend
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

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

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
