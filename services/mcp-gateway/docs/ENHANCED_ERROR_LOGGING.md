# Enhanced Error Logging and Monitoring Integration

This document describes the enhanced error logging and monitoring system implemented for the MCP Gateway service to address critical response parsing errors and missing ProviderManager methods.

## Overview

The enhanced error logging system provides comprehensive error tracking, monitoring integration, and alerting capabilities specifically designed to handle the critical issues identified in the MCP Gateway:

1. **Response Parsing Errors**: `response?.substring is not a function`
2. **Missing ProviderManager Methods**: `this.providerManager.getProviderHealth is not a function`
3. **Provider Operation Failures**: Various AI provider integration issues

## Architecture

### Core Components

1. **EnhancedErrorLoggingIntegration**: Main error logging system with detailed context analysis
2. **ErrorLoggingMiddleware**: Express middleware for automatic error capture
3. **ProviderErrorIntegration**: Provider-specific error tracking and context management
4. **Error Monitoring Routes**: REST API endpoints for monitoring and reporting

### Integration Points

- **Winston Logger**: Structured logging with multiple transports
- **Metrics Collector**: Error metrics and statistics
- **Alerting System**: Real-time alert generation and suppression
- **Health Monitor**: Provider health tracking
- **Structured Logger**: Enhanced logging with context

## Features

### Detailed Error Logging

- **Provider Context**: Comprehensive provider state and configuration
- **Response Structure Analysis**: Detailed analysis of failed response formats
- **Stack Trace Analysis**: Error location identification and pattern recognition
- **Request Context Tracking**: Full request lifecycle monitoring

### Monitoring Integration

- **Real-time Error Tracking**: Continuous monitoring with configurable intervals
- **Alert Thresholds**: Configurable thresholds for different error types
- **Alert Suppression**: Intelligent alert suppression to prevent spam
- **Comprehensive Reporting**: Detailed monitoring reports with trends

### Error Classification

- **Severity Levels**: Critical, High, Medium, Low severity classification
- **Error Patterns**: Pattern recognition for common error types
- **Recovery Suggestions**: Automated recovery action recommendations
- **Retry Logic**: Intelligent retry and fallback strategies

## Installation and Setup

### 1. Initialize Enhanced Error Logging

```javascript
const {
  initializeEnhancedErrorLogging,
} = require('./utils/initializeEnhancedErrorLogging');

// In your main application file
const app = express();

// Initialize with monitoring components
await initializeEnhancedErrorLogging(app, {
  enableEnhancedLogging: true,
  enableMonitoringIntegration: true,
  enableAlertingIntegration: true,
  logLevel: 'info',
  logDirectory: 'logs',
  alertThresholds: {
    criticalErrorsPerMinute: 5,
    parsingFailuresPerMinute: 10,
    providerFailuresPerMinute: 15,
  },
});
```

### 2. Integrate with Provider Services

```javascript
const {
  integrateWithProviderService,
} = require('./utils/initializeEnhancedErrorLogging');

// Integrate existing provider services
const integratedCerebrasService = integrateWithProviderService(
  app,
  cerebrasService,
  'cerebras'
);
const integratedOpenAIService = integrateWithProviderService(
  app,
  openaiService,
  'openai'
);
```

### 3. Use Helper Functions

```javascript
// Log response parsing errors
app.logResponseParsingError(error, 'cerebras', originalResponse, {
  requestId: 'req-123',
  operation: 'generateDream',
});

// Log provider method errors
app.logProviderMethodError(error, 'cerebras', 'getProviderHealth', {
  requestId: 'req-124',
});

// Log provider operation errors
app.logProviderOperationError(error, 'openai', 'generateDream', requestData, {
  requestId: 'req-125',
});
```

## Configuration

### Environment Variables

