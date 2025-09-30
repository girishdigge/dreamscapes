# Enhanced MCP Gateway Structure

This document describes the enhanced project structure and dependencies for the AI Provider Integration Enhancement.

## Directory Structure

```
services/mcp-gateway/
├── providers/                 # Enhanced provider management
│   ├── index.js              # Provider exports
│   ├── BaseProvider.js       # Base provider class
│   ├── ProviderManager.js    # Provider management logic (to be implemented)
│   ├── CerebrasProvider.js   # Enhanced Cerebras provider (to be implemented)
│   ├── OpenAIProvider.js     # Enhanced OpenAI provider (to be implemented)
│   └── LlamaProvider.js      # Enhanced Llama provider (to be implemented)
├── engine/                   # Processing engine components
│   ├── index.js              # Engine exports
│   ├── PromptEngine.js       # Advanced prompt engineering (to be implemented)
│   ├── ValidationPipeline.js # Content validation and repair (to be implemented)
│   └── ResponseCache.js      # Intelligent caching system (to be implemented)
├── templates/                # Prompt template system
│   ├── index.js              # Template exports
│   ├── BaseTemplates.js      # Core prompt templates (to be implemented)
│   ├── StyleTemplates.js     # Style-specific templates (to be implemented)
│   ├── QualityTemplates.js   # Quality-specific templates (to be implemented)
│   └── ContextTemplates.js   # Context-aware templates (to be implemented)
├── utils/                    # Enhanced utilities
│   ├── ErrorHandler.js       # Error classification and handling
│   └── Logger.js             # Structured logging system
├── config/                   # Enhanced configuration
│   ├── providers.js          # Provider-specific configurations
│   ├── cache.js              # Cache configuration
│   ├── validation.js         # Validation rules and schemas
│   ├── cerebras.js           # Legacy Cerebras config (to be updated)
│   ├── openai.js             # Legacy OpenAI config (to be updated)
│   └── prompts.js            # Legacy prompts config (to be updated)
├── types/                    # TypeScript definitions
│   └── index.d.ts            # Type definitions for all components
├── logs/                     # Log files directory
│   └── .gitkeep              # Ensures directory is tracked
├── services/                 # Legacy services (to be refactored)
│   ├── cerebrasService.js    # Current Cerebras implementation
│   ├── openaiService.js      # Current OpenAI implementation
│   └── promptBuilder.js      # Current prompt builder
├── tsconfig.json             # TypeScript configuration
└── package.json              # Updated with new dependencies
```

## New Dependencies

### Production Dependencies

- `redis`: ^4.6.0 - For intelligent response caching
- `joi`: ^17.11.0 - For schema validation and content validation
- `winston`: ^3.11.0 - For structured logging and monitoring
- `lodash`: ^4.17.21 - For utility functions and data manipulation
- `async`: ^3.2.5 - For async flow control and provider management

### Development Dependencies

- `@types/node`: ^20.10.0 - Node.js TypeScript definitions
- `@types/express`: ^4.17.21 - Express TypeScript definitions
- `@types/cors`: ^2.8.17 - CORS TypeScript definitions
- `@types/uuid`: ^9.0.7 - UUID TypeScript definitions
- `@types/lodash`: ^4.14.202 - Lodash TypeScript definitions
- `typescript`: ^5.3.0 - TypeScript compiler for type checking

## Key Features Implemented

### 1. Enhanced Provider Management

- **BaseProvider**: Abstract base class for all AI providers
- **Provider Registry**: Centralized provider management system
- **Health Monitoring**: Built-in health checks and metrics collection
- **Error Classification**: Sophisticated error handling and classification

### 2. TypeScript Support

- **Type Definitions**: Comprehensive TypeScript definitions for all components
- **Type Safety**: Better development experience with IntelliSense and type checking
- **Interface Definitions**: Clear contracts for all major components

### 3. Enhanced Configuration

- **Provider-Specific Config**: Dedicated configuration for each provider
- **Environment Variables**: Comprehensive environment variable support
- **Cache Configuration**: Redis-based caching configuration
- **Validation Rules**: Schema-based validation configuration

### 4. Structured Logging

- **Winston Logger**: Professional logging with structured data
- **Log Levels**: Configurable log levels for different environments
- **Error Tracking**: Detailed error logging with stack traces
- **Performance Metrics**: Request/response logging with timing data

### 5. Error Handling System

- **Error Classification**: Categorized error types for better handling
- **Retry Logic**: Exponential backoff and retry mechanisms
- **Fallback Support**: Automatic provider switching on failures
- **Circuit Breaker**: Protection against cascading failures

## Environment Variables

The enhanced system supports the following environment variables:

### Cerebras Configuration

- `CEREBRAS_ENABLED`: Enable/disable Cerebras provider (default: true)
- `CEREBRAS_PRIORITY`: Provider priority (default: 1)
- `CEREBRAS_MODEL`: Model to use (default: llama-4-maverick-17b-128e-instruct)
- `CEREBRAS_STREAMING`: Enable streaming responses (default: false)
- `CEREBRAS_MAX_TOKENS`: Maximum tokens (default: 32768)
- `CEREBRAS_TEMPERATURE`: Temperature setting (default: 0.6)
- `CEREBRAS_TOP_P`: Top-p setting (default: 0.9)

### Cache Configuration

- `REDIS_HOST`: Redis host (default: localhost)
- `REDIS_PORT`: Redis port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)
- `CACHE_TTL_DRAFT`: TTL for draft quality (default: 300s)
- `CACHE_TTL_STANDARD`: TTL for standard quality (default: 1800s)
- `CACHE_TTL_HIGH`: TTL for high quality (default: 3600s)
- `CACHE_TTL_CINEMATIC`: TTL for cinematic quality (default: 7200s)

### Logging Configuration

- `LOG_LEVEL`: Logging level (default: info)
- `NODE_ENV`: Environment (development/production)

## Next Steps

This structure provides the foundation for implementing the remaining tasks:

1. **Task 2**: Implement ProviderManager foundation
2. **Task 3**: Upgrade Cerebras service with official SDK
3. **Task 4**: Create enhanced prompt engineering system
4. **Task 5**: Implement intelligent provider fallback system
5. **Task 6**: Create validation and content repair pipeline
6. **Task 7**: Implement enhanced caching system
7. **Task 8**: Enhance error handling and monitoring

Each component has been designed to be modular and extensible, allowing for incremental implementation while maintaining backward compatibility with the existing system.
