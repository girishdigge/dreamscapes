# Multi-stage build for enhanced AI provider integration
FROM node:24.8.0-alpine3.21 AS base

# Install system dependencies for enhanced AI processing
RUN apk add --no-cache \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Install dependencies in a separate layer for better caching
FROM base AS deps
# Mirror local structure: set working directory to match local development
WORKDIR /app/services/mcp-gateway
COPY shared/ /app/shared/
COPY services/mcp-gateway/package*.json ./
RUN npm ci --only=production && npm cache clean --force
WORKDIR /app

# Development dependencies with TypeScript support
FROM base AS dev-deps
# Mirror local structure: set working directory to match local development
WORKDIR /app/services/mcp-gateway
COPY shared/ /app/shared/
COPY services/mcp-gateway/package*.json ./
RUN npm ci && npm cache clean --force
WORKDIR /app

# Development stage with enhanced debugging
FROM base AS development
# Mirror local structure: set working directory to match local development
WORKDIR /app/services/mcp-gateway
COPY --from=dev-deps /app/services/mcp-gateway/node_modules ./node_modules
COPY shared/ /app/shared/
COPY services/mcp-gateway/ .
EXPOSE 8080
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=1024"
# Health check endpoint for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["npm", "run", "dev"]

# Production stage with optimizations
FROM base AS production
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
# Mirror local structure: set working directory to match local development
WORKDIR /app/services/mcp-gateway
COPY --from=deps /app/services/mcp-gateway/node_modules ./node_modules
COPY shared/ /app/shared/
COPY services/mcp-gateway/ .
EXPOSE 8080
# Health check endpoint for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["npm", "start"]

# Default to development
FROM development