```bash
# Logging Configuration
LOG_LEVEL=info
LOG_DIRECTORY=logs
ENABLE_FILE_LOGGING=true
ENABLE_CONSOLE_LOGGING=true

# Alert Thresholds
CRITICAL_ERRORS_PER_MINUTE=5
PARSING_FAILURES_PER_MINUTE=10
PROVIDER_FAILURES_PER_MINUTE=15

# Monitoring Intervals
ERROR_TRACKING_INTERVAL=30000
ERROR_REPORTING_INTERVAL=300000
ALERT_SUPPRESSION_WINDOW=300000
```

### Configuration Object

```javascript
const config = {
  // Enhanced error logging
  enableEnhancedLogging: true,
  enableMonitoringIntegration: true,
  enableAlertingIntegration: true,

  // Logging settings
  logLevel: 'info',
  logDirectory: 'logs',
  enableConsole: true,
  enableFile: true,
  maxFileSize: 10485760, // 10MB
  maxFiles: 5,

  // Error context
  includeResponseStructure: true,
  includeProviderContext: true,
  includeStackTrace: true,
  maxResponseSampleSize: 2048, // 2KB

  // Alert thresholds
  alertThresholds: {
    criticalErrorsPerMinute: 5,
    parsingFailuresPerMinute: 10,
    providerFailuresPerMinute: 15,
  },

  // Monitoring intervals
  trackingInterval: 30000, // 30 seconds
  reportingInterval: 300000, // 5 minutes
  alertSuppressionWindow: 300000, // 5 minutes
};
```

## API Endpoints

### Error Monitoring Endpoints

- `GET /error-monitoring/status` - Get monitoring system status
- `GET /error-monitoring/statistics` - Get error statistics
- `GET /error-monitoring/report` - Generate comprehensive report
- `GET /error-monitoring/errors/recent` - Get recent errors
- `GET /error-monitoring/providers/:provider/errors` - Get provider-specific errors
- `GET /error-monitoring/patterns` - Get error pattern analysis
- `GET /error-monitoring/alerts/history` - Get alert history
- `POST /error-monitoring/test-alert` - Test alert system
- `GET /error-monitoring/health` - Get system health
- `POST /error-monitoring/cleanup` - Cleanup old data
- `GET /error-monitoring/configuration` - Get configuration
- `PUT /error-monitoring/configuration` - Update configuration

### Example API Usage

```bash
# Get error statistics for the last hour
curl "http://localhost:8080/error-monitoring/statistics?timeWindow=3600000"

# Get recent parsing failures
curl "http://localhost:8080/error-monitoring/errors/recent?errorType=response_parsing&limit=10"

# Get provider-specific errors
curl "http://localhost:8080/error-monitoring/providers/cerebras/errors"

# Generate monitoring report
curl "http://localhost:8080/error-monitoring/report"

# Test alert system
curl -X POST "http://localhost:8080/error-monitoring/test-alert" \
  -H "Content-Type: application/json" \
  -d '{"alertType":"test_alert","providerName":"test-provider","severity":"high"}'
```

## Log Files

The system creates several specialized log files:

- `enhanced-errors.log` - All enhanced error logs with detailed context
- `parsing-failures.log` - Response parsing failure logs
- `provider-errors.log` - Provider-specific error logs
- `critical-errors.log` - Critical severity errors only
- `monitoring-integration.log` - Monitoring system logs

## Error Types and Handling

### Response Parsing Errors

**Pattern**: `response?.substring is not a function`

**Handling**:

- Detailed response structure analysis
- Multiple parsing strategy attempts
- Provider-specific response format handling
- Fallback to alternative parsing methods

**Context Logged**:

- Original response structure and type
- Parsing attempt methods
- Provider response format analysis
- Error location in stack trace

### Provider Method Errors

**Pattern**: `this.providerManager.getProviderHealth is not a function`

**Handling**:

- Immediate critical alert generation
- Provider state analysis
- Available vs missing method detection
- Health monitor integration

**Context Logged**:

- Provider registration status
- Available methods list
- Missing methods identification
- Provider health status

### Provider Operation Errors

**Pattern**: Various operational failures (timeouts, rate limits, etc.)

