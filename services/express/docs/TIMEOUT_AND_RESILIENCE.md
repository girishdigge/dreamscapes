# Timeout and Network Resilience Improvements

This document describes the timeout and network resilience improvements implemented in the Dreamscapes Express service.

## Overview

The timeout and network resilience improvements enhance the robustness of network communication between the Express orchestrator and external services (primarily the MCP Gateway). These improvements address the requirements for proper timeout handling, AbortController usage, and network error detection.

## Key Features

### 1. Configurable Timeout Values

The system now supports different timeout values for different types of requests:

- **Health Check Timeout**: `HEALTH_CHECK_TIMEOUT_MS` (default: 5000ms)
- **AI Generation Timeout**: `LONG_OPERATION_TIMEOUT_MS` (default: 60000ms)
- **Base Timeout**: `MCP_TIMEOUT_MS` (default: 45000ms)

#### Environment Variables

```bash
# Network Timeout Configuration (in milliseconds)
MCP_TIMEOUT_MS=45000
HEALTH_CHECK_TIMEOUT_MS=5000
LONG_OPERATION_TIMEOUT_MS=60000

# Retry Configuration
MCP_MAX_RETRIES=2
MCP_RETRY_BASE_DELAY=1000
MCP_RETRY_MAX_DELAY=10000
MCP_RETRY_BACKOFF_MULTIPLIER=2.0

# Circuit Breaker Configuration
MCP_CIRCUIT_BREAKER_THRESHOLD=5
MCP_CIRCUIT_BREAKER_TIMEOUT=60000
MCP_CIRCUIT_BREAKER_MONITORING=10000
```

### 2. Proper AbortController Usage

The implementation uses AbortController for proper request cancellation:

```javascript
// Enhanced timeout handling with AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  logger.warn('Fetch request timeout triggered', {
    url,
    timeout: `${timeout}ms`,
    attempt: attempt + 1,
  });
  controller.abort();
}, timeout);

const response = await fetch(url, {
  ...options,
  signal: controller.signal,
});

// Clean up timeout on successful response
if (timeoutId) {
  clearTimeout(timeoutId);
}
```

### 3. Network Error Detection and Analysis

The system includes comprehensive network error detection and analysis:

#### Error Categories

- `timeout` - Request timeouts and AbortController cancellations
- `connection_refused` - Service unavailable (ECONNREFUSED)
- `dns_resolution` - DNS lookup failures (ENOTFOUND)
- `connection_reset` - Connection reset by peer (ECONNRESET)
- `network_timeout` - Network-level timeouts (ETIMEDOUT)
- `host_unreachable` - Host unreachable (EHOSTUNREACH)
- `network_unreachable` - Network unreachable (ENETUNREACH)

#### Error Analysis

Each error is analyzed for:

- **Severity**: `low`, `medium`, `high`, `critical`
- **Retry Recommendation**: Whether the error should trigger a retry
- **Fallback Recommendation**: What fallback strategy to use
- **Retry Reason**: Why the retry is recommended

### 4. Intelligent Fallback Triggers

The system provides intelligent fallback recommendations based on error analysis:

- **Local Generation**: For timeout and connection issues
- **Service Unavailable**: For connection refused errors
- **Configuration Error**: For DNS resolution failures
- **Mark Service Unhealthy**: For health check failures

## API Functions

### `getTimeoutForRequest(url, options)`

Determines the appropriate timeout value for a request based on:

- Explicit timeout in options
- Request type (health check, AI generation, etc.)
- Request size (larger POST bodies get extended timeouts)

```javascript
const timeout = getTimeoutForRequest('http://mcp-gateway:8080/parse');
// Returns 60000 for AI generation requests
```

### `getRequestType(url, options)`

Identifies the type of request for logging and timeout purposes:

```javascript
const type = getRequestType('http://mcp-gateway:8080/health');
// Returns 'health_check'
```

### `analyzeNetworkError(error, url, options)`

Provides detailed analysis of network errors:

