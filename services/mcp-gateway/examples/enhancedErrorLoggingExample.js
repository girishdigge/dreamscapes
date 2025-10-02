// examples/enhancedErrorLoggingExample.js
// Example integration of enhanced error logging with MCP Gateway

const express = require('express');
const {
  initializeEnhancedErrorLogging,
  integrateWithProviderService,
} = require('../utils/initializeEnhancedErrorLogging');

/**
 * Example: Enhanced Error Logging Integration
 * This example shows how to integrate the enhanced error logging system
 * with the MCP Gateway application and provider services.
 */

async function exampleIntegration() {
  const app = express();

  // Basic Express setup
  app.use(express.json());

  // Mock monitoring components (in real app, these would be actual instances)
  app.metricsCollector = {
    recordError: (type, data) => console.log('Metrics:', type, data),
    recordCustomMetric: (name, data) =>
      console.log('Custom Metric:', name, data),
  };

  app.alertingSystem = {
    sendAlert: (type, data) => console.log('Alert:', type, data),
  };

  app.healthMonitor = {
    recordProviderError: (provider, data) =>
      console.log('Health Monitor:', provider, data),
  };

  app.structuredLogger = {
    error: (message, error, data) =>
      console.log('Structured Log:', message, error?.message, data),
    info: (message, data) => console.log('Structured Info:', message, data),
  };

  try {
    // Initialize enhanced error logging system
    const initResult = await initializeEnhancedErrorLogging(app, {
      enableEnhancedLogging: true,
      enableMonitoringIntegration: true,
      enableAlertingIntegration: true,
      logLevel: 'info',
      logDirectory: 'logs',
      alertThresholds: {
        criticalErrorsPerMinute: 3,
        parsingFailuresPerMinute: 5,
        providerFailuresPerMinute: 10,
      },
    });

    console.log('Enhanced error logging initialized:', initResult);

    // Example provider service (mock)
    const mockCerebrasService = {
      async generateDream(prompt, options = {}) {
        // Simulate different types of errors for demonstration
        const errorType = options.simulateError;

        switch (errorType) {
          case 'parsing':
            // Simulate response parsing error
            const mockResponse = {
              choices: [{ message: { content: 'test' } }],
            };
            // This would normally be in response parser, but simulating here
            throw new Error('response.substring is not a function');

          case 'method':
            // Simulate missing method error
            throw new Error(
              'this.providerManager.getProviderHealth is not a function'
            );

          case 'operation':
            // Simulate operation error
            throw new Error('Request timeout after 30000ms');

          default:
            // Simulate successful response
            return JSON.stringify({
              title: 'Mock Dream',
              description: 'A test dream generated successfully',
              scenes: [],
            });
        }
      },

      async testConnection() {
        return { status: 'healthy', latency: 100 };
      },
    };

    // Integrate provider service with error logging
    const integratedCerebrasService = integrateWithProviderService(
      app,
      mockCerebrasService,
      'cerebras'
    );

    // Example routes that demonstrate error logging
    app.post('/test/parse', async (req, res) => {
      try {
        const { text, simulateError } = req.body;

        console.log(
          `Testing dream generation with error simulation: ${
            simulateError || 'none'
          }`
        );

        const result = await integratedCerebrasService.generateDream(text, {
          simulateError,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        // Error will be automatically logged by the integrated service
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Example route to test direct error logging
    app.post('/test/direct-error-logging', (req, res) => {
      const { errorType, providerName = 'test-provider' } = req.body;

      try {
        switch (errorType) {
          case 'parsing':
            const mockResponse = { invalid: 'response' };
            const parsingError = new Error(
              'response.substring is not a function'
            );
            app.logResponseParsingError(
              parsingError,
              providerName,
              mockResponse,
              {
                requestId: 'test-parsing-error',
                operation: 'generateDream',
              }
            );
            break;

          case 'method':
            const methodError = new Error(
              'this.providerManager.getProviderHealth is not a function'
            );
            app.logProviderMethodError(
              methodError,
              providerName,
              'getProviderHealth',
              {
                requestId: 'test-method-error',
              }
            );
            break;

          case 'operation':
            const operationError = new Error(
              'Connection timeout after 30000ms'
            );
            app.logProviderOperationError(
              operationError,
              providerName,
              'generateDream',
              {
                prompt: 'test prompt',
                timeout: 30000,
              },
              {
                requestId: 'test-operation-error',
              }
            );
            break;

          default:
            throw new Error('Invalid error type specified');
        }

        res.json({
          success: true,
          message: `${errorType} error logged successfully`,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Example route to get error statistics
    app.get('/test/error-statistics', (req, res) => {
      const timeWindow = parseInt(req.query.timeWindow) || 3600000; // 1 hour
      const statistics =
        app.providerErrorIntegration.getErrorStatistics(timeWindow);

      res.json({
        success: true,
        data: statistics,
      });
    });

    // Example route to generate monitoring report
    app.get('/test/monitoring-report', (req, res) => {
      const report = app.providerErrorIntegration.generateMonitoringReport();

      res.json({
        success: true,
        data: report,
      });
    });

    // Example route to test alert system
    app.post('/test/trigger-alerts', async (req, res) => {
      const { count = 5, errorType = 'parsing' } = req.body;

      try {
        // Trigger multiple errors to test alert thresholds
        for (let i = 0; i < count; i++) {
          const error = new Error(`Test error ${i + 1} for alert testing`);

          switch (errorType) {
            case 'parsing':
              app.logResponseParsingError(
                error,
                'test-provider',
                { invalid: 'response' },
                {
                  requestId: `alert-test-${i}`,
                }
              );
              break;

            case 'method':
              app.logProviderMethodError(error, 'test-provider', 'testMethod', {
                requestId: `alert-test-${i}`,
              });
              break;

            case 'operation':
              app.logProviderOperationError(
                error,
                'test-provider',
                'testOperation',
                {},
                {
                  requestId: `alert-test-${i}`,
                }
              );
              break;
          }

          // Small delay to spread errors over time
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        res.json({
          success: true,
          message: `Triggered ${count} ${errorType} errors for alert testing`,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        service: 'enhanced-error-logging-example',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        errorLogging: {
          initialized: !!app.enhancedErrorLoggingIntegration,
          providerIntegration: !!app.providerErrorIntegration,
        },
      });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(
        `Enhanced error logging example server running on port ${PORT}`
      );
      console.log('\nAvailable endpoints:');
      console.log(
        '  POST /test/parse - Test dream generation with error simulation'
      );
      console.log(
        '  POST /test/direct-error-logging - Test direct error logging'
      );
      console.log('  GET  /test/error-statistics - Get error statistics');
      console.log('  GET  /test/monitoring-report - Get monitoring report');
      console.log('  POST /test/trigger-alerts - Trigger alerts for testing');
      console.log('  GET  /health - Health check');
      console.log('  GET  /error-monitoring/* - Error monitoring endpoints');
      console.log('\nExample requests:');
      console.log(
        '  curl -X POST http://localhost:3000/test/parse -H "Content-Type: application/json" -d \'{"text":"test dream","simulateError":"parsing"}\''
      );
      console.log(
        '  curl -X POST http://localhost:3000/test/direct-error-logging -H "Content-Type: application/json" -d \'{"errorType":"method"}\''
      );
      console.log('  curl http://localhost:3000/test/error-statistics');
      console.log('  curl http://localhost:3000/error-monitoring/status');
    });
  } catch (error) {
    console.error('Failed to initialize example application:', error.message);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleIntegration().catch((error) => {
    console.error('Example application failed:', error.message);
    process.exit(1);
  });
}

module.exports = { exampleIntegration };