**Handling**:

- Error severity classification
- Retry strategy determination
- Provider switching logic
- Circuit breaker integration

**Context Logged**:

- Operation type and parameters
- Provider performance metrics
- Consecutive failure tracking
- Recovery recommendations

## Monitoring and Alerting

### Alert Types

1. **Critical Errors**: Method errors, system failures
2. **Parsing Failures**: Response parsing issues
3. **Provider Failures**: Operational failures
4. **Threshold Breaches**: Rate-based alerts

### Alert Suppression

- Time-based suppression windows
- Duplicate alert prevention
- Critical alert bypass logic
- Provider-specific suppression

### Monitoring Reports

Generated reports include:

- Error statistics by type and provider
- Provider health summaries
- Alert history and patterns
- Response structure analysis
- Performance metrics

## Testing

### Unit Tests

```bash
# Run enhanced error logging tests
npm test -- tests/enhancedErrorLogging.test.js
```

### Integration Testing

```bash
# Run example application
node examples/enhancedErrorLoggingExample.js

# Test different error scenarios
curl -X POST "http://localhost:3000/test/parse" \
  -H "Content-Type: application/json" \
  -d '{"text":"test dream","simulateError":"parsing"}'
```

### Load Testing

```bash
# Trigger multiple alerts for threshold testing
curl -X POST "http://localhost:3000/test/trigger-alerts" \
  -H "Content-Type: application/json" \
  -d '{"count":10,"errorType":"parsing"}'
```

## Performance Considerations

### Memory Management

- Automatic cleanup of old request contexts
- Configurable retention periods
- Memory usage monitoring
- Garbage collection optimization

### Performance Impact

- Minimal overhead for successful operations
- Efficient error tracking data structures
- Asynchronous logging operations
- Configurable monitoring intervals

### Scalability

- Horizontal scaling support
- Distributed logging compatibility
- Load balancer friendly
- Microservice architecture ready

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce retention periods, increase cleanup frequency
2. **Alert Spam**: Adjust thresholds, increase suppression windows
3. **Missing Logs**: Check file permissions, disk space
4. **Performance Impact**: Reduce monitoring frequency, disable detailed context

### Debug Mode

Enable debug logging for troubleshooting:

```javascript
const config = {
  logLevel: 'debug',
  enableConsole: true,
  includeStackTrace: true,
};
```

### Health Checks

Monitor system health via:

- `/error-monitoring/health` endpoint
- Log file monitoring
- Memory usage tracking
- Alert system status

## Best Practices

### Error Handling

1. Always provide request context when logging errors
2. Use appropriate error types for different scenarios
3. Include relevant response data for parsing errors
4. Sanitize sensitive data before logging

### Monitoring

1. Set appropriate alert thresholds for your environment
2. Monitor alert suppression effectiveness
3. Regularly review error patterns and trends
4. Use monitoring reports for system optimization

### Performance

1. Configure appropriate retention periods
2. Monitor memory usage and cleanup effectiveness
3. Adjust monitoring intervals based on load
4. Use structured logging for better performance

## Migration Guide

### From Basic Logging

1. Install enhanced error logging components
2. Initialize with existing monitoring systems
3. Migrate existing error handling code
4. Update alert configurations
5. Test thoroughly in staging environment

### Integration Checklist

- [ ] Enhanced error logging initialized
- [ ] Provider services integrated
- [ ] Monitoring components connected
- [ ] Alert thresholds configured
- [ ] API endpoints tested
- [ ] Log files created and writable
- [ ] Health checks passing
- [ ] Performance impact assessed

## Support and Maintenance

### Regular Maintenance

- Monitor log file sizes and rotation
- Review alert effectiveness and thresholds
- Update error patterns and classifications
- Optimize performance based on usage patterns

### Updates and Improvements

- Monitor for new error patterns
- Update response structure analysis
- Enhance provider integration
- Improve alert accuracy and relevance

For additional support or questions, refer to the test files and example implementations provided in the codebase.
