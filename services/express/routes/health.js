// services/express/routes/health.js
const express = require('express');
const fetch = require('node-fetch');
const { getFromCache } = require('../middleware/cache');
const { serviceMonitor } = require('../utils/serviceMonitor');

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const healthStatus = {
    service: 'dreamscapes-express',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  try {
    // Check memory usage
    const memUsage = process.memoryUsage();
    healthStatus.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    };

    // Check cache
    try {
      const allDreams = getFromCache('all_dreams') || [];
      healthStatus.checks.cache = {
        status: 'healthy',
        dreamsCount: allDreams.length,
      };
    } catch (cacheError) {
      healthStatus.checks.cache = {
        status: 'unhealthy',
        error: cacheError.message,
      };
      healthStatus.status = 'degraded';
    }

    // Check MCP Gateway connection
    const mcpUrl = process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';
    try {
      const mcpResponse = await fetch(`${mcpUrl}/health`, { timeout: 5000 });
      if (mcpResponse.ok) {
        healthStatus.checks.mcpGateway = {
          status: 'healthy',
          url: mcpUrl,
          responseTime: Date.now() - startTime + 'ms',
        };
      } else {
        throw new Error(`HTTP ${mcpResponse.status}`);
      }
    } catch (mcpError) {
      healthStatus.checks.mcpGateway = {
        status: 'unhealthy',
        url: mcpUrl,
        error: mcpError.message,
      };
      healthStatus.status = 'degraded';
    }

    // Check environment variables
    const requiredEnvVars = ['MCP_GATEWAY_URL'];
    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );

    healthStatus.checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'warning',
      missingVariables: missingEnvVars,
      configuredVariables: requiredEnvVars.filter(
        (envVar) => process.env[envVar]
      ),
    };

    if (missingEnvVars.length > 0 && healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    }

    // Response time
    healthStatus.responseTime = Date.now() - startTime + 'ms';

    // Set appropriate HTTP status code
    const httpStatus =
      healthStatus.status === 'healthy'
        ? 200
        : healthStatus.status === 'degraded'
        ? 200
        : 503;

    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      service: 'dreamscapes-express',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime + 'ms',
    });
  }
});

