# Dreamscapes Configuration System

This directory contains environment-specific configurations for the enhanced AI provider integration in Dreamscapes.

## Files Overview

- **`development.env`** - Development environment configuration
- **`staging.env`** - Staging environment configuration
- **`production.env`** - Production environment configuration
- **`validate-config.js`** - Configuration validation utility
- **`config-loader.js`** - Configuration loading and management utility
- **`startup-check.js`** - Startup validation and connectivity checks

## Environment Configuration

### Development Environment

- Optimized for fast development and debugging
- Lower cache sizes and shorter timeouts
- Debug logging enabled
- Semantic similarity caching disabled for faster startup

### Staging Environment

- Production-like configuration for testing
- Moderate cache sizes and timeouts
- Info-level logging
- Full feature set enabled

### Production Environment

- Optimized for performance and reliability
- Large cache sizes and longer timeouts
- Warning-level logging only
- Security features enabled
- Rate limiting configured

## Configuration Variables

### Cerebras AI Configuration

- `CEREBRAS_API_KEY` - API key for Cerebras service
- `CEREBRAS_MODEL` - Model to use (default: llama-3.3-70b)
- `CEREBRAS_TEMPERATURE` - Creativity control (0.0-2.0)
- `CEREBRAS_TOP_P` - Token selection threshold (0.0-1.0)
- `CEREBRAS_MAX_TOKENS` - Maximum tokens per request
- `CEREBRAS_STREAM` - Enable streaming responses

### Provider Management

- `PROVIDER_FALLBACK_ENABLED` - Enable automatic fallback to OpenAI
- `PROVIDER_RETRY_ATTEMPTS` - Number of retry attempts
- `PROVIDER_RETRY_DELAY` - Delay between retries (ms)
- `PROVIDER_TIMEOUT` - Request timeout (ms)
- `PROVIDER_CIRCUIT_BREAKER_THRESHOLD` - Circuit breaker failure threshold

### Caching Configuration

- `CACHE_DEFAULT_TTL` - Default cache time-to-live (seconds)
- `CACHE_MAX_SIZE` - Maximum number of cached items
- `CACHE_ENABLE_SEMANTIC_SIMILARITY` - Enable semantic similarity matching
- `CACHE_QUALITY_THRESHOLD` - Minimum quality score for caching

### Monitoring Configuration

- `ENABLE_METRICS` - Enable metrics collection
- `METRICS_INTERVAL` - Metrics collection interval (ms)
- `LOG_LEVEL` - Logging level (error, warn, info, debug)

## Usage

### Loading Configuration

```javascript
const configLoader = require('./config/config-loader');

// Load configuration for current environment
const config = configLoader.load();

// Get specific configuration sections
const cerebrasConfig = configLoader.getCerebrasConfig();
const providerConfig = configLoader.getProviderConfig();
const cacheConfig = configLoader.getCacheConfig();
```

### Validating Configuration

```bash
# Validate current environment configuration
node config/validate-config.js validate

# Validate specific environment
node config/validate-config.js validate production

# Generate configuration template
node config/validate-config.js template development
```

### Startup Checks

```bash
# Run comprehensive startup checks
node config/startup-check.js
```

## Docker Integration

The configuration system is integrated with Docker through environment-specific compose files:

- `docker-compose.yml` - Base configuration
- `docker-compose.dev.yml` - Development overrides
- `docker-compose.prod.yml` - Production overrides

### Running with Specific Environment

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Security Considerations

### Development

- API keys should be stored in `.env` file (not committed to git)
- Debug logging may expose sensitive information
- Relaxed security settings for easier development

### Production

- API keys must be provided through secure environment variables
- Security headers enabled
- Rate limiting configured
- Minimal logging to reduce information exposure

## Configuration Validation

The system includes comprehensive validation:

1. **Required Variables** - Ensures all necessary variables are present
2. **Value Validation** - Validates ranges and formats
3. **Environment-Specific Checks** - Additional checks per environment
4. **API Connectivity** - Tests API endpoints during startup
5. **Redis Connectivity** - Verifies cache system availability

## Troubleshooting

### Common Issues

1. **Missing API Keys**

   - Ensure `CEREBRAS_API_KEY` and `OPENAI_API_KEY` are set
   - Check API key format (Cerebras: `csk-*`, OpenAI: `sk-*`)

2. **Configuration Validation Errors**

   - Run `node config/validate-config.js validate` to see specific issues
   - Check value ranges for numeric configurations

3. **Startup Check Failures**

   - Verify API connectivity
   - Check Redis availability
   - Review configuration values

4. **Performance Issues**
   - Adjust cache sizes based on available memory
   - Tune timeout values for your network conditions
   - Consider disabling semantic similarity in development

### Getting Help

1. Check the validation output for specific error messages
2. Review the configuration summary during startup
3. Enable debug logging to see detailed configuration loading
4. Verify environment variable substitution is working correctly

## Best Practices

1. **Environment Separation** - Use different configurations for each environment
2. **Secret Management** - Never commit API keys to version control
3. **Validation** - Always validate configuration before deployment
4. **Monitoring** - Enable metrics collection in production
5. **Fallback** - Configure OpenAI as fallback provider
6. **Caching** - Tune cache settings based on usage patterns
7. **Logging** - Use appropriate log levels for each environment
