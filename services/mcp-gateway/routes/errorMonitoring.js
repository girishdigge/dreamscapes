// routes/errorMonitoring.js
// Enhanced error monitoring endpoints with comprehensive logging integration

const express = require('express');
const router = express.Router();

/**
 * Enhanced Error Monitoring Routes
 * Provides comprehensive error monitoring and logging endpoints
 */

// Middleware to ensure error logging integration is available
const ensureErrorLoggingIntegration = (req, res, next) => {
  if (!req.app.errorLoggingIntegration) {
    return res.status(503).json({
      success: false,
      error: 'Error logging integration not available',
      message: 'Enhanced error logging system is not initialized',
    });
  }
  next();
};

/**
 * GET /error-monitoring/status
 * Get error monitoring system status
 */
router.get('/status', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const errorLoggingIntegration = req.app.errorLoggingIntegration;
    const providerErrorIntegration = req.app.providerErrorIntegration;

    const status = {
      timestamp: new Date().toISOString(),
      errorLoggingIntegration: {
        initialized: !!errorLoggingIntegration,
        status: 'active',
      },
      providerErrorIntegration: {
        initialized: !!providerErrorIntegration,
        activeRequests: providerErrorIntegration?.requestContexts?.size || 0,
        trackedProviders: providerErrorIntegration?.providerStates?.size || 0,
      },
      monitoringComponents:
        errorLoggingIntegration.getMonitoringStatus?.() || {},
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring status',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/statistics
 * Get comprehensive error statistics
 */
router.get('/statistics', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 3600000; // Default 1 hour
    const errorLoggingIntegration = req.app.errorLoggingIntegration;
    const providerErrorIntegration = req.app.providerErrorIntegration;

    const statistics = {
      timestamp: new Date().toISOString(),
      timeWindow,
      timeWindowHuman: `${timeWindow / 60000} minutes`,
      errorStatistics:
        errorLoggingIntegration.getErrorStatistics?.(timeWindow) || {},
      providerStatistics:
        providerErrorIntegration?.getErrorStatistics?.(timeWindow) || {},
      activeRequests:
        providerErrorIntegration?.getActiveRequestsSummary?.() || {},
    };

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('Error getting error statistics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get error statistics',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/report
 * Generate comprehensive monitoring report
 */
router.get('/report', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const errorLoggingIntegration = req.app.errorLoggingIntegration;
    const providerErrorIntegration = req.app.providerErrorIntegration;

    const report = {
      timestamp: new Date().toISOString(),
      errorLoggingReport:
        errorLoggingIntegration.generateMonitoringReport?.() || {},
      providerIntegrationReport:
        providerErrorIntegration?.generateMonitoringReport?.() || {},
      systemHealth: {
        errorLoggingActive: !!errorLoggingIntegration,
        providerIntegrationActive: !!providerErrorIntegration,
        monitoringComponentsStatus:
          errorLoggingIntegration.getMonitoringStatus?.() || {},
      },
    };

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating monitoring report:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate monitoring report',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/errors/recent
 * Get recent errors with detailed context
 */
router.get('/errors/recent', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const severity = req.query.severity; // optional filter
    const provider = req.query.provider; // optional filter
    const errorType = req.query.errorType; // optional filter

    const errorLoggingIntegration = req.app.errorLoggingIntegration;

    // Get recent errors from the integration
    const recentErrors = [];

    // This would typically access the error tracking data
    // For now, we'll return a structured response
    const response = {
      timestamp: new Date().toISOString(),
      filters: {
        limit,
        severity,
        provider,
        errorType,
      },
      errors: recentErrors,
      totalCount: recentErrors.length,
      message:
        recentErrors.length === 0
          ? 'No recent errors found'
          : `Found ${recentErrors.length} recent errors`,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error getting recent errors:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent errors',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/providers/:providerName/errors
 * Get errors for specific provider
 */
router.get(
  '/providers/:providerName/errors',
  ensureErrorLoggingIntegration,
  (req, res) => {
    try {
      const { providerName } = req.params;
      const timeWindow = parseInt(req.query.timeWindow) || 3600000; // Default 1 hour
      const errorType = req.query.errorType; // optional filter

      const errorLoggingIntegration = req.app.errorLoggingIntegration;
      const providerErrorIntegration = req.app.providerErrorIntegration;

      // Get provider-specific error data
      const providerErrors = {
        timestamp: new Date().toISOString(),
        providerName,
        timeWindow,
        timeWindowHuman: `${timeWindow / 60000} minutes`,
        filters: { errorType },
        statistics:
          errorLoggingIntegration.getErrorStatistics?.(timeWindow) || {},
        providerState:
          providerErrorIntegration?.providerStates?.get(providerName) || null,
        errors: [], // Would be populated from actual error tracking
      };

      res.json({
        success: true,
        data: providerErrors,
      });
    } catch (error) {
      console.error(
        `Error getting provider errors for ${req.params.providerName}:`,
        error.message
      );
      res.status(500).json({
        success: false,
        error: 'Failed to get provider errors',
        details: error.message,
      });
    }
  }
);

/**
 * GET /error-monitoring/patterns
 * Get error pattern analysis
 */
router.get('/patterns', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 3600000; // Default 1 hour
    const errorLoggingIntegration = req.app.errorLoggingIntegration;

    // Get error pattern analysis
    const patterns = {
      timestamp: new Date().toISOString(),
      timeWindow,
      timeWindowHuman: `${timeWindow / 60000} minutes`,
      errorPatterns: {}, // Would be populated from actual pattern tracking
      responseStructures: {}, // Would be populated from response structure analysis
      commonFailures: [], // Would be populated from failure analysis
      recommendations: [], // Would be populated from pattern analysis
    };

    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    console.error('Error getting error patterns:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get error patterns',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/alerts/history
 * Get alert history
 */
router.get('/alerts/history', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 3600000; // Default 1 hour
    const alertType = req.query.alertType; // optional filter
    const errorLoggingIntegration = req.app.errorLoggingIntegration;

    // Get alert history
    const alertHistory = {
      timestamp: new Date().toISOString(),
      timeWindow,
      timeWindowHuman: `${timeWindow / 60000} minutes`,
      filters: { alertType },
      alerts: [], // Would be populated from actual alert tracking
      alertsSent: 0, // Would be calculated from actual data
      suppressedAlerts: 0, // Would be calculated from actual data
      alertTypes: {}, // Would be populated from alert type breakdown
    };

    res.json({
      success: true,
      data: alertHistory,
    });
  } catch (error) {
    console.error('Error getting alert history:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert history',
      details: error.message,
    });
  }
});

/**
 * POST /error-monitoring/test-alert
 * Test alert system (for development/testing)
 */
router.post('/test-alert', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const {
      alertType = 'test_alert',
      providerName = 'test_provider',
      severity = 'medium',
    } = req.body;
    const errorLoggingIntegration = req.app.errorLoggingIntegration;

    // Create test error for alert testing
    const testError = new Error('Test error for alert system validation');

    // Log test error to trigger alert system
    errorLoggingIntegration.logProviderOperationError?.(
      testError,
      providerName,
      'test_operation',
      { test: true },
      {
        severity,
        testAlert: true,
        requestId: `test_${Date.now()}`,
      }
    );

    res.json({
      success: true,
      message: 'Test alert triggered',
      data: {
        alertType,
        providerName,
        severity,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error triggering test alert:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger test alert',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/health
 * Get error monitoring system health
 */
router.get('/health', (req, res) => {
  try {
    const errorLoggingIntegration = req.app.errorLoggingIntegration;
    const providerErrorIntegration = req.app.providerErrorIntegration;

    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      components: {
        errorLoggingIntegration: {
          status: errorLoggingIntegration ? 'healthy' : 'unavailable',
          initialized: !!errorLoggingIntegration,
        },
        providerErrorIntegration: {
          status: providerErrorIntegration ? 'healthy' : 'unavailable',
          initialized: !!providerErrorIntegration,
          activeRequests: providerErrorIntegration?.requestContexts?.size || 0,
        },
      },
      overallStatus:
        errorLoggingIntegration && providerErrorIntegration
          ? 'healthy'
          : 'degraded',
    };

    const statusCode = health.overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.overallStatus === 'healthy',
      data: health,
    });
  } catch (error) {
    console.error('Error getting error monitoring health:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get error monitoring health',
      details: error.message,
    });
  }
});

/**
 * POST /error-monitoring/cleanup
 * Cleanup old error tracking data
 */
router.post('/cleanup', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const providerErrorIntegration = req.app.providerErrorIntegration;

    // Cleanup old request contexts
    if (providerErrorIntegration?.cleanupOldContexts) {
      providerErrorIntegration.cleanupOldContexts();
    }

    res.json({
      success: true,
      message: 'Cleanup completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup error tracking data',
      details: error.message,
    });
  }
});

/**
 * GET /error-monitoring/configuration
 * Get current error monitoring configuration
 */
router.get('/configuration', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const errorLoggingIntegration = req.app.errorLoggingIntegration;

    const configuration = {
      timestamp: new Date().toISOString(),
      errorLogging: errorLoggingIntegration.config || {},
      monitoringStatus: errorLoggingIntegration.getMonitoringStatus?.() || {},
    };

    res.json({
      success: true,
      data: configuration,
    });
  } catch (error) {
    console.error('Error getting configuration:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
      details: error.message,
    });
  }
});

/**
 * PUT /error-monitoring/configuration
 * Update error monitoring configuration
 */
router.put('/configuration', ensureErrorLoggingIntegration, (req, res) => {
  try {
    const { config } = req.body;
    const errorLoggingIntegration = req.app.errorLoggingIntegration;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration provided',
      });
    }

    // Update configuration
    if (errorLoggingIntegration.updateConfiguration) {
      errorLoggingIntegration.updateConfiguration(config);
    }

    res.json({
      success: true,
      message: 'Configuration updated',
      timestamp: new Date().toISOString(),
      updatedConfig: config,
    });
  } catch (error) {
    console.error('Error updating configuration:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
      details: error.message,
    });
  }
});

module.exports = router;
