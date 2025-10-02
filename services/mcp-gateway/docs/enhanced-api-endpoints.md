# Enhanced API Endpoints Documentation

This document describes the new API endpoints added as part of the AI Provider Integration Enhancement.

## Overview

The MCP Gateway has been enhanced with intelligent provider management, streaming capabilities, and quality feedback systems. The following new endpoint categories have been added:

- **Provider Management** (`/providers/*`) - Monitor and manage AI providers
- **Streaming** (`/streaming/*`) - Real-time streaming generation
- **Quality Feedback** (`/quality/*`) - Quality analytics and continuous improvement

## Provider Management Endpoints

### GET /providers/status

Get comprehensive status information for all registered AI providers.

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalProviders": 2,
      "healthyProviders": 2,
      "unhealthyProviders": 0
    },
    "providers": {
      "cerebras": {
        "isHealthy": true,
        "responseTime": 150,
        "timestamp": "2024-01-15T10:30:00Z"
      },
      "openai": {
        "isHealthy": true,
        "responseTime": 200,
        "timestamp": "2024-01-15T10:30:00Z"
      }
    },
    "availableProviders": [
      {
        "name": "cerebras",
        "score": 85.5,
        "priority": 3,
        "enabled": true
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /providers/metrics

Get detailed performance metrics for providers.

**Query Parameters:**

- `provider` (optional) - Specific provider name

**Response:**

```json
{
  "success": true,
  "data": {
    "cerebras": {
      "performance": {
        "successRate": 0.95,
        "failureRate": 0.05,
        "avgResponseTime": 1500,
        "totalRequests": 1000
      },
      "health": {
        "isHealthy": true,
        "consecutiveFailures": 0,
        "lastHealthCheck": "2024-01-15T10:29:00Z"
      },
      "configuration": {
        "enabled": true,
        "priority": 3
      }
    }
  }
}
```

### POST /providers/recommend

Get provider recommendations based on requirements.

**Request Body:**

```json
{
  "operationType": "generateDream",
  "quality": "high",
  "context": {
    "style": "ethereal",
    "complexity": "medium"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "recommended": {
      "name": "cerebras",
      "score": 87.3,
      "selectionMetadata": {
        "strategy": "weighted",
        "factors": ["performance", "availability", "preferences"]
      }
    },
    "alternatives": [
      {
        "name": "openai",
        "score": 82.1,
        "priority": 2
      }
    ],
    "totalAvailable": 2
  }
}
```

### POST /providers/feedback

Submit feedback about provider performance.

**Request Body:**

```json
{
  "provider": "cerebras",
  "quality": 8,
  "responseTime": 1200,
  "contentQuality": 9,
  "userSatisfaction": 8,
  "comments": "Great quality but slightly slow"
}
```

## Streaming Endpoints

### POST /streaming/parse

Stream dream generation in real-time using Server-Sent Events (SSE).

**Request Body:**

```json
{
  "text": "I dreamed of a floating city in the clouds",
  "style": "ethereal",
  "options": {
    "streaming": true,
    "quality": "high"
  }
}
```

**Response:** Server-Sent Events stream with the following event types:

- `connected` - Connection established
- `prompt_built` - Prompt construction complete
- `provider_selected` - AI provider selected
- `streaming_started` - Streaming generation began
- `content_chunk` - Partial content received
- `progress` - Generation progress update
- `streaming_complete` - Streaming finished
- `parsing_started` - Response parsing began
- `validation_started` - Content validation began
- `complete` - Final result ready
- `error` - Error occurred

**Example SSE Events:**

```
event: connected
data: {"message":"Streaming connection established","timestamp":"2024-01-15T10:30:00Z"}

event: provider_selected
data: {"provider":"cerebras","attempt":1,"timestamp":"2024-01-15T10:30:01Z"}

event: content_chunk
data: {"chunk":"A magnificent floating city...","chunkNumber":1,"timestamp":"2024-01-15T10:30:02Z"}

event: complete
data: {"success":true,"data":{...},"metadata":{...}}
```

### POST /streaming/patch

Stream dream patching operations.

**Request Body:**

```json
{
  "baseJson": {
    /* existing dream JSON */
  },
  "editText": "Add more vibrant colors to the sky",
  "options": {
    "streaming": true
  }
}
```

## Quality Feedback Endpoints

### POST /quality/feedback

Submit quality feedback for generated content.

**Request Body:**

```json
{
  "dreamId": "dream_123456",
  "provider": "cerebras",
  "quality": 8,
  "contentQuality": 9,
  "userSatisfaction": 7,
  "responseTime": 1500,
  "issues": ["slightly slow response"],
  "suggestions": ["optimize for faster generation"],
  "metadata": {
    "style": "ethereal",
    "complexity": "high"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quality feedback processed successfully",
  "data": {
    "feedbackId": "feedback_1642248600_abc123",
    "dreamId": "dream_123456",
    "quality": 8,
    "processedAt": "2024-01-15T10:30:00Z",
    "processed": {
      "providerManager": true,
      "cacheService": true
    }
  }
}
```

### GET /quality/analytics

Get quality analytics and trends.

**Query Parameters:**

- `provider` (optional) - Specific provider
- `timeRange` (optional) - Time range (default: "24h")
- `limit` (optional) - Result limit (default: 100)

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalFeedback": 500,
      "averageQuality": 8.2,
      "averageContentQuality": 8.5,
      "averageUserSatisfaction": 7.8,
      "commonIssues": ["response time", "style accuracy"],
      "topSuggestions": ["faster generation", "better prompts"]
    },
    "providers": {
      "cerebras": {
        "successRate": 0.95,
        "avgResponseTime": 1500,
        "totalRequests": 800,
        "isHealthy": true
      }
    },
    "trends": {
      "qualityOverTime": [],
      "providerComparison": []
    }
  }
}
```

### POST /quality/report-issue

Report critical quality issues for immediate attention.

**Request Body:**

```json
{
  "dreamId": "dream_123456",
  "provider": "cerebras",
  "issueType": "generation_failure",
  "severity": "high",
  "description": "Provider returned malformed JSON",
  "reproductionSteps": [
    "Submit dream with ethereal style",
    "Use high quality setting",
    "Provider fails to generate valid response"
  ],
  "expectedBehavior": "Valid dream JSON structure",
  "actualBehavior": "Malformed JSON with syntax errors"
}
```

## Enhanced Main Endpoints

The existing endpoints (`/parse`, `/patch`, `/style-enrich`) have been enhanced with:

### ProviderManager Integration

- Intelligent provider selection and fallback
- Automatic retry with exponential backoff
- Circuit breaker pattern for failing providers
- Context preservation across provider switches

### Enhanced Metadata

All responses now include detailed provider information:

```json
{
  "success": true,
  "data": {
    /* dream content */
  },
  "metadata": {
    "source": "cerebras",
    "processingTimeMs": 1500,
    "provider": {
      "name": "cerebras",
      "responseTime": 1200,
      "attempts": 1,
      "managedByProviderManager": true,
      "contextPreserved": false
    },
    "validation": {
      "valid": true,
      "errorsFound": 0,
      "repairApplied": false
    }
  }
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Detailed error information",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Authentication

Currently, all endpoints use the same authentication as the main gateway. Future versions may include endpoint-specific authentication.

## Rate Limiting

Provider-specific rate limiting is handled automatically by the ProviderManager based on configured limits for each provider.

## Monitoring

All new endpoints are automatically monitored by the enhanced monitoring system, providing:

- Request/response metrics
- Error tracking
- Performance monitoring
- Health checks
- Alerting for critical issues

## Usage Examples

### JavaScript/Node.js

```javascript
// Get provider status
const response = await fetch('/providers/status');
const status = await response.json();

// Stream dream generation
const eventSource = new EventSource('/streaming/parse', {
  method: 'POST',
  body: JSON.stringify({
    text: 'My dream text',
    style: 'ethereal',
  }),
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### cURL Examples

```bash
# Get provider metrics
curl -X GET "http://localhost:8080/providers/metrics?provider=cerebras"

# Submit quality feedback
curl -X POST "http://localhost:8080/quality/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "dreamId": "dream_123",
    "provider": "cerebras",
    "quality": 8,
    "contentQuality": 9
  }'

# Stream dream generation
curl -X POST "http://localhost:8080/streaming/parse" \
  -H "Content-Type: application/json" \
  -d '{"text": "I dreamed of flying", "style": "ethereal"}' \
  --no-buffer
```

This enhanced API provides comprehensive provider management, real-time streaming capabilities, and quality feedback systems to significantly improve the dream generation experience.
