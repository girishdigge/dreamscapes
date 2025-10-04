# Validation Monitoring API

## Overview

The Validation Monitoring API provides real-time insights into validation health across all services in the Dreamscapes application. It tracks validation success rates, error patterns, and provides actionable recommendations.

## Endpoints

### GET /api/validation-monitoring/metrics

Get overall validation metrics across all services.

**Response:**

```json
{
  "success": true,
  "metrics": {
    "totalValidations": 1250,
    "successfulValidations": 1100,
    "failedValidations": 150,
    "successRate": 88.0,
    "failureRate": 12.0,
    "services": ["express", "mcp-gateway"],
    "topErrorTypes": [
      {
        "errorType": "EMPTY_STRUCTURES_ARRAY",
        "count": 45,
        "percentage": 30.0
      }
    ],
    "problematicFields": [
      {
        "field": "structures",
        "count": 45,
        "percentage": 30.0
      }
    ],
    "recentFailuresCount": 20
  },
  "timestamp": "2025-02-10T12:00:00.000Z"
}
```

### GET /api/validation-monitoring/metrics/:service

Get validation metrics for a specific service.

**Parameters:**

- `service` (path) - Service name (express, mcp-gateway)

**Response:**

```json
{
  "success": true,
  "service": "express",
  "metrics": {
    "total": 650,
    "successful": 580,
    "failed": 70,
    "successRate": 89.23,
    "failureRate": 10.77,
    "averageValidationTime": 12.5,
    "errorTypes": {
      "EMPTY_STRUCTURES_ARRAY": 25,
      "MISSING_CINEMATOGRAPHY": 15
    }
  },
  "timestamp": "2025-02-10T12:00:00.000Z"
}
```

### GET /api/validation-monitoring/health

Get comprehensive health report with recommendations.

**Response:**

```json
{
  "success": true,
  "health": {
    "timestamp": "2025-02-10T12:00:00.000Z",
    "overallStatus": "warning",
    "issues": ["Elevated failure rate (>25%)"],
    "overallMetrics": {
      "totalValidations": 1250,
      "successRate": 88.0,
      "failureRate": 12.0
    },
    "serviceHealth": {
      "express": {
        "status": "healthy",
        "issues": [],
        "metrics": {
          /* ... */
        }
      },
      "mcp-gateway": {
        "status": "warning",
        "issues": ["Elevated failure rate"],
        "metrics": {
          /* ... */
        }
      }
    },
    "recommendations": [
      {
        "priority": "high",
        "category": "validation_failures",
        "message": "High validation failure rate detected",
        "suggestion": "Review top error types and problematic fields",
        "data": {
          "topErrorTypes": [
            /* ... */
          ],
          "problematicFields": [
            /* ... */
          ]
        }
      }
    ]
  },
  "timestamp": "2025-02-10T12:00:00.000Z"
}
```

**Status Codes:**

- `200` - Healthy or warning status
- `503` - Critical status (failure rate > 50%)

### GET /api/validation-monitoring/failures/recent

Get recent validation failures.

**Query Parameters:**

- `limit` (optional) - Maximum number of failures to return (default: 20)

**Response:**

```json
{
  "success": true,
  "failures": [
    {
      "service": "express",
      "timestamp": "2025-02-10T11:59:30.000Z",
      "errorCount": 2,
      "errors": [
        {
          "field": "structures",
          "error": "EMPTY_STRUCTURES_ARRAY",
          "message": "Dream must have at least one structure"
        }
      ],
      "context": {
        "dreamId": "dream-123",
        "requestId": "req-456",
        "operation": "parse-dream"
      }
    }
  ],
  "count": 20,
  "timestamp": "2025-02-10T12:00:00.000Z"
}
```

### GET /api/validation-monitoring/history/:service

Get validation history for a specific service.

**Parameters:**

- `service` (path) - Service name (express, mcp-gateway)

**Query Parameters:**

- `limit` (optional) - Maximum number of records to return (default: 100)

**Response:**

