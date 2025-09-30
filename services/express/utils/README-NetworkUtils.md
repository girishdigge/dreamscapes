# Network Utils - Retry Mechanism and Circuit Breaker

This module provides robust HTTP request handling with retry mechanisms and circuit breaker patterns for the Dreamscapes Express service.

## Features

### 1. fetchWithRetry Function

- **Exponential backoff** with configurable base delay, multiplier, and maximum delay
- **Jitter** to prevent thundering herd problems
- **Timeout handling** with AbortController
- **Error categorization** for intelligent retry decisions
- **Comprehensive logging** for debugging and monitoring

### 2. Circuit Breaker Pattern

- **Failure threshold** configuration to prevent cascading failures
- **Timeout period** for recovery attempts
- **State management** (CLOSED, OPEN, HALF_OPEN)
- **Automatic recovery** when service becomes healthy again

### 3. Error Categorization

Automatically categorizes network errors for appropriate handling:

- `timeout` - Request timeouts (retryable)
- `connection_refused` - Service unavailable (retryable)
- `connection_reset` - Network connection issues (retryable)
- `dns_resolution` - DNS lookup failures (non-retryable)
- `http_xxx` - HTTP status code errors (5xx retryable, 4xx non-retryable)

## Configuration

### Environment Variables

- `MCP_MAX_RETRIES` - Maximum retry attempts (default: 2)
- `MCP_RETRY_BASE_DELAY` - Base delay in milliseconds (default: 1000)
- `MCP_RETRY_MAX_DELAY` - Maximum delay in milliseconds (default: 10000)
- `MCP_RETRY_BACKOFF_MULTIPLIER` - Exponential backoff multiplier (default: 2.0)
- `MCP_CIRCUIT_BREAKER_THRESHOLD` - Failure threshold for circuit breaker (default: 5)
- `MCP_CIRCUIT_BREAKER_TIMEOUT` - Circuit breaker timeout in milliseconds (default: 60000)
- `MCP_TIMEOUT_MS` - Request timeout in milliseconds (default: 45000)

### Usage Example

```javascript
const { fetchWithRetry, CircuitBreaker } = require('./utils/networkUtils');

// Basic usage with default configuration
const response = await fetchWithRetry('http://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'example' }),
});

// Advanced usage with custom retry configuration
const response = await fetchWithRetry(
  'http://api.example.com/data',
  { method: 'GET' },
  3, // maxRetries
  {
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    jitterEnabled: true,
  }
);

// Circuit breaker usage
const circuitBreaker = new CircuitBreaker({
  name: 'API-Service',
  failureThreshold: 5,
  timeout: 30000,
});

const result = await circuitBreaker.execute(async () => {
  return await fetchWithRetry('http://api.example.com/data', options);
});
```

## Integration with MCP Gateway

The retry mechanism is integrated into the MCP Gateway communication through:

1. **callMCPGatewayWithRetry** - Main retry wrapper with circuit breaker protection
2. **callMCPGatewayWithFetchRetry** - Internal function using fetchWithRetry for HTTP calls
3. **Comprehensive logging** - All retry attempts, circuit breaker state changes, and errors are logged
4. **Health monitoring** - Circuit breaker state is exposed through health check endpoints

## Monitoring and Debugging

### Logging Levels

- **INFO** - Successful requests, retry scheduling, circuit breaker state changes
- **WARN** - Failed attempts, timeouts, circuit breaker blocks
- **ERROR** - Final failures, circuit breaker opens, critical errors
- **DEBUG** - Detailed request/response information, internal state

### Health Check Integration

The circuit breaker state is exposed through the `/api/mcp-gateway/health` endpoint:

```json
{
  "service": "MCP Gateway",
  "healthy": true,
  "circuitBreaker": {
    "state": "CLOSED",
    "failureCount": 0,
    "successCount": 15,
    "failureThreshold": 5,
    "timeout": 60000
  },
  "retryConfig": {
    "maxRetries": 2,
    "baseDelay": 1000,
    "maxDelay": 10000,
    "backoffMultiplier": 2.0
  }
}
```

## Error Handling Strategy

1. **Immediate retry** for transient network errors (connection reset, timeout)
2. **Exponential backoff** to avoid overwhelming failing services
3. **Circuit breaker** to prevent cascading failures across the system
4. **Graceful degradation** to fallback generation when all retries are exhausted
5. **Comprehensive logging** for debugging and monitoring

This implementation ensures robust communication with the MCP Gateway while preventing system-wide failures and providing clear visibility into network issues.