// Detailed health check with dependencies
router.get('/health/detailed', async (req, res) => {
  const startTime = Date.now();
  const detailed = {
    service: 'dreamscapes-express',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    dependencies: {},
    metrics: {},
    configuration: {},
  };

  try {
    // System metrics
    detailed.metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    };

    // Cache metrics
    try {
      const allDreams = getFromCache('all_dreams') || [];
      const cacheKeys = ['all_dreams', 'health_check_cache'];
      detailed.metrics.cache = {
        totalDreams: allDreams.length,
        cacheKeys: cacheKeys.length,
        lastDream: allDreams[0]?.created || 'none',
      };
    } catch (cacheError) {
      detailed.metrics.cache = { error: cacheError.message };
    }

    // Test MCP Gateway
    const mcpUrl = process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';
    try {
      const mcpStart = Date.now();
      const mcpResponse = await fetch(`${mcpUrl}/health`, { timeout: 10000 });
      const mcpData = await mcpResponse.json();

      detailed.dependencies.mcpGateway = {
        status: 'healthy',
        url: mcpUrl,
        responseTime: Date.now() - mcpStart,
        version: mcpData.version || 'unknown',
        uptime: mcpData.uptime || 'unknown',
      };
    } catch (mcpError) {
      detailed.dependencies.mcpGateway = {
        status: 'unhealthy',
        url: mcpUrl,
        error: mcpError.message,
      };
    }

    // Configuration check
    detailed.configuration = {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 8000,
      mcpGatewayUrl: process.env.MCP_GATEWAY_URL || 'not configured',
      frontendUrl: process.env.FRONTEND_URL || 'not configured',
      maxCacheSize: process.env.MAX_CACHE_SIZE || 'default',
    };

    // Overall status
    const unhealthyDeps = Object.values(detailed.dependencies).filter(
      (dep) => dep.status === 'unhealthy'
    ).length;

    detailed.status =
      unhealthyDeps === 0
        ? 'healthy'
        : unhealthyDeps === Object.keys(detailed.dependencies).length
        ? 'unhealthy'
        : 'degraded';

    detailed.responseTime = Date.now() - startTime;

    res.json(detailed);
  } catch (error) {
    res.status(503).json({
      service: 'dreamscapes-express',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime,
    });
  }
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    // Check if essential services are reachable
    const mcpUrl = process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';
    const mcpResponse = await fetch(`${mcpUrl}/health`, { timeout: 3000 });

    if (mcpResponse.ok) {
      res.status(200).json({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error('MCP Gateway not ready');
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Service monitoring status endpoint
router.get('/monitoring/status', (req, res) => {
  try {
    const status = serviceMonitor.getServiceStatus();
    const httpStatus =
      status.overall === 'healthy'
        ? 200
        : status.overall === 'degraded'
        ? 200
        : 503;

    res.status(httpStatus).json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get monitoring status',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed monitoring metrics endpoint
router.get('/monitoring/metrics', (req, res) => {
  try {
    const metrics = serviceMonitor.getDetailedMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get monitoring metrics',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Service alerts endpoint
router.get('/monitoring/alerts', (req, res) => {
  try {
    const status = serviceMonitor.getServiceStatus();
    res.json({
      alerts: status.alerts,
      alertCount: status.alerts.length,
      overallStatus: status.overall,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alerts',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Reset monitoring metrics endpoint (for testing/maintenance)
router.post('/monitoring/reset', (req, res) => {
  try {
    serviceMonitor.resetMetrics();
    res.json({
      success: true,
      message: 'Monitoring metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// AI service availability endpoint
router.get('/monitoring/ai-services', (req, res) => {
  try {
    const status = serviceMonitor.getServiceStatus();
    res.json({
      aiServices: status.services.aiServices,
      mcpGateway: {
        status: status.services.mcpGateway.status,
        responseTime: status.services.mcpGateway.responseTime,
        successRate: status.services.mcpGateway.successRate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get AI services status',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Fallback usage statistics endpoint
router.get('/monitoring/fallback-stats', (req, res) => {
  try {
    const status = serviceMonitor.getServiceStatus();
    const metrics = serviceMonitor.getDetailedMetrics();

    res.json({
      fallbackSystem: status.services.fallbackSystem,
      detailedStats: {
        fallbackTypes: metrics.metrics.fallbackUsage.fallbackTypes,
        fallbackReasons: metrics.metrics.fallbackUsage.fallbackReasons,
        totalFallbacks: metrics.metrics.fallbackUsage.totalFallbacks,
        fallbackRate: status.services.fallbackSystem.fallbackRate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get fallback statistics',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error patterns analysis endpoint
router.get('/monitoring/error-patterns', (req, res) => {
  try {
    const metrics = serviceMonitor.getDetailedMetrics();
    const errorPatterns = metrics.metrics.errorPatterns;

    const totalErrors =
      errorPatterns.networkErrors +
      errorPatterns.timeoutErrors +
      errorPatterns.validationErrors +
      errorPatterns.parsingErrors;

    res.json({
      errorPatterns: {
        totalErrors,
        errorTypes: {
          network: errorPatterns.networkErrors,
          timeout: errorPatterns.timeoutErrors,
          validation: errorPatterns.validationErrors,
          parsing: errorPatterns.parsingErrors,
        },
        httpErrors: errorPatterns.httpErrors,
        errorsByHour: errorPatterns.errorsByHour,
        commonErrorMessages: Object.entries(errorPatterns.commonErrorMessages)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([message, count]) => ({ message, count })),
      },
      errorRate: serviceMonitor.getErrorRate(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get error patterns',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