```json
{
  "success": true,
  "service": "express",
  "history": [
    {
      "service": "express",
      "timestamp": "2025-02-10T11:59:30.000Z",
      "valid": false,
      "errorCount": 2,
      "errors": [
        /* ... */
      ],
      "warnings": [
        /* ... */
      ],
      "validationTime": 12,
      "context": {
        "dreamId": "dream-123",
        "requestId": "req-456"
      }
    }
  ],
  "count": 100,
  "timestamp": "2025-02-10T12:00:00.000Z"
}
```

### POST /api/validation-monitoring/history/clear

Clear validation history.

**Request Body:**

```json
{
  "service": "express" // Optional - omit to clear all services
}
```

**Response:**

```json
{
  "success": true,
  "message": "Validation history cleared for express",
  "timestamp": "2025-02-10T12:00:00.000Z"
}
```

## Health Status Levels

### Healthy

- Failure rate < 25%
- All services operating normally
- No critical issues detected

### Warning

- Failure rate between 25% and 50%
- Some services experiencing elevated failures
- Attention recommended

### Critical

- Failure rate > 50%
- Significant validation issues
- Immediate action required

## Common Error Types

### EMPTY_STRUCTURES_ARRAY

Dream object has no structures defined. Structures are required for 3D rendering.

**Solution:** Ensure dream generation includes at least one structure.

### EMPTY_ENTITIES_ARRAY

Dream object has no entities defined. Entities are required for scene animation.

**Solution:** Ensure dream generation includes at least one entity.

### MISSING_CINEMATOGRAPHY

Dream object is missing cinematography configuration.

**Solution:** Ensure cinematography with at least one shot is generated.

### INVALID_TYPE

Field has incorrect data type.

**Solution:** Verify data transformation and type conversion logic.

### MISSING_REQUIRED_FIELD

Required field is missing from dream object.

**Solution:** Check data generation and ensure all required fields are populated.

## Monitoring Best Practices

### 1. Regular Health Checks

Monitor the `/health` endpoint regularly (every 1-5 minutes) to detect issues early.

### 2. Alert on Critical Status

Set up alerts when health status becomes "critical" to enable rapid response.

### 3. Review Top Errors

Regularly review `topErrorTypes` to identify and fix common validation issues.

### 4. Track Trends

Monitor success rates over time to identify degradation patterns.

### 5. Service-Specific Monitoring

Track each service independently to isolate issues quickly.

## Integration Examples

### Node.js

```javascript
const axios = require('axios');

// Get health report
async function checkValidationHealth() {
  const response = await axios.get(
    'http://localhost:3000/api/validation-monitoring/health'
  );

  if (response.data.health.overallStatus === 'critical') {
    console.error('CRITICAL: Validation health is critical!');
    // Send alert
  }

  return response.data.health;
}

// Get recent failures
async function getRecentFailures() {
  const response = await axios.get(
    'http://localhost:3000/api/validation-monitoring/failures/recent?limit=10'
  );
  return response.data.failures;
}
```

### cURL

```bash
# Check health
curl http://localhost:3000/api/validation-monitoring/health

# Get metrics
curl http://localhost:3000/api/validation-monitoring/metrics

# Get Express service metrics
curl http://localhost:3000/api/validation-monitoring/metrics/express

# Get recent failures
curl http://localhost:3000/api/validation-monitoring/failures/recent?limit=20

# Clear history
curl -X POST http://localhost:3000/api/validation-monitoring/history/clear \
  -H "Content-Type: application/json" \
  -d '{"service": "express"}'
```

## Troubleshooting

### High Failure Rate

1. Check `topErrorTypes` to identify most common errors
2. Review `problematicFields` to find frequently failing fields
3. Examine recent failures for patterns
4. Check service-specific metrics to isolate the issue

### Slow Validation Times

1. Check `averageValidationTime` per service
2. Review validation complexity
3. Consider caching strategies
4. Optimize validation rules

### Missing Metrics

1. Ensure ValidationMonitor is properly initialized
2. Verify validation functions are recording results
3. Check that services are using UnifiedValidator
4. Review logs for errors

## Support

For issues or questions about validation monitoring:

1. Check the implementation summary: `.kiro/specs/dream-data-consistency-validation/TASK_7_IMPLEMENTATION_SUMMARY.md`
2. Review the UnifiedValidator documentation
3. Check service-specific validation implementations
4. Contact the development team
