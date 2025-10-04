// services/mcp-gateway/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import enhanced provider management system
const ProviderManager = require('./providers/ProviderManager');
const cerebrasService = require('./services/cerebrasService');
const openaiService = require('./services/openaiService');
const promptBuilder = require('./services/promptBuilder');
const responseParser = require('./utils/responseParser');
const asyncHelpers = require('./utils/asyncHelpers');
const {
  errorHandler,
  asyncHandler,
  aiServiceErrorHandler,
} = require('./utils/errorHandler');
const { logger, requestLogger } = require('./utils/logger');

// Import enhanced monitoring system
const MonitoringMiddleware = require('./middleware/monitoringMiddleware');

// Import performance optimization middleware
const PerformanceMiddleware = require('./middleware/performanceMiddleware');

// Import request validation middleware
const RequestValidator = require('./middleware/requestValidator');

// Import enhanced response transformation
const EnhancedResponseTransformer = require('./utils/EnhancedResponseTransformer');

// Import gateway fallback handler
const GatewayFallbackHandler = require('./utils/GatewayFallbackHandler');

// Import error response builder
const ErrorResponseBuilder = require('./utils/ErrorResponseBuilder');

// Import extraction metrics collector
const ExtractionMetricsCollector = require('./utils/ExtractionMetricsCollector');

// Import enhanced validation and repair system
const { ValidationPipeline } = require('./engine');

// Import shared validation monitor
// In Docker: ./shared (copied to /app/shared)
// In local dev: ../../shared (workspace root)
const { validationMonitor } = require('../../shared');

// Import enhanced caching system
const { getCacheService } = require('./services/cacheService');
const cacheRoutes = require('./routes/cache');

// Import new enhanced routes
const providerRoutes = require('./routes/providers');
const streamingRoutes = require('./routes/streaming');
const qualityRoutes = require('./routes/quality');
const healthRoutes = require('./routes/health');
const monitoringRoutes = require('./routes/monitoring');

// Initialize validation pipeline
const validationPipeline = new ValidationPipeline();

// Initialize performance middleware first
const initializePerformanceSystem = async () => {
  try {
    await initializePerformanceMiddleware();
    logger.info('Performance system initialized');
  } catch (error) {
    logger.error('Performance system initialization failed:', error.message);
    // Continue without performance optimization
  }
};

// Initialize enhanced provider manager
let providerManager = null;
const initializeProviderManager = async () => {
  try {
    providerManager = new ProviderManager({
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
      maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
      backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER) || 2,
      circuitBreakerThreshold:
        parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
      circuitBreakerTimeout:
        parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000,
      enableEnhancedMonitoring:
        process.env.ENABLE_ENHANCED_MONITORING !== 'false',
      enableAutomatedReporting:
        process.env.ENABLE_AUTOMATED_REPORTING !== 'false',
    });

    // Register providers
    if (process.env.CEREBRAS_API_KEY) {
      try {
        // Instantiate Cerebras service with configuration
        const cerebrasInstance = new cerebrasService({
          apiKey: process.env.CEREBRAS_API_KEY,
          apiUrl:
            process.env.CEREBRAS_API_URL ||
            'https://api.cerebras.ai/v1/chat/completions',
          model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
        });

        providerManager.registerProvider('cerebras', cerebrasInstance, {
          enabled: true,
          priority: 3, // Highest priority
          limits: {
            requestsPerMinute:
              parseInt(process.env.CEREBRAS_REQUESTS_PER_MINUTE) || 100,
            tokensPerMinute:
              parseInt(process.env.CEREBRAS_TOKENS_PER_MINUTE) || 50000,
            maxConcurrent: parseInt(process.env.CEREBRAS_MAX_CONCURRENT) || 10,
          },
          fallback: {
            enabled: true,
            retryAttempts: 3,
            backoffMultiplier: 2,
          },
        });
        logger.info('Cerebras provider registered with ProviderManager');
      } catch (error) {
        console.error('Failed to register Cerebras provider:', error.message);
        console.error('Stack:', error.stack);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      providerManager.registerProvider('openai', openaiService, {
        enabled: true,
        priority: 2, // Secondary priority
        limits: {
          requestsPerMinute:
            parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE) || 60,
          tokensPerMinute:
            parseInt(process.env.OPENAI_TOKENS_PER_MINUTE) || 40000,
          maxConcurrent: parseInt(process.env.OPENAI_MAX_CONCURRENT) || 5,
        },
        fallback: {
          enabled: true,
          retryAttempts: 2,
          backoffMultiplier: 1.5,
        },
      });
      logger.info('OpenAI provider registered with ProviderManager');
    }

    // Initialize enhanced monitoring for provider manager
    providerManager.initializeEnhancedMonitoring({
      collectionInterval:
        parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 60000,
      aggregationInterval:
        parseInt(process.env.METRICS_AGGREGATION_INTERVAL) || 300000,
      detailedCheckInterval:
        parseInt(process.env.DETAILED_HEALTH_CHECK_INTERVAL) || 300000,
      alertThresholds: {
        errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.1,
        responseTime:
          parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 10000,
        consecutiveFailures:
          parseInt(process.env.ALERT_CONSECUTIVE_FAILURES) || 5,
      },
      alertChannels: ['console', 'log'],
    });

    logger.info('Enhanced ProviderManager initialized with monitoring');
  } catch (error) {
    logger.error('Failed to initialize ProviderManager:', error.message);
    throw error;
  }
};

// Initialize cache service
let cacheService = null;
const initializeCacheService = async () => {
  try {
    cacheService = getCacheService();
    await cacheService.initialize();
    logger.info('Enhanced caching system initialized');
  } catch (error) {
    logger.warn(
      'Failed to initialize caching system, continuing without cache:',
      error.message
    );
  }
};

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize monitoring system
const monitoringConfig = {
  enableRequestTracking: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  enableHealthEndpoints: true,
  enableMetricsEndpoints: true,

  monitoring: {
    enableMetrics: true,
    enableAlerting: true,
    enableHealthMonitoring: true,
    enableDashboard: process.env.ENABLE_MONITORING_DASHBOARD !== 'false',

    metrics: {
      collectionInterval:
        parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 60000,
      aggregationInterval:
        parseInt(process.env.METRICS_AGGREGATION_INTERVAL) || 300000,
    },

    alerting: {
      thresholds: {
        errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.1,
        responseTime:
          parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 10000,
        consecutiveFailures:
          parseInt(process.env.ALERT_CONSECUTIVE_FAILURES) || 5,
      },
      notifications: {
        console: true,
        email: process.env.ENABLE_EMAIL_ALERTS === 'true',
        slack: process.env.ENABLE_SLACK_ALERTS === 'true',
      },
    },

    health: {
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
      detailedCheckInterval:
        parseInt(process.env.DETAILED_HEALTH_CHECK_INTERVAL) || 300000,
    },

    dashboard: {
      enableWebInterface: process.env.ENABLE_MONITORING_WEB_UI !== 'false',
      webPort: parseInt(process.env.MONITORING_WEB_PORT) || 3001,
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: true,
    enableFile: process.env.ENABLE_FILE_LOGGING !== 'false',
    enablePerformanceLogging:
      process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD) || 5000,
  },
};

const monitoringMiddleware = new MonitoringMiddleware(monitoringConfig);

