# Async Metrics Quick Reference

## Quick Start

### Check Current Metrics

```bash
# Get all async metrics
curl http://localhost:3002/monitoring/async-metrics

# Get metrics for specific provider
curl http://localhost:3002/monitoring/async-metrics?provider=cerebras

# Get metrics for last 5 minutes
curl http://localhost:3002/monitoring/async-metrics?timeRange=300000
```

### Track Metrics in Code

```javascript
// Record a request (for rate calculations)
app.aiTracking.recordRequest(providerName);

// Record extraction attempt
app.aiTracking.recordExtraction(providerName, success, errorMessage);

// Record Promise detection (usually automatic via validateNoPromises)
app.aiTracking.recordPromiseDetection(location, providerName, context);

// Record 502 error
app.aiTracking.record502Error(providerName, reason, context);

// Record fallback usage
app.aiTracking.recordFallbackUsage(providerName, reason, fallbackType);
```

## Metrics Overview

| Metric                      | Purpose                         | Expected Value | Alert Threshold |
| --------------------------- | ------------------------------- | -------------- | --------------- |
| **Promise Detections**      | Unresolved Promises in pipeline | 0              | > 0             |
| **Extraction Success Rate** | Content extraction success      | > 95%          | < 90%           |
| **502 Error Rate**          | Bad Gateway errors              | < 5%           | > 10%           |
| **Fallback Usage Rate**     | Local generation fallback       | < 10%          | > 20%           |

## Common Scenarios

### Scenario 1: Check if Promises are leaking

```bash
curl http://localhost:3002/monitoring/async-metrics | jq '.data.realtime.promiseDetections'
```

**Expected:** `0`  
**If > 0:** Check logs for Promise detection location and add missing `await`

### Scenario 2: Monitor extraction health

```bash
curl http://localhost:3002/monitoring/async-metrics | jq '.data.realtime.extraction'
```

**Expected:**

```json
{
  "attempts": 150,
  "successes": 148,
  "failures": 2,
  "successRate": "98.67%"
}
```

**If < 90%:** Check provider response formats and parsing patterns

### Scenario 3: Track 502 errors

```bash
curl http://localhost:3002/monitoring/async-metrics | jq '.data.aggregated.errors502'
```

**Expected:**

```json
{
  "count": 2,
  "rate": "1.33%",
  "byProvider": { "cerebras": 2 },
  "byReason": {
    "Extraction failure": 1,
    "Validation failure": 1
  }
}
```

**If > 5%:** Investigate by reason and provider

### Scenario 4: Monitor fallback usage

```bash
curl http://localhost:3002/monitoring/async-metrics | jq '.data.aggregated.fallback'
```

**Expected:**

```json
{
  "count": 5,
  "rate": "3.33%",
  "byProvider": { "cerebras": 3, "none": 2 },
  "byType": { "local_generation": 5 },
  "byReason": {
    "Provider failure": 3,
    "No AI providers available": 2
  }
}
```

**If > 10%:** Check provider health and configuration

## Troubleshooting

### Problem: High Promise Detection Count

```bash
# Check Promise detections
curl http://localhost:3002/monitoring/async-metrics | jq '.data.aggregated.promiseDetections'
```

**Solution:**

1. Check `byLocation` to find where Promises are detected
2. Add `await` before the operation
3. Use `ensureResolved()` wrapper

### Problem: Low Extraction Success Rate

```bash
# Check extraction by provider
curl http://localhost:3002/monitoring/async-metrics | jq '.data.aggregated.extraction.byProvider'
```

**Solution:**

1. Identify problematic provider
2. Review provider response logs
3. Update response parsing patterns

### Problem: High 502 Error Rate

```bash
# Check 502 errors by reason
curl http://localhost:3002/monitoring/async-metrics | jq '.data.aggregated.errors502.byReason'
```

**Solution:**

- **Extraction failure:** Update parsing patterns
- **Validation failure:** Check provider output quality
- **Fallback failure:** Verify fallback handler config

### Problem: High Fallback Usage

```bash
# Check fallback by provider and reason
curl http://localhost:3002/monitoring/async-metrics | jq '.data.aggregated.fallback'
```

**Solution:**

1. Check provider health status
2. Verify API keys and configuration
3. Review rate limiting settings

## Time Series Data

Get historical trends for charting:

```bash
# Extraction success rate over time
curl "http://localhost:3002/monitoring/async-metrics/timeseries?metric=extractionSuccessRate&timeRange=3600000"

# 502 error rate over time
curl "http://localhost:3002/monitoring/async-metrics/timeseries?metric=error502Rate&timeRange=3600000"

# Fallback usage over time
curl "http://localhost:3002/monitoring/async-metrics/timeseries?metric=fallbackUsageRate&timeRange=3600000"

# Promise detections over time
curl "http://localhost:3002/monitoring/async-metrics/timeseries?metric=promiseDetections&timeRange=3600000"
```

## Alerting Examples

### Datadog

```javascript
// Alert if Promise detections occur
if (metrics.promiseDetections > 0) {
  datadog.event({
    title: 'Promise Detection Alert',
    text: `Unresolved Promises detected: ${metrics.promiseDetections}`,
    alert_type: 'error',
    tags: ['service:mcp-gateway', 'metric:async'],
  });
}
```

### Prometheus

```yaml
# prometheus.yml
- alert: HighExtractionFailureRate
  expr: extraction_success_rate < 90
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Extraction success rate below 90%'
    description: 'Current rate: {{ $value }}%'
```

### Custom Webhook

```javascript
const metrics = await fetch(
  'http://localhost:3002/monitoring/async-metrics'
).then((r) => r.json());

if (metrics.data.realtime.errors502.rate > 5) {
  await fetch('https://your-webhook.com/alert', {
    method: 'POST',
    body: JSON.stringify({
      alert: '502 Error Rate High',
      rate: metrics.data.realtime.errors502.rate,
      count: metrics.data.realtime.errors502.count,
    }),
  });
}
```

## Configuration

```javascript
// In monitoring initialization
const monitoringIntegration = new MonitoringIntegration({
  enableAsyncMetrics: true,
  asyncMetrics: {
    retentionPeriod: 86400000, // 24 hours
    aggregationInterval: 60000, // 1 minute
    enableRealtime: true,
  },
});
```

## Testing

```bash
# Run unit tests
npm test tests/unit/AsyncMetricsTracker.test.js

# Test specific scenario
npm test tests/unit/AsyncMetricsTracker.test.js -t "Promise Detection"
```

## Performance

- **Memory:** ~1-2 MB per 24 hours
- **CPU:** < 0.1% overhead
- **Latency:** < 1ms per operation
- **Storage:** In-memory only (no disk I/O)

## Related Commands

```bash
# Check overall monitoring status
curl http://localhost:3002/monitoring/health

# Get all metrics (including async)
curl http://localhost:3002/monitoring/metrics

# Export all monitoring data
curl http://localhost:3002/monitoring/export

# Get dashboard data
curl http://localhost:3002/monitoring/dashboard
```

## Support

For issues or questions:

1. Check logs: `logs/monitoring-integration.log`
2. Review documentation: `monitoring/ASYNC_METRICS_README.md`
3. Run diagnostics: `npm test tests/unit/AsyncMetricsTracker.test.js`
