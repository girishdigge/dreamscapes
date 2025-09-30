# MCP Gateway Configuration

This document describes the environment variables available for configuring the Express service's communication with the MCP Gateway.

## Basic Configuration

- `MCP_GATEWAY_URL` - URL of the MCP Gateway service (default: `http://mcp-gateway:8080`)
- `MCP_TIMEOUT_MS` - Request timeout in milliseconds (default: `45000` - 45 seconds)
- `MCP_CONNECT_TIMEOUT_MS` - Connection timeout in milliseconds (default: `10000` - 10 seconds)

## Retry Configuration

- `MCP_MAX_RETRIES` - Maximum number of retry attempts (default: `2`)
- `MCP_RETRY_BASE_DELAY` - Base delay between retries in milliseconds (default: `1000` - 1 second)
- `MCP_RETRY_MAX_DELAY` - Maximum delay between retries in milliseconds (default: `10000` - 10 seconds)
- `MCP_RETRY_BACKOFF_MULTIPLIER` - Exponential backoff multiplier (default: `2.0`)

## Circuit Breaker Configuration

- `MCP_CIRCUIT_BREAKER_THRESHOLD` - Number of failures before opening circuit (default: `5`)
- `MCP_CIRCUIT_BREAKER_TIMEOUT` - Time to wait before trying again after circuit opens in milliseconds (default: `60000` - 1 minute)

## Example Configuration

```bash
# Basic settings
MCP_GATEWAY_URL=http://localhost:8080
MCP_TIMEOUT_MS=60000
MCP_CONNECT_TIMEOUT_MS=15000

# Retry settings for high-latency environments
MCP_MAX_RETRIES=3
MCP_RETRY_BASE_DELAY=2000
MCP_RETRY_MAX_DELAY=15000
MCP_RETRY_BACKOFF_MULTIPLIER=1.5

# Circuit breaker for production
MCP_CIRCUIT_BREAKER_THRESHOLD=3
MCP_CIRCUIT_BREAKER_TIMEOUT=30000
```

## Health Check Endpoint

The Express service now provides a health check endpoint for monitoring MCP Gateway connectivity:

```
GET /api/mcp-gateway/health
```

Response includes:

- Gateway health status
- Response time
- Circuit breaker state
- Error details (if any)

## Enhanced Logging

The implementation now provides comprehensive logging for:

- Request details (headers, payload size, timeout configuration)
- Response analysis (status, content type, response time)
- Error categorization (timeout, connection, network, HTTP errors)
- Retry attempts and circuit breaker state changes
- Performance metrics and debugging information

## Error Categories

The system categorizes errors for better handling:

- `timeout` - Request exceeded timeout duration
- `connection_refused` - MCP Gateway service not accessible
- `dns_resolution` - Cannot resolve MCP Gateway hostname
- `connection_reset` - Network connection was reset
- `network_timeout` - Network-level timeout
- `http_XXX` - HTTP error responses (400, 500, etc.)
- `circuit_breaker_open` - Circuit breaker preventing requests
- `unknown` - Unclassified errors

## Monitoring

Key metrics to monitor:

1. **Response Times**: Track MCP Gateway response times
2. **Error Rates**: Monitor failure rates by category
3. **Circuit Breaker State**: Alert when circuit opens
4. **Retry Patterns**: Analyze retry frequency and success rates
5. **Fallback Usage**: Monitor when local fallback is used

## Troubleshooting

Common issues and solutions:

1. **High timeout rates**: Increase `MCP_TIMEOUT_MS`
2. **Connection refused**: Check MCP Gateway service status
3. **Circuit breaker opening**: Investigate MCP Gateway health
4. **Excessive retries**: Adjust retry configuration
5. **DNS issues**: Verify MCP Gateway URL configuration
