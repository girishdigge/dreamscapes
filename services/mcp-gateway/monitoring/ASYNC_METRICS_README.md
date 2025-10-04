# Async Metrics Tracking

## Overview

The AsyncMetricsTracker provides comprehensive monitoring of async/await handling in the mcp-gateway service. It tracks four critical metrics:

1. **Promise Detection Counter** - Tracks unresolved Promises in the response pipeline
2. **Extraction Success Rate** - Monitors content extraction success/failure rates
3. **502 Error Rate** - Tracks Bad Gateway errors
4. **Fallback Usage Rate** - Monitors how often fallback generation is used

## Architecture

### Components

- **AsyncMetricsTracker** (`monitoring/AsyncMetricsTracker.js`) - Core metrics tracking module
- **MonitoringIntegration** - Integrates AsyncMetricsTracker with existing monitoring
- **MonitoringMiddleware** - Exposes tracking functions via `app.aiTracking`

### Integration Points

The metrics are tracked at key points in the request lifecycle:

```
Request → Provider → Extraction → Validation → Response
   ↓         ↓           ↓            ↓          ↓
  Track   Track      Track        Track      Track
Request Promise  Extraction    502 Error  Fallback
        Detection   Success                 Usage
```

## Usage

### Recording Metrics

Metrics are automatically recorded when using the `app.aiTracking` functions:

```javascript
// Record a request (for rate calculations)
app.aiTracking.recordRequest(providerName);

// Record Promise detection
app.aiTracking.recordPromiseDetection(location, provider, context);

// Record extraction attempt
app.aiTracking.recordExtraction(provider, success, error);

// Record 502 error
app.aiTracking.record502Error(provider, reason, context);

// Record fallback usage
app.aiTracking.recordFallbackUsage(provider, reason, fallbackType);
```

### Accessing Metrics

#### Via API Endpoints

**Get Realtime and Aggregated Metrics:**

```bash
GET /monitoring/async-metrics?timeRange=3600000
```

Response:

```json
{
  "success": true,
  "data": {
    "realtime": {
      "promiseDetections": 0,
      "extraction": {
        "attempts": 150,
        "successes": 148,
        "failures": 2,
        "successRate": "98.67%"
      },
      "errors502": {
        "count": 2,
        "rate": "1.33%"
      },
      "fallback": {
        "count": 5,
        "rate": "3.33%"
      },
      "totalRequests": 150
    },
    "aggregated": {
      "timeRange": {
        "start": "2025-03-10T10:00:00.000Z",
        "end": "2025-03-10T11:00:00.000Z",
        "durationMs": 3600000
      },
      "promiseDetections": {
        "count": 0,
        "byProvider": {},
        "byLocation": {}
      },
      "extraction": {
        "attempts": 150,
        "successes": 148,
        "failures": 2,
        "successRate": "98.67%",
        "byProvider": {
          "cerebras": {
            "successes": 145,
            "failures": 2,
            "total": 147,
            "successRate": "98.64%"
          },
          "openai": {
            "successes": 3,
            "failures": 0,
            "total": 3,
            "successRate": "100.00%"
          }
        }
      },
      "errors502": {
        "count": 2,
        "rate": "1.33%",
        "byProvider": {
          "cerebras": 2
        },
        "byReason": {
          "Extraction failure": 1,
          "Validation failure": 1
        }
      },
      "fallback": {
        "count": 5,
        "rate": "3.33%",
        "byProvider": {
          "cerebras": 3,
          "none": 2
        },
        "byType": {
          "local_generation": 5
        },
        "byReason": {
          "Provider failure": 3,
          "No AI providers available": 2
        }
      }
    }
  }
}
```

**Get Provider-Specific Metrics:**

```bash
GET /monitoring/async-metrics?provider=cerebras&timeRange=3600000
```

**Get Time Series Data:**

```bash
GET /monitoring/async-metrics/timeseries?metric=extractionSuccessRate&timeRange=3600000
```

Valid metrics:

- `promiseDetections`
- `extractionSuccessRate`
- `error502Rate`
- `fallbackUsageRate`

#### Programmatically

```javascript
const asyncTracker = monitoringIntegration.asyncMetricsTracker;

// Get realtime metrics
const realtime = asyncTracker.getRealtimeMetrics();

// Get aggregated metrics for last hour
const aggregated = asyncTracker.getAggregatedMetrics(3600000);

// Get provider-specific metrics
const providerMetrics = asyncTracker.getProviderMetrics('cerebras', 3600000);

// Get time series data
const timeSeries = asyncTracker.getTimeSeries('extractionSuccessRate', 3600000);

// Export all metrics
const exported = asyncTracker.exportMetrics();
```

## Metrics Details

### 1. Promise Detection Counter

Tracks instances where unresolved Promises are detected in the response pipeline.

**When Recorded:**

- When `validateNoPromises()` detects a Promise in a value or object property
- Typically indicates a missing `await` statement