// Initialize performance middleware
const performanceConfig = {
  // Request queue settings
  maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10,
  maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE) || 100,
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,

  // Rate limiting settings
  globalRequestsPerMinute:
    parseInt(process.env.GLOBAL_REQUESTS_PER_MINUTE) || 200,
  globalTokensPerMinute:
    parseInt(process.env.GLOBAL_TOKENS_PER_MINUTE) || 100000,
  enableAdaptiveThrottling: process.env.ENABLE_ADAPTIVE_THROTTLING !== 'false',

  // Resource management settings
  enableAutoScaling: process.env.ENABLE_AUTO_SCALING !== 'false',
  memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD) || 0.8,
  cpuThreshold: parseFloat(process.env.CPU_THRESHOLD) || 0.75,

  // Performance monitoring settings
  monitoringInterval:
    parseInt(process.env.PERFORMANCE_MONITORING_INTERVAL) || 5000,
  enableAutoOptimization: process.env.ENABLE_AUTO_OPTIMIZATION !== 'false',

  // Feature toggles
  enableRequestQueuing: process.env.ENABLE_REQUEST_QUEUING !== 'false',
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
  enableResourceManagement: process.env.ENABLE_RESOURCE_MANAGEMENT !== 'false',
  enablePerformanceMonitoring:
    process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
  enableAutomaticOptimization:
    process.env.ENABLE_AUTOMATIC_OPTIMIZATION !== 'false',
};

const performanceMiddleware = new PerformanceMiddleware(performanceConfig);

// Initialize request validator
const requestValidator = new RequestValidator({
  strictMode: process.env.STRICT_VALIDATION !== 'false',
  logValidation: process.env.LOG_VALIDATION !== 'false',
});

// Initialize extraction metrics collector
const extractionMetricsCollector = new ExtractionMetricsCollector({
  enableLogging: process.env.LOG_EXTRACTION_METRICS !== 'false',
  maxHistorySize: parseInt(process.env.EXTRACTION_HISTORY_SIZE) || 1000,
  aggregationInterval:
    parseInt(process.env.EXTRACTION_AGGREGATION_INTERVAL) || 60000,
  syncInterval: parseInt(process.env.EXTRACTION_SYNC_INTERVAL) || 300000,
});

// Initialize response transformer
const responseTransformer = new EnhancedResponseTransformer({
  enableValidation: process.env.ENABLE_RESPONSE_VALIDATION !== 'false',
  enableRepair: process.env.ENABLE_RESPONSE_REPAIR !== 'false',
  strictMode: process.env.STRICT_VALIDATION !== 'false',
  logTransformations: process.env.LOG_TRANSFORMATIONS !== 'false',
  extractionMetricsCollector: extractionMetricsCollector,
});

// Initialize fallback handler
const fallbackHandler = new GatewayFallbackHandler({
  enableFallbackGeneration: process.env.ENABLE_FALLBACK_GENERATION !== 'false',
  enableEmergencyRepair: process.env.ENABLE_EMERGENCY_REPAIR !== 'false',
  logFallbacks: process.env.LOG_FALLBACKS !== 'false',
});

// Initialize error response builder
const errorResponseBuilder = new ErrorResponseBuilder({
  includeStackTrace: process.env.NODE_ENV === 'development',
  includeResponseSample: process.env.INCLUDE_ERROR_SAMPLES !== 'false',
  maxSampleLength: 500,
});

// ProviderManager will be initialized in startup

// Security and middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Initialize performance middleware
let performanceMiddlewareInitialized = false;
const initializePerformanceMiddleware = async () => {
  try {
    await performanceMiddleware.initialize();
    performanceMiddlewareInitialized = true;
    logger.info('Performance middleware initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize performance middleware:', error.message);
    logger.warn('Continuing without performance optimization');
  }
};

// Apply performance middleware
app.use((req, res, next) => {
  if (performanceMiddlewareInitialized) {
    return performanceMiddleware.middleware()(req, res, next);
  } else {
    // Skip performance middleware if not initialized
    next();
  }
});

// Structured request logging (legacy)
app.use(requestLogger());

// Cache management routes
app.use('/cache', cacheRoutes);

// Provider management routes
app.use('/providers', providerRoutes);

// Streaming endpoints
app.use('/streaming', streamingRoutes);

// Quality feedback and analytics routes
app.use('/quality', qualityRoutes);

// Enhanced health check routes
app.use('/health', healthRoutes);

// Enhanced monitoring routes
app.use('/monitoring', monitoringRoutes);

// Performance monitoring endpoints
app.get('/performance/status', (req, res) => {
  logger.debug('Performance status requested');
  try {
    const status = performanceMiddleware.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get performance status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance status',
    });
  }
});

app.get('/performance/metrics', (req, res) => {
  logger.debug('Performance metrics requested');
  try {
    const metrics = performanceMiddleware.getDetailedMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get performance metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
    });
  }
});

app.get('/performance/optimization', (req, res) => {
  logger.debug('Performance optimization recommendations requested');
  try {
    const recommendations =
      performanceMiddleware.performanceMonitor?.getOptimizationRecommendations() ||
      [];
    res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get optimization recommendations', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve optimization recommendations',
    });
  }
});

app.post('/performance/optimize', (req, res) => {
  logger.debug('Manual performance optimization requested');
  try {
    // Trigger manual optimization
    performanceMiddleware.performAutomaticOptimization();
    res.json({
      success: true,
      message: 'Performance optimization triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to trigger optimization', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to trigger performance optimization',
    });
  }
});

// Basic health check (legacy endpoint)
app.get('/health', (req, res) => {
  logger.debug('Basic health check requested');

  const healthData = {
    service: 'dreamscapes-mcp-gateway',
    status: 'healthy',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Add provider summary if ProviderManager is available
  if (
    providerManager &&
    typeof providerManager.getProviderHealth === 'function'
  ) {
    try {
      const providerHealth = providerManager.getProviderHealth();
      healthData.providers = {
        total: providerHealth.summary?.total || 0,
        healthy: providerHealth.summary?.healthy || 0,
        unhealthy: providerHealth.summary?.unhealthy || 0,
      };

      // Set status based on provider health
      if (providerHealth.summary?.unhealthy > 0) {
        healthData.status = 'degraded';
      }
    } catch (error) {
      logger.warn(
        'Failed to get provider health for basic health check:',
        error.message
      );
      healthData.status = 'degraded';
      healthData.warning = 'Provider health check failed';
    }
  }

  const statusCode = healthData.status === 'healthy' ? 200 : 206;
  res.status(statusCode).json(healthData);
});

// Validation and repair metrics endpoint
app.get('/metrics/validation', (req, res) => {
  logger.debug('Validation metrics requested');
  try {
    const metrics = validationPipeline.getComprehensiveMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get validation metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation metrics',
    });
  }
});

