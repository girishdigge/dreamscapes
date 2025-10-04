# Multi-stage build for better caching
FROM node:24.8.0-alpine3.21 AS base
WORKDIR /app

# Install dependencies in a separate layer for better caching
FROM base AS deps
# Copy shared module to match the relative path in package.json
# package.json has "file:../../shared" which from /app/services/express/ resolves to /app/shared/
WORKDIR /app/services/express
COPY shared/ /app/shared/
COPY services/express/package.json services/express/package-lock.json ./
# Remove lock file and regenerate to match Docker paths
RUN rm -f package-lock.json && npm install --only=production && npm cache clean --force
WORKDIR /app

# Development dependencies
FROM base AS dev-deps
# Copy shared module to match the relative path in package.json
# package.json has "file:../../shared" which from /app/ should resolve to /shared/
# But we need to create the directory structure that matches
WORKDIR /app/services/express
COPY shared/ /app/shared/
COPY services/express/package.json services/express/package-lock.json ./
# Remove lock file and regenerate to match Docker paths
RUN rm -f package-lock.json && npm install && npm cache clean --force
WORKDIR /app

# Development stage
FROM base AS development
WORKDIR /app/services/express
COPY --from=dev-deps /app/services/express/node_modules ./node_modules
COPY shared/ /app/shared/
COPY services/express/ .
EXPOSE 8000
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app/services/express
COPY --from=deps /app/services/express/node_modules ./node_modules
COPY shared/ /app/shared/
COPY services/express/ .
EXPOSE 8000
CMD ["npm", "start"]

# Default to development
FROM development
