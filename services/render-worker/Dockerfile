# Multi-stage build for render worker
FROM node:24.8.0-alpine3.21 AS base

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app

# System dependencies stage - cached separately
FROM base AS system-deps
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ttf-freefont \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Dependencies stage
FROM system-deps AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Development dependencies
FROM system-deps AS dev-deps
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Development stage
FROM system-deps AS development
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8001
ENV NODE_ENV=development
ENV PORT=8001
CMD ["npm", "run", "dev"]

# Production stage
FROM system-deps AS production
ENV NODE_ENV=production
ENV PORT=8001
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8001
CMD ["node", "server.js"]

# Default to development
FROM development
