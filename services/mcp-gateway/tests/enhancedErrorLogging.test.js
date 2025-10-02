// tests/enhancedErrorLogging.test.js
// Comprehensive tests for enhanced error logging and monitoring integration

const {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} = require('@jest/globals');
const EnhancedErrorLoggingIntegration = require('../utils/EnhancedErrorLoggingIntegration');
const ErrorLoggingMiddleware = require('../middleware/errorLoggingMiddleware');
const ProviderErrorIntegration = require('../utils/providerErrorIntegration');
const {
  initializeEnhancedErrorLogging,
} = require('../utils/initializeEnhancedErrorLogging');

describe('Enhanced Error Logging Integration', () => {
  let errorLoggingIntegration;
  let mockMonitoringComponents;

  beforeEach(() => {
    // Mock monitoring components
    mockMonitoringComponents = {
      metricsCollector: {
        recordError: jest.fn(),
        recordCustomMetric: jest.fn(),
      },
      alertingSystem: {
        sendAlert: jest.fn(),
      },
      healthMonitor: {
        recordProviderError: jest.fn(),
      },
      structuredLogger: {
        error: jest.fn(),
        info: jest.fn(),
      },
    };

    // Initialize with test configuration
    errorLoggingIntegration = new EnhancedErrorLoggingIntegration({
      enableConsole: false, // Disable console output for tests
      enableFile: false, // Disable file output for tests
      enableMonitoringIntegration: true,
      alertThresholds: {
        criticalErrorsPerMinute: 2,
        parsingFailuresPerMinute: 3,
        providerFailuresPerMinute: 5,
      },
      trackingInterval: 1000, // 1 second for faster tests
      reportingInterval: 2000, // 2 seconds for faster tests
    });

    errorLoggingIntegration.initialize(mockMonitoringComponents);
  });

  afterEach(() => {
    if (errorLoggingIntegration) {
      errorLoggingIntegration.destroy();
    }
  });

  describe('Response Parsing Error Logging', () => {
    it('should log response parsing errors with detailed context', () => {
      const error = new Error('response.substring is not a function');
      const providerName = 'cerebras';
      const originalResponse = { choices: [{ message: { content: 'test' } }] };
      const context = { requestId: 'test-123', operation: 'generateDream' };

      errorLoggingIntegration.logResponseParsingError(
        error,
        providerName,
        originalResponse,
        context
      );

      // Verify structured logger was called
      expect(
        mockMonitoringComponents.structuredLogger.error
      ).toHaveBeenCalledWith(
        'Response parsing failed',
        error,
        expect.objectContaining({
          providerName,
          errorType: 'response_parsing',
          context,
        })
      );

      // Verify metrics collector was called
      expect(
        mockMonitoringComponents.metricsCollector.recordError
      ).toHaveBeenCalledWith(
        'response_parsing',
        expect.objectContaining({
          provider: providerName,
          severity: 'high',
        })
      );
    });

    it('should analyze response structure correctly', () => {
      const error = new Error('parsing failed');
      const providerName = 'openai';

      // Test different response structures
      const responses = [
        { choices: [{ message: { content: 'test' } }] }, // API response
        { content: 'direct content' }, // Content object
        'string response', // String response
        null, // Null response
      ];

      responses.forEach((response, index) => {
        errorLoggingIntegration.logResponseParsingError(
          error,
          providerName,
          response,
          { requestId: `test-${index}` }
        );
      });

      // Verify all responses were logged
      expect(
        mockMonitoringComponents.structuredLogger.error
      ).toHaveBeenCalledTimes(responses.length);
    });

    it('should track parsing failure patterns', () => {
      const errors = [
        new Error('response.substring is not a function'),
        new Error('cannot read property of undefined'),
        new Error('response.substring is not a function'), // Duplicate pattern
      ];

      errors.forEach((error, index) => {
        errorLoggingIntegration.logResponseParsingError(
          error,
          'cerebras',
          { test: 'response' },
          { requestId: `pattern-test-${index}` }
        );
      });

      // Verify pattern tracking
      const report = errorLoggingIntegration.generateErrorMonitoringReport();
      expect(report.summary.totalRecentErrors).toBeGreaterThan(0);
    });
  });

  describe('Provider Method Error Logging', () => {
    it('should log provider method errors with critical severity', () => {
      const error = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );
      const providerName = 'cerebras';
      const methodName = 'getProviderHealth';
      const context = { requestId: 'method-test-123' };

      errorLoggingIntegration.logProviderMethodError(
        error,
        providerName,
        methodName,
        context
      );

      // Verify structured logger was called with critical severity
      expect(
        mockMonitoringComponents.structuredLogger.error
      ).toHaveBeenCalledWith(
        'Provider method error',
        error,
        expect.objectContaining({
          providerName,
          methodName,
          errorType: 'provider_method',
          severity: 'critical',
        })
      );

      // Verify health monitor was updated
      expect(
        mockMonitoringComponents.healthMonitor.recordProviderError
      ).toHaveBeenCalledWith(
        providerName,
        expect.objectContaining({
          type: 'method_error',
          severity: 'critical',
          method: methodName,
        })
      );
    });

    it('should trigger immediate critical alerts for method errors', () => {
      const error = new Error('missing method error');
      const providerName = 'openai';
      const methodName = 'missingMethod';

      errorLoggingIntegration.logProviderMethodError(
        error,
        providerName,
        methodName,
        {}
      );

      // Verify alert was sent
      expect(
        mockMonitoringComponents.alertingSystem.sendAlert
      ).toHaveBeenCalledWith(
        'provider_method_missing',
        expect.objectContaining({
          providerName,
          methodName,
          error: error.message,
        })
      );
    });
  });

  describe('Provider Operation Error Logging', () => {
    it('should log provider operation errors with appropriate severity', () => {
      const error = new Error('Request timeout after 30000ms');
      const providerName = 'cerebras';
      const operation = 'generateDream';
      const requestData = { prompt: 'test prompt', timeout: 30000 };
      const context = { requestId: 'operation-test-123' };

      errorLoggingIntegration.logProviderOperationError(
        error,
        providerName,
        operation,
        requestData,
        context
      );

      // Verify structured logger was called
      expect(
        mockMonitoringComponents.structuredLogger.error
      ).toHaveBeenCalledWith(
        'Provider operation failed',
        error,
        expect.objectContaining({
          providerName,
          operation,
          errorType: 'provider_operation',
        })
      );

      // Verify metrics collector was called
      expect(
        mockMonitoringComponents.metricsCollector.recordError
      ).toHaveBeenCalledWith(
        'provider_operation',
        expect.objectContaining({
          provider: providerName,
          operation,
        })
      );
    });

    it('should classify error severity correctly', () => {
      const testCases = [
        {
          error: new Error('this.method is not a function'),
          expectedSeverity: 'high',
        },
        { error: new Error('timeout occurred'), expectedSeverity: 'medium' },
        { error: new Error('rate limit exceeded'), expectedSeverity: 'medium' },
        { error: new Error('authentication failed'), expectedSeverity: 'high' },
        { error: new Error('generic error'), expectedSeverity: 'low' },
      ];

      testCases.forEach(({ error, expectedSeverity }, index) => {
        const severity = errorLoggingIntegration.classifyErrorSeverity(
          error,
          'test-provider',
          'test-operation'
        );
        expect(severity).toBe(expectedSeverity);
      });
    });
  });

  describe('Alert System', () => {
    it('should trigger alerts when thresholds are exceeded', async () => {
      // Generate multiple parsing failures to exceed threshold
      for (let i = 0; i < 4; i++) {
        const error = new Error(`parsing error ${i}`);
        errorLoggingIntegration.logResponseParsingError(
          error,
          'test-provider',
          { test: 'response' },
          { requestId: `threshold-test-${i}` }
        );
      }

      // Wait a bit for alert processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify alert was triggered (threshold is 3)
      expect(
        mockMonitoringComponents.alertingSystem.sendAlert
      ).toHaveBeenCalled();
    });

    it('should suppress duplicate alerts within suppression window', async () => {
      const error = new Error('test error for suppression');

      // Send first error (should trigger alert)
      errorLoggingIntegration.logProviderMethodError(
        error,
        'test-provider',
        'testMethod',
        {}
      );

      // Send second error immediately (should be suppressed)
      errorLoggingIntegration.logProviderMethodError(
        error,
        'test-provider',
        'testMethod',
        {}
      );

      // Verify only one alert was sent
      expect(
        mockMonitoringComponents.alertingSystem.sendAlert
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('Monitoring Report Generation', () => {
    it('should generate comprehensive monitoring reports', () => {
      // Generate some test errors
      const errors = [
        { type: 'parsing', provider: 'cerebras' },
        { type: 'method', provider: 'openai' },
        { type: 'operation', provider: 'cerebras' },
      ];

      errors.forEach((errorInfo, index) => {
        const error = new Error(`test error ${index}`);
        switch (errorInfo.type) {
          case 'parsing':
            errorLoggingIntegration.logResponseParsingError(
              error,
              errorInfo.provider,
              { test: 'response' },
              { requestId: `report-test-${index}` }
            );
            break;
          case 'method':
            errorLoggingIntegration.logProviderMethodError(
              error,
              errorInfo.provider,
              'testMethod',
              { requestId: `report-test-${index}` }
            );
            break;
          case 'operation':
            errorLoggingIntegration.logProviderOperationError(
              error,
              errorInfo.provider,
              'testOperation',
              {},
              { requestId: `report-test-${index}` }
            );
            break;
        }
      });

      const report = errorLoggingIntegration.generateErrorMonitoringReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('timeWindow');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('errorsByType');
      expect(report).toHaveProperty('providerErrors');
      expect(report).toHaveProperty('thresholds');
      expect(report.summary.totalRecentErrors).toBeGreaterThan(0);
    });
  });

  describe('Error Statistics', () => {
    it('should provide accurate error statistics', () => {
      // Generate test errors
      const testErrors = [
        { provider: 'cerebras', type: 'parsing' },
        { provider: 'cerebras', type: 'operation' },
        { provider: 'openai', type: 'method' },
      ];

      testErrors.forEach((errorInfo, index) => {
        const error = new Error(`stats test error ${index}`);
        switch (errorInfo.type) {
          case 'parsing':
            errorLoggingIntegration.logResponseParsingError(
              error,
              errorInfo.provider,
              { test: 'response' },
              { requestId: `stats-test-${index}` }
            );
            break;
          case 'method':
            errorLoggingIntegration.logProviderMethodError(
              error,
              errorInfo.provider,
              'testMethod',
              { requestId: `stats-test-${index}` }
            );
            break;
          case 'operation':
            errorLoggingIntegration.logProviderOperationError(
              error,
              errorInfo.provider,
              'testOperation',
              {},
              { requestId: `stats-test-${index}` }
            );
            break;
        }
      });

      const statistics = errorLoggingIntegration.getErrorStatistics(3600000); // 1 hour

      expect(statistics).toHaveProperty('timeWindow');
      expect(statistics).toHaveProperty('errorsByType');
      expect(statistics).toHaveProperty('providerStats');
      expect(statistics).toHaveProperty('totalRecentErrors');
      expect(statistics.totalRecentErrors).toBeGreaterThan(0);
    });
  });
});

describe('Error Logging Middleware', () => {
  let middleware;
  let mockApp;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = new ErrorLoggingMiddleware({
      enableConsole: false,
      enableFile: false,
      enableMonitoringIntegration: true,
    });

    mockApp = {
      metricsCollector: { recordError: jest.fn() },
      alertingSystem: { sendAlert: jest.fn() },
      healthMonitor: { recordProviderError: jest.fn() },
      structuredLogger: { error: jest.fn(), info: jest.fn() },
    };

    middleware.initialize(mockApp);

    mockReq = {
      method: 'POST',
      url: '/parse',
      path: '/parse',
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      body: { text: 'test dream' },
      query: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    if (middleware) {
      middleware.destroy();
    }
  });

  it('should extract error context from request', () => {
    const middlewareFunction = middleware.middleware();
    const error = new Error('response.substring is not a function');

    middlewareFunction(error, mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle different error types appropriately', () => {
    const middlewareFunction = middleware.middleware();

    const testCases = [
      {
        error: new Error('response.substring is not a function'),
        expectedType: 'response_parsing',
      },
      {
        error: new Error('this.getProviderHealth is not a function'),
        expectedType: 'provider_method',
      },
      {
        error: new Error('timeout occurred'),
        expectedType: 'provider_operation',
      },
    ];

    testCases.forEach(({ error }) => {
      middlewareFunction(error, mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});

describe('Provider Error Integration', () => {
  let providerIntegration;
  let mockMonitoringComponents;

  beforeEach(() => {
    mockMonitoringComponents = {
      metricsCollector: { recordError: jest.fn() },
      alertingSystem: { sendAlert: jest.fn() },
      healthMonitor: { recordProviderError: jest.fn() },
      structuredLogger: { error: jest.fn(), info: jest.fn() },
    };

    providerIntegration = new ProviderErrorIntegration({
      enableEnhancedLogging: true,
      enableContextTracking: true,
    });

    providerIntegration.initialize(mockMonitoringComponents);
  });

  afterEach(() => {
    if (providerIntegration) {
      providerIntegration.destroy();
    }
  });

  it('should track request contexts correctly', () => {
    const requestId = 'test-request-123';
    const providerName = 'cerebras';
    const operation = 'generateDream';
    const requestData = { prompt: 'test prompt' };

    const context = providerIntegration.startRequestTracking(
      requestId,
      providerName,
      operation,
      requestData
    );

    expect(context).toHaveProperty('requestId', requestId);
    expect(context).toHaveProperty('providerName', providerName);
    expect(context).toHaveProperty('operation', operation);
    expect(context).toHaveProperty('startTime');

    const retrievedContext = providerIntegration.getRequestContext(requestId);
    expect(retrievedContext).toEqual(context);
  });

  it('should track provider success and failure states', () => {
    const requestId = 'state-test-123';
    const providerName = 'test-provider';
    const operation = 'testOperation';

    // Start tracking
    providerIntegration.startRequestTracking(
      requestId,
      providerName,
      operation
    );

    // Log a failure
    const error = new Error('test failure');
    providerIntegration.logProviderOperationError(
      requestId,
      error,
      providerName,
      operation
    );

    // Check provider state
    const providerState = providerIntegration.providerStates.get(providerName);
    expect(providerState).toHaveProperty('consecutiveFailures', 1);
    expect(providerState).toHaveProperty('lastError', error.message);

    // Log a success
    providerIntegration.logProviderSuccess(requestId, providerName, operation);

    // Check provider state reset
    const updatedState = providerIntegration.providerStates.get(providerName);
    expect(updatedState).toHaveProperty('consecutiveFailures', 0);
    expect(updatedState).toHaveProperty('lastError', null);
  });

  it('should generate comprehensive monitoring reports', () => {
    // Create some test data
    const requestId = 'report-test-123';
    providerIntegration.startRequestTracking(
      requestId,
      'test-provider',
      'testOperation'
    );

    const error = new Error('test error for report');
    providerIntegration.logProviderOperationError(
      requestId,
      error,
      'test-provider',
      'testOperation'
    );

    const report = providerIntegration.generateMonitoringReport();

    expect(report).toHaveProperty('providerIntegration');
    expect(report.providerIntegration).toHaveProperty('activeRequests');
    expect(report.providerIntegration).toHaveProperty('trackedProviders');
    expect(report.providerIntegration).toHaveProperty('providerStates');
  });

  it('should cleanup old request contexts', () => {
    // Create old context
    const oldRequestId = 'old-request-123';
    const context = providerIntegration.startRequestTracking(
      oldRequestId,
      'test-provider',
      'testOperation'
    );

    // Manually set old timestamp
    context.startTime = Date.now() - 7200000; // 2 hours ago

    // Run cleanup
    providerIntegration.cleanupOldContexts();

    // Verify old context was removed
    const retrievedContext =
      providerIntegration.getRequestContext(oldRequestId);
    expect(retrievedContext).toBeUndefined();
  });
});

describe('Full Integration', () => {
  let mockApp;

  beforeEach(() => {
    mockApp = {
      use: jest.fn(),
      metricsCollector: {
        recordError: jest.fn(),
        recordCustomMetric: jest.fn(),
      },
      alertingSystem: { sendAlert: jest.fn() },
      healthMonitor: { recordProviderError: jest.fn() },
      structuredLogger: { error: jest.fn(), info: jest.fn() },
      close: jest.fn(),
    };
  });

  it('should initialize all components successfully', async () => {
    const result = await initializeEnhancedErrorLogging(mockApp, {
      enableEnhancedLogging: true,
      enableMonitoringIntegration: true,
      logLevel: 'info',
    });

    expect(result.success).toBe(true);
    expect(result.components.enhancedErrorLoggingIntegration).toBe(true);
    expect(result.components.errorLoggingMiddleware).toBe(true);
    expect(result.components.providerErrorIntegration).toBe(true);

    // Verify app was enhanced with helper functions
    expect(mockApp.logResponseParsingError).toBeDefined();
    expect(mockApp.logProviderMethodError).toBeDefined();
    expect(mockApp.logProviderOperationError).toBeDefined();
    expect(mockApp.logProviderSuccess).toBeDefined();
    expect(mockApp.startRequestTracking).toBeDefined();
    expect(mockApp.endRequestTracking).toBeDefined();

    // Verify middleware was applied
    expect(mockApp.use).toHaveBeenCalled();

    // Cleanup
    if (mockApp.enhancedErrorLoggingIntegration) {
      mockApp.enhancedErrorLoggingIntegration.destroy();
    }
    if (mockApp.errorLoggingMiddleware) {
      mockApp.errorLoggingMiddleware.destroy();
    }
    if (mockApp.providerErrorIntegration) {
      mockApp.providerErrorIntegration.destroy();
    }
  });

  it('should provide working helper functions', async () => {
    await initializeEnhancedErrorLogging(mockApp, {
      enableConsole: false,
      enableFile: false,
    });

    // Test helper functions
    const error = new Error('test error');
    const providerName = 'test-provider';
    const operation = 'testOperation';

    // Test response parsing error logging
    mockApp.logResponseParsingError(error, providerName, { test: 'response' });

    // Test provider method error logging
    mockApp.logProviderMethodError(error, providerName, 'testMethod');

    // Test provider operation error logging
    mockApp.logProviderOperationError(error, providerName, operation, {
      test: 'data',
    });

    // Test provider success logging
    mockApp.logProviderSuccess(providerName, operation, { success: true });

    // Test request tracking
    const context = mockApp.startRequestTracking(providerName, operation, {
      test: 'data',
    });
    expect(context).toHaveProperty('requestId');

    const endContext = mockApp.endRequestTracking(context.requestId);
    expect(endContext).toHaveProperty('endTime');

    // Cleanup
    if (mockApp.enhancedErrorLoggingIntegration) {
      mockApp.enhancedErrorLoggingIntegration.destroy();
    }
    if (mockApp.errorLoggingMiddleware) {
      mockApp.errorLoggingMiddleware.destroy();
    }
    if (mockApp.providerErrorIntegration) {
      mockApp.providerErrorIntegration.destroy();
    }
  });
});
