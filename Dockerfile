# ==============================================================================
# MedEx Production Multi-Stage Dockerfile
# Stage 1: Frontend Builder (React / Vite)
# Stage 2: Backend Production Dependencies
# Stage 3: Minimal Production Runtime (Node.js Alpine)
# ==============================================================================

# --- Stage 1: Frontend Builder ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install dependencies deterministically
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Copy frontend source files
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src/ ./src/
COPY public/ ./public/

# Build production bundle (outputs to /app/dist)
ENV NODE_ENV=production
RUN npm run build

# --- Stage 2: Backend Dependencies ---
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend

# Install backend production dependencies only
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit

# --- Stage 3: Minimal Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

# Install curl for Docker healthcheck probe
RUN apk add --no-cache curl

# Production environment settings
ENV NODE_ENV=production
ENV PORT=5000

# Create required directories and set ownership to unprivileged 'node' user
RUN mkdir -p /app/backend /app/dist /app/backend/uploads \
    && chown -R node:node /app

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder --chown=node:node /app/dist /app/dist

# Copy backend production dependencies from Stage 2
COPY --from=backend-deps --chown=node:node /app/backend/node_modules /app/backend/node_modules

# Copy backend application source files
COPY --chown=node:node backend/server.js /app/backend/
COPY --chown=node:node backend/package.json /app/backend/
COPY --chown=node:node backend/config/ /app/backend/config/
COPY --chown=node:node backend/controllers/ /app/backend/controllers/
COPY --chown=node:node backend/middleware/ /app/backend/middleware/
COPY --chown=node:node backend/routes/ /app/backend/routes/
COPY --chown=node:node backend/services/ /app/backend/services/
COPY --chown=node:node backend/utils/ /app/backend/utils/

# Switch to unprivileged user (UID 1000)
USER node

# Expose HTTP port
EXPOSE 5000

# Health check using existing /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start MedEx server
WORKDIR /app/backend
CMD ["node", "server.js"]