// Extraction metrics endpoint
app.get('/metrics/extraction', (req, res) => {
  logger.debug('Extraction metrics requested');
  try {
    // Get extraction metrics from collector
    const extractionMetrics = extractionMetricsCollector.getMetricsReport();

    // Get validation metrics from shared ValidationMonitor
    const validationMetrics = validationMonitor
      ? {
          overall: validationMonitor.getOverallMetrics(),
          byService: validationMonitor.getServiceMetrics('mcp-gateway'),
          recentFailures: validationMonitor.getRecentFailures(10),
        }
      : null;

    // Get repair metrics from shared ValidationMonitor
    const repairMetrics =
      validationMonitor && validationMonitor.metrics.repairs
        ? {
            total: validationMonitor.metrics.repairs.total || 0,
            successful: validationMonitor.metrics.repairs.successful || 0,
            failed: validationMonitor.metrics.repairs.failed || 0,
            successRate:
              validationMonitor.metrics.repairs.total > 0
                ? (validationMonitor.metrics.repairs.successful /
                    validationMonitor.metrics.repairs.total) *
                  100
                : 0,
            byProvider: validationMonitor.metrics.repairs.byProvider || {},
            byStrategy: validationMonitor.metrics.repairs.byStrategy || {},
          }
        : null;

    // Generate extraction alerts
    const extractionAlerts =
      extractionMetricsCollector.generateExtractionAlerts();

    // Build comprehensive response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      extraction: {
        overall: extractionMetrics.overall,
        byProvider: extractionMetrics.byProvider,
        byPattern: extractionMetrics.byPattern,
        failurePatterns: extractionMetrics.failurePatterns,
        recentFailures: extractionMetrics.recentFailures,
        insights: extractionMetrics.insights,
      },
      validation: validationMetrics,
      repair: repairMetrics,
      alerts: {
        extraction: extractionAlerts,
        summary: {
          total: extractionAlerts.length,
          critical: extractionAlerts.filter((a) => a.severity === 'critical')
            .length,
          warning: extractionAlerts.filter((a) => a.severity === 'warning')
            .length,
          info: extractionAlerts.filter((a) => a.severity === 'info').length,
        },
      },
      summary: {
        extractionSuccessRate: extractionMetrics.overall.successRate,
        validationSuccessRate: validationMetrics
          ? validationMetrics.overall.successRate
          : null,
        repairSuccessRate: repairMetrics ? repairMetrics.successRate : null,
        totalExtractionAttempts: extractionMetrics.overall.totalAttempts,
        totalValidations: validationMetrics
          ? validationMetrics.overall.totalValidations
          : null,
        totalRepairs: repairMetrics ? repairMetrics.total : null,
        activeAlerts: extractionAlerts.length,
        criticalAlerts: extractionAlerts.filter(
          (a) => a.severity === 'critical'
        ).length,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get extraction metrics', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve extraction metrics',
      message: error.message,
    });
  }
});

// Enhanced status endpoint with ProviderManager integration
app.get(
  '/status',
  asyncHandler(async (req, res) => {
    logger.debug('Enhanced status check requested');
    const startTime = Date.now();

    const status = {
      service: 'dreamscapes-mcp-gateway',
      timestamp: new Date().toISOString(),
      responseTime: 0,
      services: {},
      providerManager: {
        initialized: !!providerManager,
        providersRegistered: providerManager
          ? providerManager.getProviders().length
          : 0,
        healthMonitorActive: !!(
          providerManager && providerManager.healthMonitor
        ),
        metricsCollectorActive: !!(
          providerManager && providerManager.metricsCollector
        ),
        alertingSystemActive: !!(
          providerManager && providerManager.alertingSystem
        ),
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    if (providerManager) {
      try {
        // Use enhanced ProviderManager methods
        if (typeof providerManager.getProviderHealth === 'function') {
          const providerHealth = providerManager.getProviderHealth();

          // Convert provider health to status format
          Object.entries(providerHealth.providers || {}).forEach(
            ([providerName, healthData]) => {
              status.services[providerName] = {
                status: healthData.isHealthy ? 'healthy' : 'unhealthy',
                responseTime: healthData.metrics?.avgResponseTime || 0,
                lastCheck: healthData.lastCheck,
                error: healthData.lastError || null,
                consecutiveFailures: healthData.consecutiveFailures || 0,
                circuitBreakerState: healthData.circuitBreakerState,
                enabled: healthData.enabled,
                priority: healthData.priority,
              };
            }
          );

          // Add provider summary to providerManager section
          status.providerManager.summary = providerHealth.summary;
        } else {
          // Fallback to legacy health check method
          const healthResults = await providerManager.healthCheck();

          Object.entries(healthResults).forEach(
            ([providerName, healthData]) => {
              status.services[providerName] = {
                status: healthData.isHealthy ? 'healthy' : 'unhealthy',
                responseTime: healthData.responseTime,
                lastCheck: healthData.timestamp,
                error: healthData.error || null,
              };
            }
          );
        }

        // Add provider metrics if available
        if (typeof providerManager.getProviderMetrics === 'function') {
          const metrics = providerManager.getProviderMetrics();
          status.providerManager.metrics = {};

          Object.entries(metrics).forEach(([providerName, providerMetrics]) => {
            status.providerManager.metrics[providerName] = {
              requests: providerMetrics.requests || 0,
              successes: providerMetrics.successes || 0,
              failures: providerMetrics.failures || 0,
              successRate: providerMetrics.successRate || 0,
              avgResponseTime: providerMetrics.avgResponseTime || 0,
              consecutiveFailures: providerMetrics.consecutiveFailures || 0,
              lastRequestTime: providerMetrics.lastRequestTime,
            };
          });
        }

        logger.debug(
          'Enhanced provider status checks completed via ProviderManager'
        );
      } catch (error) {
        logger.error(
          'Enhanced ProviderManager status check failed:',
          error.message
        );
        status.providerManager.error = error.message;

        // Fallback to individual service checks
        await performFallbackHealthChecks(status);
      }
    } else {
      logger.warn(
        'ProviderManager not initialized, using fallback health checks'
      );
      await performFallbackHealthChecks(status);
    }

    // LLaMA stylist (optional - not managed by ProviderManager yet)
    const LLAMA_URL = process.env.LLAMA_URL;
    if (LLAMA_URL) {
      try {
        const pong = await cerebrasService.pingUrl(LLAMA_URL);
        status.services.llama = {
          status: 'reachable',
          url: LLAMA_URL,
          pong,
          managed: false,
        };
        logger.debug('LLaMA service check: reachable', { url: LLAMA_URL });
      } catch (err) {
        status.services.llama = {
          status: 'unreachable',
          error: err.message,
          url: LLAMA_URL,
          managed: false,
        };
        logger.warn('LLaMA service check failed', {
          url: LLAMA_URL,
          error: err.message,
        });
      }
    } else {
      status.services.llama = {
        status: 'not_configured',
        managed: false,
      };
      logger.debug('LLaMA service: not configured');
    }

    status.responseTime = Date.now() - startTime;

    // Determine overall status
    const serviceStatuses = Object.values(status.services).map((s) => s.status);
    const hasUnhealthy =
      serviceStatuses.includes('unhealthy') ||
      serviceStatuses.includes('unreachable');
    const overallStatus = hasUnhealthy ? 'degraded' : 'healthy';

    status.overallStatus = overallStatus;

    const statusCode = overallStatus === 'healthy' ? 200 : 206;
    res.status(statusCode).json(status);
  })
);

// Fallback health check function
async function performFallbackHealthChecks(status) {
  // Cerebras
  if (process.env.CEREBRAS_API_KEY) {
    try {
      await cerebrasService.testConnection();
      status.services.cerebras = { status: 'healthy' };
      logger.debug('Cerebras service check: healthy');
    } catch (err) {
      status.services.cerebras = { status: 'unhealthy', error: err.message };
      logger.warn('Cerebras service check failed', { error: err.message });
    }
  } else {
    status.services.cerebras = { status: 'not_configured' };
    logger.debug('Cerebras service: not configured');
  }

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      await openaiService.testConnection();
      status.services.openai = { status: 'healthy' };
      logger.debug('OpenAI service check: healthy');
    } catch (err) {
      status.services.openai = { status: 'unhealthy', error: err.message };
      logger.warn('OpenAI service check failed', { error: err.message });
    }
  } else {
    status.services.openai = { status: 'not_configured' };
    logger.debug('OpenAI service: not configured');
  }
}