**Tracked Data:**

- Location where Promise was detected (e.g., 'result.content', 'operation result')
- Provider name
- Context (type: 'value' or 'property', property name if applicable)

**Expected Value:** 0 (any detection indicates a bug)

### 2. Extraction Success Rate

Monitors the success rate of content extraction from provider responses.

**When Recorded:**

- After each call to `responseParser.extractContentSafely()`
- Records both successful and failed extractions

**Tracked Data:**

- Provider name
- Success/failure status
- Error message (if failed)

**Expected Value:** > 95% success rate

### 3. 502 Error Rate

Tracks Bad Gateway errors returned to clients.

**When Recorded:**

- When returning `res.status(502)` for:
  - Extraction failures
  - Validation failures
  - Provider failures with fallback failures
  - No providers available with fallback failures

**Tracked Data:**

- Provider name
- Reason for 502 error
- Context (error details, attempt counts, etc.)

**Expected Value:** < 5% of total requests

### 4. Fallback Usage Rate

Monitors how often the system falls back to local dream generation.

**When Recorded:**

- When `fallbackHandler.handleProviderFailure()` is called
- Indicates AI provider unavailability or failure

**Tracked Data:**

- Original provider that failed (or 'none' if no provider available)
- Reason for fallback
- Fallback type ('local_generation', 'emergency_repair', etc.)

**Expected Value:** < 10% of total requests

## Configuration

Configure AsyncMetricsTracker via MonitoringIntegration config:

```javascript
const monitoringIntegration = new MonitoringIntegration({
  enableAsyncMetrics: true, // Enable/disable async metrics tracking
  asyncMetrics: {
    retentionPeriod: 86400000, // 24 hours (default)
    aggregationInterval: 60000, // 1 minute (default)
    enableRealtime: true, // Enable real-time aggregation (default)
  },
});
```

## Alerting

Set up alerts based on async metrics thresholds:

```javascript
// Alert if Promise detections occur
if (asyncMetrics.promiseDetections > 0) {
  alert('CRITICAL: Unresolved Promises detected in response pipeline');
}

// Alert if extraction success rate drops
if (asyncMetrics.extraction.successRate < 90) {
  alert('WARNING: Extraction success rate below 90%');
}

// Alert if 502 error rate is high
if (asyncMetrics.errors502.rate > 5) {
  alert('WARNING: 502 error rate above 5%');
}

// Alert if fallback usage is high
if (asyncMetrics.fallback.rate > 10) {
  alert('WARNING: Fallback usage rate above 10%');
}
```

## Troubleshooting

### High Promise Detection Count

**Symptoms:** `promiseDetections > 0`

**Causes:**

- Missing `await` statement in async function
- Returning Promise instead of resolved value
- Not using `ensureResolved()` wrapper

**Solution:**

1. Check logs for Promise detection location
2. Add `await` before the operation
3. Use `ensureResolved()` to guarantee resolution

### Low Extraction Success Rate

**Symptoms:** `extraction.successRate < 90%`

**Causes:**

- Provider returning unexpected response format
- Response parsing patterns not matching
- Provider errors or timeouts

**Solution:**

1. Check `byProvider` breakdown to identify problematic provider
2. Review provider response logs
3. Update response parsing patterns if needed
4. Check provider health and connectivity

### High 502 Error Rate

**Symptoms:** `errors502.rate > 5%`

**Causes:**

- Extraction failures (no pattern matched)
- Validation failures (invalid dream data)
- Provider failures with fallback failures

**Solution:**

1. Check `byReason` breakdown to identify root cause
2. For extraction failures: update parsing patterns
3. For validation failures: check provider output quality
4. For fallback failures: verify fallback handler configuration

### High Fallback Usage Rate

**Symptoms:** `fallback.rate > 10%`

**Causes:**

- Provider unavailability or failures
- Network issues
- Rate limiting
- Configuration issues

**Solution:**

1. Check `byProvider` to identify failing providers
2. Check `byReason` to understand failure causes
3. Verify provider API keys and configuration
4. Check provider health status
5. Review rate limiting settings

## Performance Impact

The AsyncMetricsTracker has minimal performance impact:

- **Memory:** ~1-2 MB for 24 hours of metrics (default retention)
- **CPU:** < 0.1% overhead for metric recording
- **Latency:** < 1ms per metric recording operation

Metrics are stored in memory and automatically cleaned up based on retention period.

## Testing

Run unit tests:

```bash
cd services/mcp-gateway
npm test tests/unit/AsyncMetricsTracker.test.js
```

## Related Documentation

- [Async Patterns Guide](../../docs/async-patterns.md) - Best practices for async/await
- [Monitoring Integration](./MonitoringIntegration.js) - Overall monitoring architecture
- [Response Parser](../utils/ResponseParser.js) - Content extraction implementation
- [Async Helpers](../utils/asyncHelpers.js) - Promise validation utilities
