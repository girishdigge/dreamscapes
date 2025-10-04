#!/bin/bash

# Configuration Management Script for Dreamscapes
# Manages environment-specific configurations and secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
show_help() {
  echo "Dreamscapes Configuration Management"
  echo ""
  echo "Usage: $0 <command> [environment]"
  echo ""
  echo "Commands:"
  echo "  validate <env>    - Validate configuration for environment"
  echo "  template <env>    - Generate configuration template"
  echo "  check <env>       - Run startup checks"
  echo "  setup <env>       - Setup environment configuration"
  echo "  secrets <env>     - Manage secrets for environment"
  echo "  compare <env1> <env2> - Compare configurations"
  echo ""
  echo "Environments: development, staging, production"
  echo ""
  echo "Examples:"
  echo "  $0 validate production"
  echo "  $0 setup development"
  echo "  $0 secrets production"
}

validate_config() {
  local env=$1
  echo -e "${BLUE}🔍 Validating configuration for ${env}...${NC}"
  
  if node config/validate-config.js validate "$env"; then
    echo -e "${GREEN}✅ Configuration validation passed for ${env}${NC}"
  else
    echo -e "${RED}❌ Configuration validation failed for ${env}${NC}"
    return 1
  fi
}

generate_template() {
  local env=$1
  echo -e "${BLUE}📝 Generating configuration template for ${env}...${NC}"
  
  node config/validate-config.js template "$env"
  echo -e "${GREEN}✅ Template generated for ${env}${NC}"
}

run_startup_checks() {
  local env=$1
  echo -e "${BLUE}🚀 Running startup checks for ${env}...${NC}"
  
  export NODE_ENV="$env"
  if node config/startup-check.js; then
    echo -e "${GREEN}✅ Startup checks passed for ${env}${NC}"
  else
    echo -e "${RED}❌ Startup checks failed for ${env}${NC}"
    return 1
  fi
}

setup_environment() {
  local env=$1
  echo -e "${BLUE}⚙️  Setting up environment: ${env}${NC}"
  
  # Create environment-specific .env file
  local env_file=".env.${env}"
  local config_file="config/${env}.env"
  
  if [ -f "$config_file" ]; then
    echo -e "${GREEN}📄 Creating ${env_file} from ${config_file}${NC}"
    cp "$config_file" "$env_file"
    
    # Substitute environment variables
    if [ -f .env ]; then
      echo -e "${BLUE}🔄 Merging with base .env file${NC}"
      # Merge base .env with environment-specific config
      cat .env "$config_file" > "$env_file.tmp"
      mv "$env_file.tmp" "$env_file"
    fi
    
    echo -e "${GREEN}✅ Environment file created: ${env_file}${NC}"
  else
    echo -e "${RED}❌ Configuration file not found: ${config_file}${NC}"
    return 1
  fi
  
  # Validate the setup
  validate_config "$env"
}

manage_secrets() {
  local env=$1
  echo -e "${BLUE}🔐 Managing secrets for ${env}...${NC}"
  
  local secrets_file="config/.secrets.${env}"
  
  if [ ! -f "$secrets_file" ]; then
    echo -e "${YELLOW}📝 Creating secrets file: ${secrets_file}${NC}"
    cat > "$secrets_file" << EOF
# Secrets for ${env} environment
# This file should not be committed to version control

CEREBRAS_API_KEY=
OPENAI_API_KEY=
REDIS_PASSWORD=
DATABASE_PASSWORD=
JWT_SECRET=
ENCRYPTION_KEY=
EOF
    echo -e "${GREEN}✅ Secrets template created${NC}"
    echo -e "${YELLOW}⚠️  Please edit ${secrets_file} with actual secret values${NC}"
  else
    echo -e "${GREEN}📄 Secrets file exists: ${secrets_file}${NC}"
  fi
  
  # Check if secrets are properly set
  if [ -f "$secrets_file" ]; then
    echo -e "${BLUE}🔍 Checking secrets...${NC}"
    
    while IFS='=' read -r key value; do
      if [[ $key =~ ^[A-Z_]+$ ]] && [[ -z "$value" ]]; then
        echo -e "${YELLOW}⚠️  Secret not set: ${key}${NC}"
      fi
    done < "$secrets_file"
  fi
}

compare_configs() {
  local env1=$1
  local env2=$2
  
  echo -e "${BLUE}📊 Comparing configurations: ${env1} vs ${env2}${NC}"
  
  local config1="config/${env1}.env"
  local config2="config/${env2}.env"
  
  if [ ! -f "$config1" ]; then
    echo -e "${RED}❌ Configuration file not found: ${config1}${NC}"
    return 1
  fi
  
  if [ ! -f "$config2" ]; then
    echo -e "${RED}❌ Configuration file not found: ${config2}${NC}"
    return 1
  fi
  
  echo -e "${BLUE}Differences between ${env1} and ${env2}:${NC}"
  diff -u "$config1" "$config2" || true
}

# Main script logic
COMMAND=$1
ENVIRONMENT=$2

case $COMMAND in
  validate)
    if [ -z "$ENVIRONMENT" ]; then
      echo -e "${RED}❌ Environment required for validate command${NC}"
      show_help
      exit 1
    fi
    validate_config "$ENVIRONMENT"
    ;;
  template)
    if [ -z "$ENVIRONMENT" ]; then
      echo -e "${RED}❌ Environment required for template command${NC}"
      show_help
      exit 1
    fi
    generate_template "$ENVIRONMENT"
    ;;
  check)
    if [ -z "$ENVIRONMENT" ]; then
      echo -e "${RED}❌ Environment required for check command${NC}"
      show_help
      exit 1
    fi
    run_startup_checks "$ENVIRONMENT"
    ;;
  setup)
    if [ -z "$ENVIRONMENT" ]; then
      echo -e "${RED}❌ Environment required for setup command${NC}"
      show_help
      exit 1
    fi
    setup_environment "$ENVIRONMENT"
    ;;
  secrets)
    if [ -z "$ENVIRONMENT" ]; then
      echo -e "${RED}❌ Environment required for secrets command${NC}"
      show_help
      exit 1
    fi
    manage_secrets "$ENVIRONMENT"
    ;;
  compare)
    ENV2=$3
    if [ -z "$ENVIRONMENT" ] || [ -z "$ENV2" ]; then
      echo -e "${RED}❌ Two environments required for compare command${NC}"
      show_help
      exit 1
    fi
    compare_configs "$ENVIRONMENT" "$ENV2"
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
    show_help
    exit 1
    ;;
esac