// Main parse endpoint - dream text -> scene JSON
app.post(
  '/parse',
  requestValidator.parseRequestMiddleware(),
  asyncHandler(async (req, res, next) => {
    const startTime = Date.now();
    const { text, style = 'ethereal', options = {} } = req.body;

    logger.info('Dream parse request', {
      textLength: text?.length || 0,
      validationPassed: req.validationMetadata?.validated || false,
      style,
      hasOptions: Object.keys(options).length > 0,
    });

    // Check cache first
    let cachedResponse = null;
    if (cacheService && cacheService.isAvailable()) {
      try {
        cachedResponse = await cacheService.getCachedDream(text, {
          style,
          ...options,
        });
        if (cachedResponse) {
          logger.info('Cache hit for dream parse', {
            textLength: text.length,
            style,
            cacheAge:
              Date.now() - (cachedResponse.cacheMetadata?.cachedAt || 0),
          });

          // Update metadata for cache hit
          cachedResponse.metadata = {
            ...cachedResponse.metadata,
            cacheHit: true,
            processingTimeMs: Date.now() - startTime,
            servedAt: new Date().toISOString(),
          };

          return res.json({
            success: true,
            data: cachedResponse,
            metadata: {
              source: cachedResponse.metadata?.source || 'cache',
              processingTimeMs: Date.now() - startTime,
              cacheHit: true,
              validation: cachedResponse.metadata?.validation,
            },
          });
        }
      } catch (cacheError) {
        logger.warn(
          'Cache lookup failed, proceeding with AI generation:',
          cacheError.message
        );
      }
    }

    // Build prompt
    const prompt = await promptBuilder.buildDreamParsePrompt(
      text,
      style,
      options
    );
    let aiRaw = null;
    let source = null;
    let providerMetadata = null;

    // Use ProviderManager for intelligent provider selection and fallback
    if (providerManager) {
      try {
        const result = await providerManager.executeWithFallback(
          async (provider, providerName, context) => {
            logger.info(`Generating dream with provider: ${providerName}`, {
              style,
              textLength: text.length,
              context,
              attempt: context.attemptNumber || 1,
            });

            // Enhanced monitoring integration
            let aiRequestId = null;
            let monitoringRequestId = null;

            // Initialize timing variable outside try block
            const providerStart = Date.now();

            try {
              // Start monitoring tracking
              if (app.aiTracking) {
                aiRequestId = app.aiTracking.startAIRequest(
                  providerName,
                  'generateDream',
                  {
                    model: providerName === 'cerebras' ? 'cerebras' : 'gpt-4',
                    temperature: options.temperature || 0.6,
                    maxTokens:
                      options.maxTokens ||
                      (providerName === 'cerebras' ? 32768 : 4000),
                    prompt: prompt.substring(0, 100) + '...', // Truncated for logging
                  }
                );

                monitoringRequestId = app.aiTracking.recordRequestStart(
                  providerName,
                  {
                    operation: 'generateDream',
                    model: providerName === 'cerebras' ? 'cerebras' : 'gpt-4',
                    inputTokens: Math.ceil(prompt.length / 4), // Rough token estimate
                    style,
                  }
                );
              }

              const response = await provider.generateDream(prompt, {
                ...options,
                streaming: options.streaming || false,
                context: context,
              });
              const responseTime = Date.now() - providerStart;

              // CRITICAL: Log raw provider response structure for debugging
              logger.info('Raw provider response received', {
                provider: providerName,
                responseTime,
                responseType: typeof response,
                isNull: response === null,
                isUndefined: response === undefined,
                topLevelKeys:
                  response && typeof response === 'object'
                    ? Object.keys(response)
                    : [],
              });

              // Log detailed response structure
              if (response && typeof response === 'object') {
                logger.debug('Provider response structure details', {
                  provider: providerName,
                  hasData: 'data' in response,
                  hasContent: 'content' in response,
                  hasChoices: 'choices' in response,
                  hasMessage: 'message' in response,
                  hasText: 'text' in response,
                  hasId: 'id' in response,
                  hasStructures: 'structures' in response,
                  hasEntities: 'entities' in response,
                });

                // Log sample of response (first 500 chars)
                try {
                  const responseSample = JSON.stringify(response).substring(
                    0,
                    500
                  );
                  logger.debug('Provider response sample', {
                    provider: providerName,
                    sample:
                      responseSample +
                      (JSON.stringify(response).length > 500
                        ? '...[truncated]'
                        : ''),
                  });
                } catch (e) {
                  logger.warn('Could not stringify response for logging', {
                    provider: providerName,
                    error: e.message,
                  });
                }
              } else if (typeof response === 'string') {
                logger.debug('Provider response is string', {
                  provider: providerName,
                  length: response.length,
                  sample:
                    response.substring(0, 500) +
                    (response.length > 500 ? '...[truncated]' : ''),
                });
              }

              // End monitoring tracking with success
              if (app.aiTracking) {
                // Safely extract content for logging
                const safeContent = responseParser.extractContentSafely(
                  response,
                  providerName
                );
                const contentLength = safeContent ? safeContent.length : 0;
                const truncatedResponse = safeContent
                  ? safeContent.length > 200
                    ? safeContent.substring(0, 200) + '...'
                    : safeContent
                  : 'No content extracted';

                app.aiTracking.endAIRequest(aiRequestId, {
                  success: true,
                  response: truncatedResponse,
                  tokens: Math.ceil(contentLength / 4) || 0, // Rough token estimate
                });

                app.aiTracking.recordRequestEnd(monitoringRequestId, {
                  success: true,
                  tokens: {
                    output: Math.ceil(contentLength / 4) || 0,
                    total: Math.ceil((prompt.length + contentLength) / 4),
                  },
                });
              }

              logger.logAIRequest(
                providerName,
                'generateDream',
                responseTime,
                true,
                {
                  style,
                  contextPreserved: !!context.previousProvider,
                }
              );

              // ============================================================
              // CRITICAL ASYNC/AWAIT POINT #1: Content Extraction
              // ============================================================
              // This await is ESSENTIAL to prevent Promise leakage that causes 502 errors.
              // The extractContentSafely method processes provider responses which may be
              // JSON strings, objects, or nested structures. Without this await, the
              // extractedContent variable would contain a pending Promise instead of the
              // actual dream data, causing downstream processing to fail with empty objects.
              //
              // Why this matters:
              // - Cerebras returns JSON strings that need parsing
              // - The parser uses async operations internally
              // - Missing await here = Promise { <pending> } in extractedContent
              // - Result: ProviderManager returns {}, Express gets 502 error
              const extractedContent =
                await responseParser.extractContentSafely(
                  response,
                  providerName
                );
              logger.info(
                '---------XXXXXXXXXXXXXXXXXXX--------extracted Content:',
                extractedContent
              );
              // Track extraction success
              if (app.aiTracking) {
                app.aiTracking.recordExtraction(
                  providerName,
                  !!extractedContent,
                  extractedContent ? null : 'No content extracted'
                );
              }

              // ============================================================
              // CRITICAL ASYNC/AWAIT POINT #2: Promise Resolution Safety Net
              // ============================================================
              // This await provides a safety net to catch any Promises that might have
              // escaped the extraction process. The ensureResolved helper checks if the
              // value is a Promise and awaits it if necessary, otherwise returns it as-is.
              //
              // Why this matters:
              // - Defensive programming against async bugs
              // - Handles edge cases where extraction returns a Promise
              // - Guarantees finalContent is NEVER a Promise
              // - Last line of defense before building the result object
              const finalContent = await asyncHelpers.ensureResolved(
                extractedContent || response
              );

              // Log value state for debugging Promise issues
              logger.debug('Value state: finalContent', {
                type: typeof finalContent,
                isPromise: finalContent instanceof Promise,
                isNull: finalContent === null,
                isUndefined: finalContent === undefined,
                constructor: finalContent?.constructor?.name,
                provider: providerName,
                responseTime,
              });

              const finalContentLength =
                typeof finalContent === 'string' ? finalContent.length : 0;

              // Build result object
              const result = {
                content: finalContent,
                tokens: {
                  input: Math.ceil(prompt.length / 4),
                  output: Math.ceil(finalContentLength / 4) || 0,
                  total: Math.ceil((prompt.length + finalContentLength) / 4),
                },
                provider: providerName,
                responseTime,
                context,
              };

              // ============================================================
              // CRITICAL VALIDATION POINT: Pre-Return Promise Check
              // ============================================================
              // This validation ensures the result object contains NO Promise values
              // before returning to ProviderManager. This is our final checkpoint to
              // prevent Promise leakage from reaching the Express response handler.
              //
              // Why this matters:
              // - Catches any Promises that escaped earlier checks
              // - Validates ALL fields in the result object, not just content
              // - Throws immediately if Promise detected (fail-fast)
              // - Prevents 502 errors by catching bugs at the source
              //
              // If this validation fails, it means there's a bug in the async handling
              // above that needs to be fixed - the Promise should have been awaited.
              try {
                asyncHelpers.validateNoPromises(
                  result,
                  'operation result',
                  app.aiTracking,
                  providerName
                );
              } catch (promiseError) {
                // Promise detected - this will be tracked in metrics
                throw promiseError;
              }

              return result;
            } catch (error) {
              // End monitoring tracking with error
              if (app.aiTracking) {
                app.aiTracking.endAIRequest(aiRequestId, {
                  success: false,
                  error: error.message,
                });

                app.aiTracking.recordRequestEnd(monitoringRequestId, {
                  success: false,
                  error: error.message,
                });
              }

              logger.logAIRequest(
                providerName,
                'generateDream',
                Date.now() - providerStart,
                false,
                {
                  error: error.message,
                  style,
                  contextPreserved: !!context.previousProvider,
                }
              );

              throw error;
            }
          },
          null, // Use automatic provider selection
          {
            maxAttempts: 5,
            timeout: options.timeout || 30000,
            preserveContext: true,
            operationType: 'generateDream',
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            streaming: options.streaming,
            inputTokens: Math.ceil(prompt.length / 4),
            metadata: {
              style,
              textLength: text.length,
              requestId: `dream_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
            },
            context: {
              originalText: text,
              style,
              options,
            },
          }
        );

        // ============================================================
        // CRITICAL VALIDATION POINT: Post-ProviderManager Promise Check
        // ============================================================
        // This validation runs AFTER ProviderManager.executeWithFallback returns.
        // It's a safety net to catch any Promise leakage that might have escaped
        // both the operation callback validation AND the ProviderManager's own
        // validation. This is our last chance to catch the bug before the result
        // reaches the Express response handler.
        //
        // Why this matters:
        // - Double-checks that ProviderManager returned clean data
        // - Catches bugs in ProviderManager's Promise handling
        // - Provides detailed logging for debugging
        // - Attempts recovery if Promise detected (see catch block)
        //
        // If this validation fails, it indicates a serious bug in either:
        // 1. The operation callback (should have been caught earlier)
        // 2. ProviderManager's result handling (needs investigation)
        try {
          asyncHelpers.validateNoPromises(result, 'providerManager result');
          logger.debug('Value state: result.content', {
            type: typeof result.content,
            isPromise: result.content instanceof Promise,
            isNull: result.content === null,
            isUndefined: result.content === undefined,
            constructor: result.content?.constructor?.name,
            provider: result.provider,
            responseTime: result.responseTime,
          });
        } catch (promiseError) {
          logger.error('Promise detected in providerManager result', {
            error: promiseError.message,
            provider: result.provider,
            resultKeys: Object.keys(result),
            contentType: typeof result.content,
            contentIsPromise: result.content instanceof Promise,
          });

          // Attempt to resolve the Promise if detected
          if (result.content instanceof Promise) {
            logger.warn(
              'Attempting to resolve unresolved Promise in result.content'
            );
            try {
              result.content = await result.content;
              logger.info('Successfully resolved Promise in result.content', {
                contentType: typeof result.content,
                contentLength:
                  typeof result.content === 'string'
                    ? result.content.length
                    : 0,
              });
            } catch (resolveError) {
              logger.error('Failed to resolve Promise in result.content', {
                error: resolveError.message,
              });
              throw new Error(
                `Unresolved Promise in result.content: ${resolveError.message}`
              );
            }
          } else {
            // Re-throw if it's not a Promise we can resolve
            throw promiseError;
          }
        }

        aiRaw = result.content;
        source = result.provider;

        console.log(
          'aiRaw:result.content \n',
          aiRaw,
          '\n source = result.provider \n',
          source
        );

        providerMetadata = {
          responseTime: result.responseTime,
          tokens: result.tokens,
          context: result.context,
          attempts: result.context?.attemptNumber || 1,
        };

        logger.info('Dream generation completed via ProviderManager', {
          provider: source,
          responseTime: result.responseTime,
          attempts: result.context?.attemptNumber || 1,
          tokensUsed: result.tokens?.total || 0,
        });
      } catch (error) {
        logger.error('ProviderManager dream generation failed:', error.message);

        // Use fallback handler instead of returning error
        try {
          // Track fallback usage
          if (app.aiTracking) {
            app.aiTracking.recordFallbackUsage(
              source || 'unknown',
              'Provider failure',
              'local_generation'
            );
          }

          const fallbackDream = await fallbackHandler.handleProviderFailure(
            error,
            { text, style, options }
          );

          logger.info('Fallback dream generated successfully', {
            structureCount: fallbackDream.structures?.length || 0,
            entityCount: fallbackDream.entities?.length || 0,
          });

          // Return fallback dream with success flag
          return res.json({
            success: true,
            data: fallbackDream,
            metadata: {
              source: 'fallback',
              fallbackReason: 'Provider failure',
              originalError: error.message,
              processingTimeMs: Date.now() - startTime,
            },
          });
        } catch (fallbackError) {
          logger.error(
            'Fallback generation also failed:',
            fallbackError.message
          );

          // Track 502 error
          if (app.aiTracking) {
            app.aiTracking.record502Error(
              source || 'unknown',
              'AI provider generation failed and fallback failed',
              {
                providerError: error.message,
                fallbackError: fallbackError.message,
              }
            );
          }

          // Return error only if fallback also fails
          return res.status(502).json({
            success: false,
            error: 'AI provider generation failed and fallback failed',
            details: {
              providerError: error.message,
              fallbackError: fallbackError.message,
            },
          });
        }
      }
    } else {
      // Fallback to legacy provider logic if ProviderManager not available
      logger.warn('ProviderManager not available, using legacy provider logic');

      // Legacy provider selection logic (simplified)
      if (process.env.CEREBRAS_API_KEY) {
        try {
          const cerebrasStart = Date.now();
          aiRaw = await cerebrasService.generateDream(prompt, options);
          source = 'cerebras';
          providerMetadata = { responseTime: Date.now() - cerebrasStart };
          logger.logAIRequest(
            'cerebras',
            'generateDream',
            providerMetadata.responseTime,
            true,
            { style }
          );
        } catch (err) {
          logger.logAIRequest(
            'cerebras',
            'generateDream',
            Date.now() - startTime,
            false,
            {
              error: err.message,
              style,
            }
          );
        }
      }

      // Fallback: OpenAI
      if (!aiRaw && process.env.OPENAI_API_KEY) {
        try {
          const openaiStart = Date.now();
          aiRaw = await openaiService.generateDream(prompt, options);
          source = 'openai';
          providerMetadata = { responseTime: Date.now() - openaiStart };
          logger.logAIRequest(
            'openai',
            'generateDream',
            providerMetadata.responseTime,
            true,
            { style }
          );
        } catch (err) {
          logger.logAIRequest(
            'openai',
            'generateDream',
            Date.now() - startTime,
            false,
            {
              error: err.message,
              style,
            }
          );
        }
      }

      // If still nothing, use fallback handler
      if (!aiRaw) {
        logger.error('No AI providers available for dream generation', {
          cerebrasConfigured: !!process.env.CEREBRAS_API_KEY,
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          providerManagerAvailable: false,
        });

        try {
          // Track fallback usage
          if (app.aiTracking) {
            app.aiTracking.recordFallbackUsage(
              'none',
              'No AI providers available',
              'local_generation'
            );
          }

          const fallbackDream = await fallbackHandler.handleProviderFailure(
            new Error('No AI providers available'),
            { text, style, options }
          );

          logger.info('Fallback dream generated (no providers available)', {
            structureCount: fallbackDream.structures?.length || 0,
            entityCount: fallbackDream.entities?.length || 0,
          });

          return res.json({
            success: true,
            data: fallbackDream,
            metadata: {
              source: 'fallback',
              fallbackReason: 'No AI providers available',
              processingTimeMs: Date.now() - startTime,
            },
          });
        } catch (fallbackError) {
          // Track 502 error
          if (app.aiTracking) {
            app.aiTracking.record502Error(
              'none',
              'No AI providers available and fallback failed',
              {
                fallbackError: fallbackError.message,
              }
            );
          }

          return res.status(502).json({
            success: false,
            error: 'No AI providers available and fallback failed',
            details: fallbackError.message,
          });
        }
      }
    }

    // Transform and validate response using enhanced transformer
    // The transformer handles the complete pipeline: extraction, normalization, validation, and repair
    // Pass the RAW response (aiRaw) not the parsed response to avoid double extraction
    // Error handling distinguishes between:
    // 1. Extraction failures (when extractDreamData returns null) - 502 with extraction details
    // 2. Validation failures (when validation fails) - 502 with validation errors in shared format
    // 3. Repair success (when repair fixes validation errors) - 200 with warnings
    let transformedResponse;
    let extractionFailed = false;
    let validationFailed = false;
    let extractionError = null;

    try {
      transformedResponse = await responseTransformer.transformResponse(
        aiRaw,
        source,
        {
          text,
          style,
          options,
        }
      );

      logger.info('Response transformation completed', {
        source,
        validationPassed: transformedResponse.metadata?.validationPassed,
        repairApplied: transformedResponse.metadata?.repairApplied,
        structureCount: transformedResponse.data?.structures?.length || 0,
        entityCount: transformedResponse.data?.entities?.length || 0,
      });
    } catch (transformError) {
      logger.error('Response transformation failed', {
        source,
        error: transformError.message,
        stack: transformError.stack,
      });

      // EMPTY RESPONSE: Return 502 with empty response error details
      // This occurs when provider returns null, undefined, or empty object ({})
      if (transformError.errorType === 'EMPTY_RESPONSE') {
        extractionFailed = true;
        extractionError = transformError;

        // Build empty response error with error ID
        const errorResponse = errorResponseBuilder.buildEmptyResponseError(
          source,
          aiRaw
        );

        logger.error('Empty response detected - returning 502', {
          errorId: errorResponse.errorId,
          provider: source,
          responseType: typeof aiRaw,
        });

        // Track 502 error separately for empty responses
        if (app.aiTracking) {
          app.aiTracking.record502Error(
            source,
            'Empty response from provider',
            {
              errorId: errorResponse.errorId,
              responseType: typeof aiRaw,
            }
          );
        }

        return res.status(502).json(errorResponse);
      }

      // EXTRACTION FAILURE: Return 502 with extraction error details
      // This occurs when extractDreamData returns null (no pattern matched)
      if (transformError.message.includes('Failed to extract dream data')) {
        extractionFailed = true;
        extractionError = transformError;

        // Get extraction metrics from transformer
        const extractionMetrics =
          responseTransformer.contentExtractor.getExtractionMetrics();
        const attemptedPatterns =
          errorResponseBuilder.extractAttemptedPatterns(extractionMetrics);

        // Build extraction error response with error ID
        const errorResponse = errorResponseBuilder.buildExtractionErrorResponse(
          source,
          aiRaw,
          attemptedPatterns
        );

        logger.error('Extraction failure detected - returning 502', {
          errorId: errorResponse.errorId,
          provider: source,
          patternsAttempted: attemptedPatterns.length,
        });

        // Track 502 error
        if (app.aiTracking) {
          app.aiTracking.record502Error(
            source,
            'Extraction failure - no pattern matched',
            {
              errorId: errorResponse.errorId,
              patternsAttempted: attemptedPatterns.length,
            }
          );
        }

        return res.status(502).json(errorResponse);
      }

      // For other transformation errors, try to use fallback handler
      logger.warn('Transformation error, attempting fallback', {
        source,
        error: transformError.message,
      });

      try {
        const fallbackDream = await fallbackHandler.handleProviderFailure(
          transformError,
          { text, style, options }
        );

        logger.info('Fallback dream generated (transformation failure)', {
          structureCount: fallbackDream.structures?.length || 0,
          entityCount: fallbackDream.entities?.length || 0,
        });

        return res.json({
          success: true,
          data: fallbackDream,
          metadata: {
            source: 'fallback',
            fallbackReason: 'Transformation failure',
            originalProvider: source,
            processingTimeMs: Date.now() - startTime,
          },
        });
      } catch (fallbackError) {
        return res.status(502).json({
          success: false,
          error: 'Failed to transform AI response and fallback failed',
          details: transformError.message,
        });
      }
    }

    // VALIDATION FAILURE: Return 502 with validation errors in shared format
    // Validate before sending to Express service
    const sendValidation =
      responseTransformer.validateBeforeSending(transformedResponse);

    if (!sendValidation.valid && process.env.STRICT_VALIDATION !== 'false') {
      validationFailed = true;

      logger.error('Response validation failed before sending', {
        source,
        errorCount: sendValidation.errorCount,
        errors: sendValidation.errors.slice(0, 5),
      });

      // Build validation error response using shared format with error ID
      const errorResponse = errorResponseBuilder.buildValidationErrorResponse(
        sendValidation,
        source
      );

      logger.error('Validation failure detected - returning 502', {
        errorId: errorResponse.errorId,
        provider: source,
        errorCount: errorResponse.errorCount,
        criticalCount: errorResponse.criticalCount || 0,
      });

      // Track 502 error
      if (app.aiTracking) {
        app.aiTracking.record502Error(source, 'Validation failure', {
          errorId: errorResponse.errorId,
          errorCount: errorResponse.errorCount,
          criticalCount: errorResponse.criticalCount || 0,
        });
      }

      return res.status(502).json(errorResponse);
    }

    // Use transformed data for further processing
    const finalParsed = transformedResponse.data;

    // Attach initial metadata with enhanced provider information
    finalParsed.metadata = {
      ...(finalParsed.metadata || {}),
      ...(transformedResponse.metadata || {}),
      generatedAt: new Date().toISOString(),
      source,
      processingTimeMs: Date.now() - startTime,
      originalText: text,
      requestedStyle: style,
      options,
      provider: {
        name: source,
        responseTime: providerMetadata?.responseTime || 0,
        tokens: providerMetadata?.tokens || {},
        attempts: providerMetadata?.attempts || 1,
        managedByProviderManager: !!providerManager,
        contextPreserved: providerMetadata?.context?.previousProvider
          ? true
          : false,
      },
    };

    // Enhanced validation and repair pipeline
    let finalContent = finalParsed;
    let validationResult = null;
    let repairResult = null;

    try {
      const validationStart = Date.now();

      // Run validation and repair pipeline
      const pipelineResult = await validationPipeline.validateAndRepair(
        finalParsed,
        'dreamResponse',
        {
          originalPrompt: text,
          provider: source,
          style: style,
        }
      );

      validationResult = pipelineResult.validation;
      repairResult = pipelineResult.repair;
      finalContent = pipelineResult.finalContent;

      // Add validation metadata
      finalContent.metadata = {
        ...finalContent.metadata,
        validation: {
          valid: pipelineResult.success,
          errorsFound: validationResult?.errors?.length || 0,
          warningsFound: validationResult?.warnings?.length || 0,
          repairApplied: !!repairResult,
          repairStrategies: repairResult?.appliedStrategies?.length || 0,
          validationTime: Date.now() - validationStart,
        },
      };

      logger.info('Content validation and repair completed', {
        source,
        initiallyValid: validationResult?.valid || false,
        repairApplied: !!repairResult,
        finalValid: pipelineResult.success,
        errorsFixed: repairResult
          ? (validationResult?.errors?.length || 0) -
            (repairResult.remainingErrors?.length || 0)
          : 0,
      });
    } catch (validationError) {
      logger.error('Validation and repair pipeline failed', {
        error: validationError.message,
        source,
      });

      // Continue with original content if validation fails
      finalContent.metadata = {
        ...finalContent.metadata,
        validation: {
          valid: false,
          error: validationError.message,
          repairApplied: false,
        },
      };
    }

    const totalTime = Date.now() - startTime;

    // Cache the response if caching is available
    if (cacheService && cacheService.isAvailable()) {
      try {
        await cacheService.cacheDreamResponse(text, finalContent, {
          style,
          quality: options.quality || 'standard',
          provider: source,
          ...options,
        });
        logger.debug('Response cached successfully');
      } catch (cacheError) {
        logger.warn('Failed to cache response:', cacheError.message);
      }
    }

    // Final check: ensure response is complete before sending
    try {
      finalContent = await fallbackHandler.ensureCompleteResponse(
        finalContent,
        {
          text,
          style,
          options,
        }
      );
    } catch (ensureError) {
      logger.error('Failed to ensure complete response', {
        error: ensureError.message,
      });
    }

    logger.info('Dream parse completed', {
      source,
      processingTimeMs: totalTime,
      style,
      success: true,
      validationApplied: !!validationResult,
      repairApplied: !!repairResult,
      cached: cacheService?.isAvailable() || false,
      structureCount: finalContent.structures?.length || 0,
      entityCount: finalContent.entities?.length || 0,
    });

    // Build appropriate response based on whether repair was applied
    let finalResponse;

    // REPAIR SUCCESS: Return 200 with metadata when repair is successful
    if (repairResult && repairResult.appliedStrategies?.length > 0) {
      // Repair was applied - return 200 with warnings and metadata
      const warnings = [];

      if (validationResult?.errors?.length > 0) {
        warnings.push({
          type: 'VALIDATION_ERRORS_REPAIRED',
          message: `${validationResult.errors.length} validation errors were automatically repaired`,
          details: validationResult.errors.slice(0, 5), // Include first 5 errors
        });
      }

      if (repairResult.remainingErrors?.length > 0) {
        warnings.push({
          type: 'PARTIAL_REPAIR',
          message: `${repairResult.remainingErrors.length} errors could not be automatically repaired`,
          details: repairResult.remainingErrors.slice(0, 3),
        });
      }

      // Build success response with warnings using ErrorResponseBuilder
      // Includes error ID for tracking and metadata about repair
      finalResponse = errorResponseBuilder.buildSuccessWithWarningsResponse(
        finalContent,
        warnings,
        {
          source,
          processingTimeMs: totalTime,
          cacheHit: false,
          validation: finalContent.metadata?.validation,
          strategiesApplied: repairResult.appliedStrategies,
          errorsRepaired:
            (validationResult?.errors?.length || 0) -
            (repairResult.remainingErrors?.length || 0),
        },
        source
      );

      logger.info('Returning success response with repair warnings', {
        source,
        warningCount: warnings.length,
        strategiesApplied: repairResult.appliedStrategies.length,
        errorId: finalResponse.metadata?.errorId,
      });
    } else {
      // No repair needed - return standard success response
      finalResponse = errorResponseBuilder.buildSuccessResponse(finalContent, {
        source,
        processingTimeMs: totalTime,
        cacheHit: false,
        validation: finalContent.metadata?.validation,
      });
    }

    res.json(finalResponse);
  })
);

// Patch endpoint - modify a scene JSON with an edit instruction
app.post('/patch', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { baseJson, editText, options = {} } = req.body;

    if (!baseJson || typeof baseJson !== 'object') {
      return res
        .status(400)
        .json({ success: false, error: 'baseJson required' });
    }
    if (!editText || typeof editText !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'editText required' });
    }

    const prompt = promptBuilder.buildPatchPrompt(baseJson, editText, options);

    let aiRaw = null;
    let source = null;
    let providerMetadata = null;

    // Use ProviderManager for patch operations
    if (providerManager) {
      try {
        const result = await providerManager.executeWithFallback(
          async (provider, providerName, context) => {
            logger.info(`Patching dream with provider: ${providerName}`);

            const providerStart = Date.now();
            const response = await provider.patchDream(prompt, baseJson, {
              ...options,
              context: context,
            });
            const responseTime = Date.now() - providerStart;

            return {
              content: response,
              provider: providerName,
              responseTime,
              context,
            };
          },
          null, // Use automatic provider selection
          {
            maxAttempts: 3,
            timeout: options.timeout || 20000,
            preserveContext: true,
            operationType: 'patchDream',
            context: {
              baseJson,
              editText,
              options,
            },
          }
        );

        aiRaw = result.content;
        source = result.provider;
        providerMetadata = {
          responseTime: result.responseTime,
          attempts: result.context?.attemptNumber || 1,
        };

        logger.info('Dream patch completed via ProviderManager', {
          provider: source,
          responseTime: result.responseTime,
        });
      } catch (error) {
        logger.error('ProviderManager patch failed:', error.message);
        return res.status(502).json({
          success: false,
          error: 'AI provider patching failed',
          details: error.message,
          fallback: true,
        });
      }
    } else {
      // Fallback to legacy provider logic
      logger.warn('ProviderManager not available, using legacy patch logic');

      if (process.env.CEREBRAS_API_KEY) {
        try {
          const cerebrasStart = Date.now();
          aiRaw = await cerebrasService.patchDream(prompt, baseJson, options);
          source = 'cerebras';
          providerMetadata = { responseTime: Date.now() - cerebrasStart };
        } catch (err) {
          console.warn('Cerebras patch failed:', err.message);
        }
      }

      if (!aiRaw && process.env.OPENAI_API_KEY) {
        try {
          const openaiStart = Date.now();
          aiRaw = await openaiService.patchDream(prompt, baseJson, options);
          source = 'openai';
          providerMetadata = { responseTime: Date.now() - openaiStart };
        } catch (err) {
          console.warn('OpenAI patch failed:', err.message);
        }
      }

      if (!aiRaw) {
        return res.status(502).json({
          success: false,
          error: 'No AI providers available for patching',
          fallback: true,
        });
      }
    }

    const patched = responseParser.parsePatchResponse(aiRaw, baseJson, source);

    if (!patched) {
      return res.status(502).json({
        success: false,
        error: 'Failed to parse AI patch response',
        fallback: true,
      });
    }

    patched.metadata = {
      ...(patched.metadata || {}),
      patchedAt: new Date().toISOString(),
      source,
      processingTimeMs: Date.now() - startTime,
      editText,
      provider: {
        name: source,
        responseTime: providerMetadata?.responseTime || 0,
        attempts: providerMetadata?.attempts || 1,
        managedByProviderManager: !!providerManager,
      },
    };

    res.json({
      success: true,
      data: patched,
      metadata: {
        source,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Style enrichment endpoint - ask AI to "enrich" or convert to a style
app.post('/style-enrich', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { baseJson, targetStyle, options = {} } = req.body;

    if (!baseJson || typeof baseJson !== 'object') {
      return res
        .status(400)
        .json({ success: false, error: 'baseJson required' });
    }

    const style = targetStyle || baseJson.style || 'ethereal';
    const prompt = promptBuilder.buildStyleEnrichmentPrompt(
      baseJson,
      style,
      options
    );

    let aiRaw = null;
    let source = null;
    let providerMetadata = null;

    // Use ProviderManager for style enrichment
    if (providerManager) {
      try {
        const result = await providerManager.executeWithFallback(
          async (provider, providerName, context) => {
            logger.info(`Enriching style with provider: ${providerName}`, {
              targetStyle: style,
            });

            const providerStart = Date.now();
            const response = await provider.enrichStyle(prompt, baseJson, {
              ...options,
              context: context,
            });
            const responseTime = Date.now() - providerStart;

            return {
              content: response,
              provider: providerName,
              responseTime,
              context,
            };
          },
          null, // Use automatic provider selection
          {
            maxAttempts: 3,
            timeout: options.timeout || 20000,
            preserveContext: true,
            operationType: 'enrichStyle',
            context: {
              baseJson,
              targetStyle: style,
              options,
            },
          }
        );

        aiRaw = result.content;
        source = result.provider;
        providerMetadata = {
          responseTime: result.responseTime,
          attempts: result.context?.attemptNumber || 1,
        };

        logger.info('Style enrichment completed via ProviderManager', {
          provider: source,
          responseTime: result.responseTime,
          targetStyle: style,
        });
      } catch (error) {
        logger.error('ProviderManager style enrichment failed:', error.message);
        return res.status(502).json({
          success: false,
          error: 'AI provider style enrichment failed',
          details: error.message,
          fallback: true,
        });
      }
    } else {
      // Fallback to legacy provider logic
      logger.warn(
        'ProviderManager not available, using legacy style enrichment logic'
      );

      if (process.env.CEREBRAS_API_KEY) {
        try {
          const cerebrasStart = Date.now();
          aiRaw = await cerebrasService.enrichStyle(prompt, baseJson, options);
          source = 'cerebras';
          providerMetadata = { responseTime: Date.now() - cerebrasStart };
        } catch (err) {
          console.warn('Cerebras style enrich failed:', err.message);
        }
      }

      if (!aiRaw && process.env.OPENAI_API_KEY) {
        try {
          const openaiStart = Date.now();
          aiRaw = await openaiService.enrichStyle(prompt, baseJson, options);
          source = 'openai';
          providerMetadata = { responseTime: Date.now() - openaiStart };
        } catch (err) {
          console.warn('OpenAI style enrich failed:', err.message);
        }
      }

      if (!aiRaw) {
        return res.status(502).json({
          success: false,
          error: 'No AI providers available for style enrichment',
          fallback: true,
        });
      }
    }

    const enriched = responseParser.parseStyleResponse(aiRaw, baseJson, source);

    if (!enriched) {
      return res.status(502).json({
        success: false,
        error: 'Failed to parse style enrichment response',
        fallback: true,
      });
    }

    enriched.metadata = {
      ...(enriched.metadata || {}),
      enrichedAt: new Date().toISOString(),
      source,
      processingTimeMs: Date.now() - startTime,
      targetStyle: style,
      provider: {
        name: source,
        responseTime: providerMetadata?.responseTime || 0,
        attempts: providerMetadata?.attempts || 1,
        managedByProviderManager: !!providerManager,
      },
    };

    res.json({
      success: true,
      data: enriched,
      metadata: {
        source,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      '/parse',
      '/patch',
      '/style-enrich',
      '/health',
      '/status',
      '/providers/*',
      '/streaming/*',
      '/cache/*',
      '/quality/*',
    ],
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop monitoring system
  if (monitoringMiddleware) {
    await monitoringMiddleware.destroy();
  }

  // Stop provider manager
  if (providerManager) {
    providerManager.stopHealthMonitoring();
  }

  if (cacheService) {
    await cacheService.cleanup();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  // Stop monitoring system
  if (monitoringMiddleware) {
    await monitoringMiddleware.destroy();
  }

  // Stop provider manager
  if (providerManager) {
    providerManager.stopHealthMonitoring();
  }

  if (cacheService) {
    await cacheService.cleanup();
  }

  process.exit(0);
});

// Unhandled error logging
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

const server = app.listen(PORT, async () => {
  logger.info('🌐 MCP Gateway started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    cerebrasConfigured: !!process.env.CEREBRAS_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    llamaUrl: process.env.LLAMA_URL || 'not configured',
    performanceOptimization: performanceConfig.enableAutomaticOptimization,
    endpoints: {
      health: '/health',
      status: '/status',
      performance: '/performance/metrics',
      optimization: '/performance/optimization',
    },
  });

  // Initialize performance system first
  try {
    await initializePerformanceSystem();
    logger.info('⚡ Performance optimization system initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize performance system:', error.message);
    logger.warn('Continuing without performance optimization');
  }

  // Initialize ProviderManager
  try {
    await initializeProviderManager();

    // Make providerManager available to routes
    app.locals.providerManager = providerManager;

    // Integrate extraction metrics collector with alerting system
    if (providerManager && providerManager.alertingSystem) {
      extractionMetricsCollector.setAlertingSystem(
        providerManager.alertingSystem
      );
      logger.info(
        '✅ ExtractionMetricsCollector integrated with AlertingSystem'
      );
    }

    logger.info('✅ Enhanced ProviderManager initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize ProviderManager:', error.message);
    logger.warn('Continuing with legacy provider logic');
    app.locals.providerManager = null;
  }

  // Make extraction metrics collector available to routes
  app.locals.extractionMetricsCollector = extractionMetricsCollector;

  // Initialize cache service after server starts
  await initializeCacheService();

  // Initialize monitoring system
  try {
    await monitoringMiddleware.setup(app, {
      providerManager: providerManager, // Use real ProviderManager instead of mock
    });

    logger.info('🔍 Enhanced monitoring system initialized', {
      healthEndpoint: '/monitoring/health',
      metricsEndpoint: '/monitoring/metrics',
      alertsEndpoint: '/monitoring/alerts',
      dashboardEndpoint: '/monitoring/dashboard',
      webDashboard: monitoringConfig.monitoring.dashboard.enableWebInterface
        ? `http://localhost:${monitoringConfig.monitoring.dashboard.webPort}`
        : 'disabled',
      providerManagerIntegrated: !!providerManager,
    });
  } catch (error) {
    logger.error('Failed to initialize monitoring system', {
      error: error.message,
    });
  }

  logger.info('🚀 All systems initialized - MCP Gateway ready for requests');
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    // Shutdown performance middleware
    if (performanceMiddlewareInitialized) {
      await performanceMiddleware.shutdown();
      logger.info('Performance middleware shutdown complete');
    }

    // Shutdown provider manager
    if (providerManager) {
      // Add any provider manager shutdown logic here
      logger.info('Provider manager shutdown complete');
    }

    // Shutdown cache service
    if (cacheService) {
      // Add any cache service shutdown logic here
      logger.info('Cache service shutdown complete');
    }

    // Close server
    server.close(() => {
      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
