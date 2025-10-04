#!/bin/bash

# Dreamscapes Environment Setup Script
# Sets up environment-specific configurations for Docker deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-development}

echo -e "${BLUE}🚀 Setting up Dreamscapes environment: ${ENVIRONMENT}${NC}"

# Validate environment
case $ENVIRONMENT in
  development|staging|production)
    echo -e "${GREEN}✅ Valid environment: ${ENVIRONMENT}${NC}"
    ;;
  *)
    echo -e "${RED}❌ Invalid environment: ${ENVIRONMENT}${NC}"
    echo "Valid environments: development, staging, production"
    exit 1
    ;;
esac

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  .env file not found, creating from .env.example${NC}"
  cp .env.example .env
  echo -e "${YELLOW}📝 Please edit .env file with your actual API keys${NC}"
fi

# Load environment-specific configuration
CONFIG_FILE="config/${ENVIRONMENT}.env"
if [ -f "$CONFIG_FILE" ]; then
  echo -e "${GREEN}✅ Loading configuration from ${CONFIG_FILE}${NC}"
  
  # Export environment variables from config file
  set -a
  source "$CONFIG_FILE"
  set +a
else
  echo -e "${YELLOW}⚠️  Configuration file not found: ${CONFIG_FILE}${NC}"
fi

# Validate configuration
echo -e "${BLUE}🔍 Validating configuration...${NC}"
if node config/validate-config.js validate $ENVIRONMENT; then
  echo -e "${GREEN}✅ Configuration validation passed${NC}"
else
  echo -e "${RED}❌ Configuration validation failed${NC}"
  exit 1
fi

# Set up Docker Compose files
COMPOSE_FILES="-f docker-compose.yml"

case $ENVIRONMENT in
  development)
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.dev.yml"
    ;;
  production)
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
    ;;
  staging)
    # Use production compose file for staging
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
    ;;
esac

echo -e "${BLUE}📦 Docker Compose files: ${COMPOSE_FILES}${NC}"

# Create environment-specific .env file for Docker
ENV_FILE=".env.${ENVIRONMENT}"
echo -e "${BLUE}📝 Creating ${ENV_FILE}...${NC}"

# Copy base .env and append environment-specific variables
cp .env "$ENV_FILE"
if [ -f "$CONFIG_FILE" ]; then
  echo "" >> "$ENV_FILE"
  echo "# Environment-specific configuration from ${CONFIG_FILE}" >> "$ENV_FILE"
  cat "$CONFIG_FILE" >> "$ENV_FILE"
fi

echo -e "${GREEN}✅ Environment setup complete${NC}"

# Display next steps
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Review and update API keys in .env file"
echo "2. Run: docker-compose ${COMPOSE_FILES} up --build"
echo "3. Or use the provided scripts:"
echo "   - Development: ./scripts/dev-setup.sh"
echo "   - Production: docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"

# Check for required API keys
echo -e "${BLUE}🔑 Checking API keys...${NC}"
if [ -z "$CEREBRAS_API_KEY" ] || [ "$CEREBRAS_API_KEY" = "your_cerebras_api_key_here" ]; then
  echo -e "${YELLOW}⚠️  CEREBRAS_API_KEY not set or using placeholder${NC}"
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
  echo -e "${YELLOW}⚠️  OPENAI_API_KEY not set or using placeholder${NC}"
fi

echo -e "${GREEN}🎉 Environment setup for ${ENVIRONMENT} completed successfully!${NC}"