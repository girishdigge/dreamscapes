# Performance Optimization System

## Overview

The MCP Gateway includes a comprehensive performance optimization system that provides:

- **Request Queuing**: Intelligent request queuing with priority handling
- **Rate Limiting**: Advanced rate limiting with adaptive throttling
- **Resource Management**: Automatic scaling and resource optimization
- **Performance Monitoring**: Real-time performance tracking and optimization recommendations

## Environment Variables

### Request Queue Configuration

```bash
# Maximum concurrent requests (default: 10)
MAX_CONCURRENT_REQUESTS=10

# Maximum queue size (default: 100)
MAX_QUEUE_SIZE=100

# Request timeout in milliseconds (default: 30000)
REQUEST_TIMEOUT=30000

# Enable priority queuing (default: true)
ENABLE_PRIORITY_QUEUING=true
```

### Rate Limiting Configuration

```bash
# Global requests per minute limit (default: 200)
GLOBAL_REQUESTS_PER_MINUTE=200

# Global tokens per minute limit (default: 100000)
GLOBAL_TOKENS_PER_MINUTE=100000

# Enable adaptive throttling (default: true)
ENABLE_ADAPTIVE_THROTTLING=true

# Provider-specific rate limits
CEREBRAS_REQUESTS_PER_MINUTE=100
CEREBRAS_TOKENS_PER_MINUTE=50000
CEREBRAS_MAX_CONCURRENT=10

OPENAI_REQUESTS_PER_MINUTE=60
OPENAI_TOKENS_PER_MINUTE=40000
OPENAI_MAX_CONCURRENT=5
```

### Resource Management Configuration

```bash
# Enable automatic scaling (default: true)
ENABLE_AUTO_SCALING=true

# Memory usage threshold for scaling (default: 0.8)
MEMORY_THRESHOLD=0.8

# CPU usage threshold for scaling (default: 0.75)
CPU_THRESHOLD=0.75

# Scale up threshold (default: 0.8)
SCALE_UP_THRESHOLD=0.8

# Scale down threshold (default: 0.3)
SCALE_DOWN_THRESHOLD=0.3

# Scale up cooldown in milliseconds (default: 300000)
SCALE_UP_COOLDOWN=300000

# Scale down cooldown in milliseconds (default: 600000)
SCALE_DOWN_COOLDOWN=600000
```

### Performance Monitoring Configuration

```bash
# Performance monitoring interval in milliseconds (default: 5000)
PERFORMANCE_MONITORING_INTERVAL=5000

# Enable auto optimization (default: true)
ENABLE_AUTO_OPTIMIZATION=true

# Response time threshold for alerts in milliseconds (default: 5000)
RESPONSE_TIME_THRESHOLD=5000

# Enable performance logging (default: true)
ENABLE_PERFORMANCE_LOGGING=true
```

### Feature Toggles

```bash
# Enable/disable individual components
ENABLE_REQUEST_QUEUING=true
ENABLE_RATE_LIMITING=true
ENABLE_RESOURCE_MANAGEMENT=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_AUTOMATIC_OPTIMIZATION=true

# Enable garbage collection optimization (default: true)
ENABLE_GARBAGE_COLLECTION=true

# Garbage collection interval in milliseconds (default: 300000)
GC_INTERVAL=300000
```

## API Endpoints

### Performance Status

```
GET /performance/status
```

Returns the current status of all performance components.

### Performance Metrics

```
GET /performance/metrics
```

Returns detailed performance metrics from all components.

### Optimization Recommendations

```
GET /performance/optimization
```

Returns current optimization recommendations.

### Manual Optimization Trigger

```
POST /performance/optimize
```

Triggers manual performance optimization.

## Performance Features

### 1. Request Queuing

The request queue system provides:

- **Priority-based queuing**: Critical, high, normal, and low priority levels
- **Concurrent request limiting**: Prevents system overload
- **Timeout handling**: Automatic timeout for stuck requests
- **Queue overflow protection**: Rejects requests when queue is full

**Configuration Example:**

```javascript
{
  maxConcurrentRequests: 10,
  maxQueueSize: 100,
  requestTimeout: 30000,
  enablePriorityQueuing: true
}
```

### 2. Rate Limiting

Advanced rate limiting with:

- **Global and provider-specific limits**: Different limits for different AI providers
- **Token-based limiting**: Considers estimated token usage
- **Burst protection**: Prevents sudden traffic spikes
- **Adaptive throttling**: Automatically adjusts based on system performance

