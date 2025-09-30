// services/express/tests/dreamProcessingLogger.test.js
const {
  dreamProcessingLogger,
  DreamProcessingLogger,
} = require('../utils/dreamProcessingLogger');

describe('DreamProcessingLogger', () => {
  let testLogger;
  const testRequestId = 'test-request-123';
  const testText = 'I dreamed of a spaceship orbiting the earth';
  const testStyle = 'cyberpunk';

  beforeEach(() => {
    testLogger = new DreamProcessingLogger();
  });

  afterEach(() => {
    // Clean up any test requests
    testLogger.cleanupStaleRequests(0);
  });

  describe('Processing Start Logging', () => {
    test('should log processing start with correct context', () => {
      const context = testLogger.logProcessingStart(
        testRequestId,
        testText,
        testStyle
      );

      expect(context.requestId).toBe(testRequestId);
      expect(context.stage).toBe('processing_start');
      expect(context.textLength).toBe(testText.length);
      expect(context.style).toBe(testStyle);
      expect(context.startTime).toBeDefined();
      expect(testLogger.activeRequests.has(testRequestId)).toBe(true);
    });

    test('should truncate long text preview', () => {
      const longText = 'A'.repeat(200);
      const context = testLogger.logProcessingStart(
        testRequestId,
        longText,
        testStyle
      );

      expect(context.textPreview.length).toBeLessThanOrEqual(103); // 100 chars + '...'
      expect(context.textPreview.endsWith('...')).toBe(true);
    });
  });

  describe('Cache Logging', () => {
    test('should log cache hit correctly', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);

      // Should not throw and should log cache hit
      expect(() => {
        testLogger.logCacheCheck(testRequestId, 'test-cache-key', true, 10);
      }).not.toThrow();
    });

    test('should log cache miss correctly', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);

      // Should not throw and should log cache miss
      expect(() => {
        testLogger.logCacheCheck(testRequestId, 'test-cache-key', false);
      }).not.toThrow();
    });
  });

  describe('MCP Gateway Logging', () => {
    test('should log MCP call start with payload info', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const payload = { text: testText, style: testStyle };
      const retryConfig = { maxRetries: 2, timeout: 30000 };

      expect(() => {
        testLogger.logMCPCallStart(
          testRequestId,
          'http://test-url',
          payload,
          retryConfig
        );
      }).not.toThrow();
    });

    test('should log MCP success with response details', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const mockResponse = {
        status: 200,
        headers: {
          get: (key) => (key === 'content-type' ? 'application/json' : null),
        },
      };
      const mockParsedData = {
        dreamJson: { id: 'dream-123', structures: [], entities: [] },
        source: 'openai',
        validation: { valid: true },
      };

      expect(() => {
        testLogger.logMCPSuccess(
          testRequestId,
          mockResponse,
          1500,
          mockParsedData
        );
      }).not.toThrow();
    });

    test('should log MCP failure with error context', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const mockError = new Error('Connection failed');
      mockError.category = 'network';
      mockError.retriesExhausted = true;

      expect(() => {
        testLogger.logMCPFailure(testRequestId, mockError, 5000, 3, 'open');
      }).not.toThrow();
    });

    test('should log retry attempts', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);

      expect(() => {
        testLogger.logMCPRetryAttempt(
          testRequestId,
          2,
          3,
          2000,
          'Timeout error'
        );
      }).not.toThrow();
    });
  });

  describe('Response Processing Logging', () => {
    test('should log successful response parsing', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const mockResponse = {
        headers: {
          get: (key) => (key === 'content-type' ? 'application/json' : null),
        },
      };
      const rawResponse = '{"success": true, "data": {}}';

      expect(() => {
        testLogger.logResponseParsing(
          testRequestId,
          mockResponse,
          rawResponse,
          true
        );
      }).not.toThrow();
    });

    test('should log failed response parsing with error', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const mockResponse = {
        headers: {
          get: (key) => (key === 'content-type' ? 'text/html' : null),
        },
      };
      const rawResponse = '<html>Error page</html>';
      const parseError = new Error('Invalid JSON');

      expect(() => {
        testLogger.logResponseParsing(
          testRequestId,
          mockResponse,
          rawResponse,
          false,
          parseError
        );
      }).not.toThrow();
    });
  });

  describe('Dream Validation Logging', () => {
    test('should log successful validation', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const mockDream = {
        id: 'dream-123',
        structures: [{ id: 'struct-1' }],
        entities: [{ id: 'entity-1' }],
      };
      const mockValidation = { valid: true, errors: [] };

      expect(() => {
        testLogger.logDreamValidation(
          testRequestId,
          mockDream,
          mockValidation,
          'openai'
        );
      }).not.toThrow();
    });

    test('should log failed validation with errors', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const mockDream = { id: 'dream-123' };
      const mockValidation = {
        valid: false,
        errors: ['Missing structures', 'Invalid style', 'Missing entities'],
      };

      expect(() => {
        testLogger.logDreamValidation(
          testRequestId,
          mockDream,
          mockValidation,
          'openai'
        );
      }).not.toThrow();
    });
  });

  describe('Dream Repair Logging', () => {
    test('should log successful repair', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const originalDream = { id: 'dream-123' };
      const repairedDream = {
        id: 'dream-123',
        assumptions: ['repaired missing structures', 'repaired invalid style'],
      };
      const errors = ['Missing structures', 'Invalid style'];

      expect(() => {
        testLogger.logDreamRepair(
          testRequestId,
          originalDream,
          errors,
          repairedDream,
          true
        );
      }).not.toThrow();
    });

    test('should log failed repair', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const originalDream = { id: 'dream-123' };
      const repairedDream = { id: 'dream-123' };
      const errors = ['Unfixable error'];

      expect(() => {
        testLogger.logDreamRepair(
          testRequestId,
          originalDream,
          errors,
          repairedDream,
          false
        );
      }).not.toThrow();
    });
  });

  describe('Fallback Generation Logging', () => {
    test('should log fallback generation with reason', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const fallbackDream = {
        id: 'fallback-dream-123',
        structures: [],
        entities: [],
      };

      expect(() => {
        testLogger.logFallbackGeneration(
          testRequestId,
          'MCP Gateway failed',
          'local_fallback',
          fallbackDream
        );
      }).not.toThrow();
    });
  });

  describe('Cache Storage Logging', () => {
    test('should log successful cache storage', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const dreamData = { id: 'dream-123', title: 'Test Dream' };

      expect(() => {
        testLogger.logCacheStorage(
          testRequestId,
          'cache-key-123',
          dreamData,
          true
        );
      }).not.toThrow();
    });

    test('should log failed cache storage', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const dreamData = { id: 'dream-123', title: 'Test Dream' };

      expect(() => {
        testLogger.logCacheStorage(
          testRequestId,
          'cache-key-123',
          dreamData,
          false
        );
      }).not.toThrow();
    });
  });

  describe('Processing Completion Logging', () => {
    test('should log successful completion with metrics', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const finalDream = {
        id: 'dream-123',
        title: 'Spaceship Dream',
        structures: [{ id: 'struct-1' }],
        entities: [{ id: 'entity-1' }],
      };
      const metrics = {
        mcpResponseTime: 2000,
        cached: false,
        totalTime: 3000,
      };

      expect(() => {
        testLogger.logProcessingComplete(
          testRequestId,
          finalDream,
          'openai',
          true,
          metrics
        );
      }).not.toThrow();

      // Should clean up the active request
      expect(testLogger.activeRequests.has(testRequestId)).toBe(false);
    });

    test('should log failed completion', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const emergencyDream = { id: 'emergency-123' };

      expect(() => {
        testLogger.logProcessingComplete(
          testRequestId,
          emergencyDream,
          'emergency_fallback',
          false,
          { error: 'Processing failed' }
        );
      }).not.toThrow();
    });
  });

  describe('Error Context Logging', () => {
    test('should log error with comprehensive context', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      const additionalContext = { stage: 'validation', dreamId: 'dream-123' };

      expect(() => {
        testLogger.logErrorWithContext(
          testRequestId,
          'test_stage',
          error,
          additionalContext
        );
      }).not.toThrow();
    });
  });

  describe('Performance Metrics Logging', () => {
    test('should log performance metrics for operations', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);

      expect(() => {
        testLogger.logPerformanceMetrics(testRequestId, 'validation', 1500, {
          itemCount: 5,
        });
      }).not.toThrow();
    });

    test('should warn for slow operations', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);

      expect(() => {
        testLogger.logPerformanceMetrics(testRequestId, 'slow_operation', 6000);
      }).not.toThrow();
    });
  });

  describe('Performance Summary', () => {
    test('should return performance summary', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);
      testLogger.logProcessingStart('request-2', 'Another dream', 'fantasy');

      const summary = testLogger.getPerformanceSummary();

      expect(summary.activeRequests).toBe(2);
      expect(summary.longRunningRequests).toBe(0);
      expect(summary.timestamp).toBeDefined();
    });

    test('should identify long running requests', (done) => {
      // Create a request that will be considered long-running
      const context = testLogger.logProcessingStart(
        testRequestId,
        testText,
        testStyle
      );
      // Manually set start time to 35 seconds ago
      context.startTime = Date.now() - 35000;
      testLogger.activeRequests.set(testRequestId, context);

      const summary = testLogger.getPerformanceSummary();

      expect(summary.longRunningRequests).toBe(1);
      expect(summary.longRunningDetails).toHaveLength(1);
      expect(summary.longRunningDetails[0].requestId).toBe(testRequestId);

      done();
    });
  });

  describe('Stale Request Cleanup', () => {
    test('should clean up stale requests', (done) => {
      // Create a stale request
      const context = testLogger.logProcessingStart(
        testRequestId,
        testText,
        testStyle
      );
      // Manually set start time to 6 minutes ago
      context.startTime = Date.now() - 360000;
      testLogger.activeRequests.set(testRequestId, context);

      const cleanedCount = testLogger.cleanupStaleRequests(300000); // 5 minutes

      expect(cleanedCount).toBe(1);
      expect(testLogger.activeRequests.has(testRequestId)).toBe(false);

      done();
    });

    test('should not clean up recent requests', () => {
      testLogger.logProcessingStart(testRequestId, testText, testStyle);

      const cleanedCount = testLogger.cleanupStaleRequests(300000); // 5 minutes

      expect(cleanedCount).toBe(0);
      expect(testLogger.activeRequests.has(testRequestId)).toBe(true);
    });
  });

  describe('Singleton Instance', () => {
    test('should export singleton instance', () => {
      expect(dreamProcessingLogger).toBeInstanceOf(DreamProcessingLogger);
    });

    test('should maintain state across calls', () => {
      dreamProcessingLogger.logProcessingStart(
        testRequestId,
        testText,
        testStyle
      );

      expect(dreamProcessingLogger.activeRequests.has(testRequestId)).toBe(
        true
      );

      const summary = dreamProcessingLogger.getPerformanceSummary();
      expect(summary.activeRequests).toBeGreaterThan(0);

      // Clean up
      dreamProcessingLogger.cleanupStaleRequests(0);
    });
  });
});
