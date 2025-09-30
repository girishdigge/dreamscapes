# Multi-stage build for better caching
FROM node:24.8.0-alpine3.21 AS base
WORKDIR /app

# Install dependencies in a separate layer for better caching
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development dependencies
FROM base AS dev-deps
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Development stage
FROM base AS development
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8000
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8000
CMD ["npm", "start"]

# Default to development
FROM development