```javascript
const analysis = analyzeNetworkError(error, url, options);
// Returns:
// {
//   category: 'timeout',
//   severity: 'high',
//   retryRecommended: true,
//   fallbackRecommendation: 'local_generation',
//   retryReason: 'request_timeout'
// }
```

### `fetchWithRetry(url, options, maxRetries, retryConfig)`

Enhanced fetch function with:

- Configurable timeouts
- Proper AbortController usage
- Network error detection
- Exponential backoff retry
- Comprehensive logging

## Integration with Existing Systems

### Circuit Breaker Integration

The timeout improvements work seamlessly with the existing circuit breaker pattern:

```javascript
const result = await mcpGatewayCircuitBreaker.execute(async () => {
  return await fetchWithRetry(url, options, maxRetries, retryConfig);
});
```

### Health Check Enhancement

Health checks now use the improved timeout handling:

```javascript
const response = await fetchWithRetry(
  `${MCP_GATEWAY_URL}/health`,
  {
    method: 'GET',
    timeout: healthCheckTimeout,
  },
  0, // No retries for health checks
  { jitterEnabled: false }
);
```

## Logging and Monitoring

The system provides comprehensive logging for:

- Timeout configurations and decisions
- AbortController usage and cancellations
- Network error analysis and categorization
- Retry attempts and backoff calculations
- Fallback recommendations and triggers

### Log Examples

```javascript
// Timeout configuration
logger.debug('Fetch attempt starting', {
  url,
  timeout: '60000ms',
  requestType: 'dream_generation',
  hasAbortController: true,
});

// Network error analysis
logger.warn('Fetch attempt failed', {
  error: 'Connection refused',
  errorCategory: 'connection_refused',
  networkErrorDetails: {
    severity: 'high',
    retryRecommended: true,
    fallbackRecommendation: 'service_unavailable',
  },
});
```

## Testing

The implementation includes comprehensive tests for:

- Timeout configuration for different request types
- AbortController usage and cleanup
- Network error categorization and analysis
- Retry logic with exponential backoff
- Circuit breaker integration
- Fallback recommendation logic

Run tests with:

```bash
npm test networkUtils.test.js
```

## Performance Considerations

### Connection Management

The system includes connection management headers:

```javascript
headers: {
  'Connection': 'keep-alive',
  'Keep-Alive': 'timeout=30, max=100',
}
```

### Resource Cleanup

Proper cleanup of timeouts and AbortControllers prevents memory leaks:

```javascript
// Always clean up timeout
if (timeoutId) {
  clearTimeout(timeoutId);
  timeoutId = null;
}
```

### Adaptive Timeouts

Timeouts are adapted based on:

- Request type (health checks are faster)
- Request size (large POST bodies get more time)
- Environment configuration

## Error Recovery Strategies

### Immediate Recovery

- Connection refused → Retry with exponential backoff
- Timeout → Retry with longer timeout
- Connection reset → Retry immediately

### Delayed Recovery

- DNS resolution failure → No retry (configuration issue)
- Network unreachable → No retry (infrastructure issue)

### Fallback Strategies

- AI generation failure → Local generation
- Health check failure → Mark service unhealthy
- Server error → Retry then fallback

## Monitoring and Alerting

The system provides metrics for:

- Timeout rates by request type
- Network error frequencies by category
- Retry success rates
- Fallback usage patterns
- Circuit breaker state changes

These metrics can be used for:

- Performance optimization
- Infrastructure monitoring
- Capacity planning
- Error rate alerting

## Future Enhancements

Potential future improvements:

1. **Adaptive Timeouts**: Automatically adjust timeouts based on historical response times
2. **Request Prioritization**: Different timeout strategies for high/low priority requests
3. **Network Quality Detection**: Adjust retry strategies based on network conditions
4. **Distributed Tracing**: Enhanced observability across service boundaries
5. **Load Balancing**: Intelligent routing based on service health and response times

## Conclusion

The timeout and network resilience improvements provide a robust foundation for reliable service communication in the Dreamscapes system. The implementation addresses all requirements while maintaining backward compatibility and providing comprehensive monitoring and debugging capabilities.
