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

// Import enhanced validation and repair system
const { ValidationPipeline } = require('./engine');

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
          model:
            process.env.CEREBRAS_MODEL || 'llama-4-maverick-17b-128e-instruct',
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
  asyncHandler(async (req, res, next) => {
    const startTime = Date.now();
    const { text, style = 'ethereal', options = {} } = req.body;

    logger.info('Dream parse request', {
      textLength: text?.length || 0,
      style,
      hasOptions: Object.keys(options).length > 0,
    });

    // Basic validation (more complex checks happen downstream)
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.warn('Invalid parse request: missing or empty text');
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

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
    const prompt = promptBuilder.buildDreamParsePrompt(text, style, options);

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
                    model:
                      providerName === 'cerebras'
                        ? 'llama-4-maverick-17b'
                        : 'gpt-4',
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
                    model:
                      providerName === 'cerebras'
                        ? 'llama-4-maverick-17b'
                        : 'gpt-4',
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

              // Ensure we return consistent content format
              const finalContent =
                responseParser.extractContentSafely(response, providerName) ||
                response;
              const finalContentLength =
                typeof finalContent === 'string' ? finalContent.length : 0;

              return {
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

        aiRaw = result.content;
        source = result.provider;
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

        // Return appropriate error response
        return res.status(502).json({
          success: false,
          error: 'AI provider generation failed',
          details: error.message,
          fallback: true,
          providerManager: {
            used: true,
            error: error.message,
          },
        });
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

      // If still nothing, return a failure
      if (!aiRaw) {
        logger.error('No AI providers available for dream generation', {
          cerebrasConfigured: !!process.env.CEREBRAS_API_KEY,
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          providerManagerAvailable: false,
        });
        return res.status(502).json({
          success: false,
          error: 'No AI providers available',
          fallback: true,
          providerManager: {
            used: false,
            reason: 'not_initialized',
          },
        });
      }
    }

    // Parse AI response to scene JSON
    const parsed = responseParser.parseDreamResponse(aiRaw, source);

    if (!parsed) {
      logger.error('Failed to parse AI response', {
        source,
        responseLength: aiRaw?.length || 0,
      });
      return res.status(502).json({
        success: false,
        error: 'Failed to parse AI response',
        fallback: true,
      });
    }

    // Attach initial metadata with enhanced provider information
    parsed.metadata = {
      ...(parsed.metadata || {}),
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
    let finalContent = parsed;
    let validationResult = null;
    let repairResult = null;

    try {
      const validationStart = Date.now();

      // Run validation and repair pipeline
      const pipelineResult = await validationPipeline.validateAndRepair(
        parsed,
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

    logger.info('Dream parse completed', {
      source,
      processingTimeMs: totalTime,
      style,
      success: true,
      validationApplied: !!validationResult,
      repairApplied: !!repairResult,
      cached: cacheService?.isAvailable() || false,
    });

    res.json({
      success: true,
      data: finalContent,
      metadata: {
        source,
        processingTimeMs: totalTime,
        cacheHit: false,
        validation: finalContent.metadata?.validation,
      },
    });
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
app.use('*', (req, res) => {
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

    logger.info('✅ Enhanced ProviderManager initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize ProviderManager:', error.message);
    logger.warn('Continuing with legacy provider logic');
    app.locals.providerManager = null;
  }

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