**Configuration Example:**

```javascript
{
  globalRequestsPerMinute: 200,
  globalTokensPerMinute: 100000,
  enableAdaptiveThrottling: true,
  defaultProviderLimits: {
    requestsPerMinute: 60,
    tokensPerMinute: 40000,
    concurrentRequests: 5
  }
}
```

### 3. Resource Management

Automatic resource management includes:

- **Memory monitoring**: Tracks heap usage and system memory
- **CPU monitoring**: Monitors CPU usage and load average
- **Automatic scaling**: Adjusts concurrent request limits based on resource usage
- **Garbage collection optimization**: Triggers GC when memory usage is high

**Scaling Logic:**

- Scale up when resource usage > 80%
- Scale down when resource usage < 30%
- Cooldown periods prevent rapid scaling

### 4. Performance Monitoring

Real-time monitoring provides:

- **Request tracking**: Response times, success rates, error rates
- **Resource tracking**: Memory, CPU, queue sizes
- **Provider metrics**: Per-provider performance statistics
- **Optimization recommendations**: Automatic suggestions for performance improvements

## Optimization Strategies

### Memory Optimization

- Automatic garbage collection when memory usage exceeds threshold
- Request history cleanup to prevent memory leaks
- Cache size management

### CPU Optimization

- Request queuing to prevent CPU overload
- Adaptive throttling during high CPU usage
- Connection pooling optimization

### Response Time Optimization

- Intelligent provider selection based on performance
- Request prioritization for critical operations
- Connection pooling and keep-alive optimization

### Queue Optimization

- Dynamic queue size adjustment
- Priority-based processing
- Timeout optimization

## Monitoring and Alerts

The system provides comprehensive monitoring:

### Performance Alerts

- Memory usage exceeding threshold
- CPU usage exceeding threshold
- Response times exceeding threshold
- Queue size approaching limits

### Metrics Collection

- Request metrics (count, success rate, response times)
- Resource metrics (memory, CPU, queue sizes)
- Provider metrics (per-provider performance)
- Cache metrics (hit rates, sizes)

### Optimization Recommendations

- Memory optimization suggestions
- Response time improvement recommendations
- Cache optimization advice
- Queue tuning suggestions

## Best Practices

### Production Configuration

```bash
# Production-optimized settings
MAX_CONCURRENT_REQUESTS=20
MAX_QUEUE_SIZE=200
GLOBAL_REQUESTS_PER_MINUTE=500
MEMORY_THRESHOLD=0.75
CPU_THRESHOLD=0.7
ENABLE_AUTO_OPTIMIZATION=true
PERFORMANCE_MONITORING_INTERVAL=10000
```

### Development Configuration

```bash
# Development settings for testing
MAX_CONCURRENT_REQUESTS=5
MAX_QUEUE_SIZE=50
GLOBAL_REQUESTS_PER_MINUTE=100
MEMORY_THRESHOLD=0.9
CPU_THRESHOLD=0.9
ENABLE_AUTO_OPTIMIZATION=false
PERFORMANCE_MONITORING_INTERVAL=5000
```

### Monitoring Setup

1. Enable performance logging
2. Set up appropriate thresholds for your environment
3. Monitor the `/performance/metrics` endpoint
4. Set up alerts based on optimization recommendations

### Troubleshooting

#### High Memory Usage

- Check `/performance/metrics` for memory statistics
- Enable garbage collection optimization
- Reduce cache sizes if necessary
- Monitor for memory leaks in request history

#### High Response Times

- Check provider performance metrics
- Enable adaptive throttling
- Increase concurrent request limits if resources allow
- Review queue wait times

#### Queue Overflow

- Increase `MAX_QUEUE_SIZE` if resources allow
- Reduce `REQUEST_TIMEOUT` for faster queue turnover
- Enable priority queuing to handle critical requests first
- Monitor resource usage to identify bottlenecks

## Testing

Run performance optimization tests:

```bash
npm run test:performance
```

Or run the specific performance optimization test:

```bash
node tests/performance-optimization.test.js
```

## Integration

The performance optimization system integrates seamlessly with:

- Provider Manager for intelligent provider selection
- Monitoring system for comprehensive metrics
- Cache system for optimized response caching
- Validation pipeline for quality assurance

All components work together to provide optimal performance while maintaining system reliability and quality.
