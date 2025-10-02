#!/usr/bin/env node

/**
 * Configuration Validation Script
 * Validates environment configuration for Dreamscapes AI Provider Integration
 */

const fs = require('fs');
const path = require('path');

// Required environment variables for each environment
const REQUIRED_VARS = {
  common: ['NODE_ENV', 'CEREBRAS_API_KEY', 'OPENAI_API_KEY', 'REDIS_URL'],
  development: ['LOG_LEVEL'],
  staging: ['CACHE_QUALITY_THRESHOLD', 'PROVIDER_TIMEOUT'],
  production: [
    'FRONTEND_API_URL',
    'FRONTEND_URL',
    'SECURE_HEADERS',
    'RATE_LIMIT_ENABLED',
  ],
};

// Configuration validation rules
const VALIDATION_RULES = {
  CEREBRAS_TEMPERATURE: (value) => {
    const temp = parseFloat(value);
    return temp >= 0 && temp <= 2;
  },
  CEREBRAS_TOP_P: (value) => {
    const topP = parseFloat(value);
    return topP >= 0 && topP <= 1;
  },
  CEREBRAS_MAX_TOKENS: (value) => {
    const tokens = parseInt(value);
    return tokens > 0 && tokens <= 65536;
  },
  CACHE_QUALITY_THRESHOLD: (value) => {
    const threshold = parseFloat(value);
    return threshold >= 0 && threshold <= 1;
  },
  PROVIDER_RETRY_ATTEMPTS: (value) => {
    const attempts = parseInt(value);
    return attempts >= 0 && attempts <= 10;
  },
  PROVIDER_TIMEOUT: (value) => {
    const timeout = parseInt(value);
    return timeout >= 1000 && timeout <= 300000; // 1s to 5min
  },
  LOG_LEVEL: (value) => {
    return ['error', 'warn', 'info', 'debug'].includes(value);
  },
};

/**
 * Load environment configuration
 */
function loadEnvironmentConfig(env = process.env.NODE_ENV || 'development') {
  const configPath = path.join(__dirname, `${env}.env`);

  if (!fs.existsSync(configPath)) {
    console.warn(`⚠️  Configuration file not found: ${configPath}`);
    return {};
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  const config = {};

  configContent.split('\n').forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        config[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    }
  });

  return config;
}

/**
 * Validate configuration
 */
function validateConfiguration(env = process.env.NODE_ENV || 'development') {
  console.log(`🔍 Validating configuration for environment: ${env}`);

  const config = { ...process.env, ...loadEnvironmentConfig(env) };
  const errors = [];
  const warnings = [];

  // Check required variables
  const requiredVars = [...REQUIRED_VARS.common, ...(REQUIRED_VARS[env] || [])];

  requiredVars.forEach((varName) => {
    if (!config[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Validate configuration values
  Object.entries(VALIDATION_RULES).forEach(([varName, validator]) => {
    if (config[varName] && !validator(config[varName])) {
      errors.push(`Invalid value for ${varName}: ${config[varName]}`);
    }
  });

  // Environment-specific validations
  if (env === 'production') {
    // Production-specific checks
    if (config.LOG_LEVEL === 'debug') {
      warnings.push(
        'Debug logging enabled in production - consider using "warn" or "error"'
      );
    }

    if (config.CACHE_ENABLE_SEMANTIC_SIMILARITY !== 'true') {
      warnings.push(
        'Semantic similarity caching disabled in production - may impact performance'
      );
    }

    if (!config.SECURE_HEADERS || config.SECURE_HEADERS !== 'true') {
      errors.push('Security headers must be enabled in production');
    }
  }

  if (env === 'development') {
    // Development-specific checks
    if (config.CACHE_MAX_SIZE && parseInt(config.CACHE_MAX_SIZE) > 5000) {
      warnings.push(
        'Large cache size in development may consume excessive memory'
      );
    }
  }

  // API Key validation (basic format check)
  if (config.CEREBRAS_API_KEY && !config.CEREBRAS_API_KEY.startsWith('csk-')) {
    warnings.push(
      'Cerebras API key format may be incorrect (should start with "csk-")'
    );
  }

  if (config.OPENAI_API_KEY && !config.OPENAI_API_KEY.startsWith('sk-')) {
    warnings.push(
      'OpenAI API key format may be incorrect (should start with "sk-")'
    );
  }

  // Report results
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach((error) => console.error(`   • ${error}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach((warning) => console.warn(`   • ${warning}`));
  }

  console.log('✅ Configuration validation passed');

  // Output configuration summary
  console.log('\n📋 Configuration Summary:');
  console.log(`   Environment: ${env}`);
  console.log(`   Cerebras Model: ${config.CEREBRAS_MODEL || 'default'}`);
  console.log(`   OpenAI Model: ${config.OPENAI_MODEL || 'default'}`);
  console.log(`   Cache Size: ${config.CACHE_MAX_SIZE || 'default'}`);
  console.log(`   Provider Timeout: ${config.PROVIDER_TIMEOUT || 'default'}ms`);
  console.log(`   Log Level: ${config.LOG_LEVEL || 'default'}`);

  return true;
}

/**
 * Generate configuration template
 */
function generateConfigTemplate(env) {
  const templatePath = path.join(__dirname, `${env}.env.template`);
  const requiredVars = [...REQUIRED_VARS.common, ...(REQUIRED_VARS[env] || [])];

  let template = `# ${env.toUpperCase()} Environment Configuration Template\n`;
  template += `# Generated on ${new Date().toISOString()}\n\n`;

  requiredVars.forEach((varName) => {
    template += `${varName}=\n`;
  });

  fs.writeFileSync(templatePath, template);
  console.log(`📝 Configuration template generated: ${templatePath}`);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const env = args[1] || process.env.NODE_ENV || 'development';

  switch (command) {
    case 'validate':
      validateConfiguration(env);
      break;
    case 'template':
      generateConfigTemplate(env);
      break;
    default:
      console.log('Usage:');
      console.log('  node validate-config.js validate [environment]');
      console.log('  node validate-config.js template [environment]');
      console.log('');
      console.log('Environments: development, staging, production');
      process.exit(1);
  }
}

module.exports = {
  validateConfiguration,
  loadEnvironmentConfig,
  generateConfigTemplate,
};
