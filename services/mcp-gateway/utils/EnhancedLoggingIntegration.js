// utils/EnhancedLoggingIntegration.js
// Comprehensive logging integration system that coordinates all logging components

const ErrorLoggingIntegration = require('./ErrorLoggingIntegration');
const StructuredLogger = require('../monitoring/StructuredLogger');
const { logger } = require('./logger');

/**
 * Enhanced Logging Integration - Master coordinator for all logging systems
 */
class EnhancedLoggingIntegration {
  constructor(config = {}) {
    this.config = {
      // Component enablement
      enableErrorLogging: config.enableErrorLogging !== false,
      enableStructuredLogging: config.enableStructuredLogging !== false,
      enablePerformanceLogging: config.enablePerformanceLogging !== false,
      enableRequestLogging: config.enableRequestLogging !== false,
      enableAIRequestLogging: config.enableAIRequestLogging !== false,

      // Logging levels and targets
      logLevel: config.logLevel || 'info',
      enableConsoleLogging: config.enableConsoleLogging !== false,
      enableFileLogging: config.enableFileLogging !== false,
      enableRemoteLogging: config.enableRemoteLogging === true,

      // Performance thresholds
      performanceThresholds: {
        slowRequest: config.slowRequestThreshold || 5000, // 5 seconds
        verySlowRequest: config.verySlowRequestThreshold || 10000, // 10 seconds
        slowAIRequest: config.slowAIRequestThreshold || 15000, // 15 seconds
        verySlowAIRequest: config.verySlowAIRequestThreshold || 30000, // 30 seconds
      },

      // Request tracking
      requestTracking: {
        enableFullRequestLogging: config.enableFullRequestLogging === true,
        enableResponseLogging: config.enableResponseLogging === true,
        maxRequestBodySize: config.maxRequestBodySize || 1024, // 1KB
        maxResponseBodySize: config.maxResponseBodySize || 2048, // 2KB
        sensitiveFields: config.sensitiveFields || [
          'password',
          'token',
          'key',
          'secret',
        ],
      },

      // AI request tracking
      aiRequestTracking: {
        enablePromptLogging: config.enablePromptLogging === true,
        enableResponseLogging: config.enableResponseLogging !== false,
        maxPromptSize: config.maxPromptSize || 500, // 500 chars
        maxResponseSize: config.maxResponseSize || 1000, // 1000 chars
        trackTokenUsage: config.trackTokenUsage !== false,
      },

      // Error logging configuration
      errorLogging: config.errorLogging || {},

      // Structured logging configuration
      structuredLogging: config.structuredLogging || {},

      ...config,
    };

    // Initialize components
    this.errorLoggingIntegration = null;
    this.structuredLogger = null;
    this.requestTracker = new Map(); // requestId -> request data
    this.aiRequestTracker = new Map(); // aiRequestId -> AI request data
    this.performanceMetrics = new Map(); // endpoint -> performance data

    this.isInitialized = false;
    this.requestSequence = 0;
    this.aiRequestSequence = 0;

    logger.info('EnhancedLoggingIntegration initialized', {
      config: {
        enableErrorLogging: this.config.enableErrorLogging,
        enableStructuredLogging: this.config.enableStructuredLogging,
        enablePerformanceLogging: this.config.enablePerformanceLogging,
        logLevel: this.config.logLevel,
      },
    });
  }

  /**
   * Initialize all logging components
   * @param {Object} dependencies - Required dependencies
   */
  async initialize(dependencies = {}) {
    if (this.isInitialized) {
      logger.warn('EnhancedLoggingIntegration already initialized');
      return;
    }

    try {
      // Initialize Error Logging Integration
      if (this.config.enableErrorLogging) {
        this.errorLoggingIntegration = new ErrorLoggingIntegration(
          this.config.errorLogging
        );
        await this.errorLoggingIntegration.initialize(dependencies);
        logger.info('Error logging integration initialized');
      }

      // Initialize Structured Logger
      if (this.config.enableStructuredLogging) {
        this.structuredLogger = new StructuredLogger({
          level: this.config.logLevel,
          enableConsole: this.config.enableConsoleLogging,
          enableFile: this.config.enableFileLogging,
          enableRemote: this.config.enableRemoteLogging,
          ...this.config.structuredLogging,
        });
        logger.info('Structured logger initialized');
      }

      // Setup middleware integration
      this.setupMiddlewareIntegration(dependencies);

      this.isInitialized = true;
      logger.info('EnhancedLoggingIntegration fully initialized');
    } catch (error) {
      logger.error('Failed to initialize EnhancedLoggingIntegration:', error);
      throw error;
    }
  }

  /**
   * Setup middleware integration for request/response logging
   * @private
   */
  setupMiddlewareIntegration(dependencies) {
    const { app } = dependencies;

    if (app && this.config.enableRequestLogging) {
      // Add request logging middleware
      app.use((req, res, next) => {
        this.startRequestLogging(req, res);
        next();
      });

      logger.info('Request logging middleware integrated');
    }
  }

  /**
   * Start request logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  startRequestLogging(req, res) {
    const requestId = `req_${++this.requestSequence}_${Date.now()}`;
    const startTime = Date.now();

    // Create request tracking data
    const requestData = {
      id: requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: this.sanitizeHeaders(req.headers),
      body: this.sanitizeRequestBody(req.body),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      startTime,
      endTime: null,
      duration: null,
      statusCode: null,
      responseSize: null,
      error: null,
    };

    // Store request data
    this.requestTracker.set(requestId, requestData);
    req.requestId = requestId;

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = (...args) => {
      this.endRequestLogging(requestId, res, args);
      originalEnd.apply(res, args);
    };

    // Log request start
    if (this.structuredLogger) {
      this.structuredLogger.info('Request started', {
        requestId,
        method: req.method,
        url: req.url,
        ip: requestData.ip,
        userAgent: requestData.userAgent,
      });
    }

    logger.debug('Request logging started', {
      requestId,
      method: req.method,
      url: req.url,
    });
  }

  /**
   * End request logging
   * @private
   */
  endRequestLogging(requestId, res, responseArgs) {
    const requestData = this.requestTracker.get(requestId);
    if (!requestData) return;

    const endTime = Date.now();
    const duration = endTime - requestData.startTime;

    // Update request data
    requestData.endTime = endTime;
    requestData.duration = duration;
    requestData.statusCode = res.statusCode;
    requestData.responseSize = res.get('Content-Length') || 0;

    // Determine if request was slow
    const isSlowRequest =
      duration >= this.config.performanceThresholds.slowRequest;
    const isVerySlowRequest =
      duration >= this.config.performanceThresholds.verySlowRequest;

    // Log request completion
    const logLevel =
      res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
        ? 'warn'
        : isVerySlowRequest
        ? 'warn'
        : isSlowRequest
        ? 'info'
        : 'debug';

    const logData = {
      requestId,
      method: requestData.method,
      url: requestData.url,
      statusCode: res.statusCode,
      duration,
      responseSize: requestData.responseSize,
      isSlowRequest,
      isVerySlowRequest,
    };

    if (this.structuredLogger) {
      this.structuredLogger[logLevel]('Request completed', logData);
    }

    // Update performance metrics
    this.updatePerformanceMetrics(requestData.path, duration, res.statusCode);

    // Log performance warnings
    if (isVerySlowRequest) {
      logger.warn('Very slow request detected', logData);
    } else if (isSlowRequest) {
      logger.info('Slow request detected', logData);
    }

    // Clean up request data after some time
    setTimeout(() => {
      this.requestTracker.delete(requestId);
    }, 300000); // 5 minutes

    logger.debug('Request logging completed', {
      requestId,
      duration,
      statusCode: res.statusCode,
    });
  }

  /**
   * Start AI request logging
   * @param {string} provider - AI provider name
   * @param {string} operation - Operation type
   * @param {Object} requestData - Request parameters
   * @returns {string} AI request ID
   */
  startAIRequestLogging(provider, operation, requestData = {}) {
    if (!this.config.enableAIRequestLogging) return null;

    const aiRequestId = `ai_${++this.aiRequestSequence}_${Date.now()}`;
    const startTime = Date.now();

    // Create AI request tracking data
    const aiRequestData = {
      id: aiRequestId,
      provider,
      operation,
      model: requestData.model,
      temperature: requestData.temperature,
      maxTokens: requestData.maxTokens,
      prompt: this.sanitizePrompt(requestData.prompt),
      startTime,
      endTime: null,
      duration: null,
      success: null,
      response: null,
      tokens: {
        input: requestData.inputTokens || 0,
        output: 0,
        total: 0,
      },
      error: null,
    };

    // Store AI request data
    this.aiRequestTracker.set(aiRequestId, aiRequestData);

    // Log AI request start
    if (this.structuredLogger) {
      this.structuredLogger.info('AI request started', {
        aiRequestId,
        provider,
        operation,
        model: requestData.model,
        inputTokens: requestData.inputTokens,
      });
    }

    logger.debug('AI request logging started', {
      aiRequestId,
      provider,
      operation,
    });
    return aiRequestId;
  }

  /**
   * End AI request logging
   * @param {string} aiRequestId - AI request ID
   * @param {Object} result - Request result
   */
  endAIRequestLogging(aiRequestId, result = {}) {
    if (!aiRequestId || !this.config.enableAIRequestLogging) return;

    const aiRequestData = this.aiRequestTracker.get(aiRequestId);
    if (!aiRequestData) return;

    const endTime = Date.now();
    const duration = endTime - aiRequestData.startTime;

    // Update AI request data
    aiRequestData.endTime = endTime;
    aiRequestData.duration = duration;
    aiRequestData.success = result.success !== false;
    aiRequestData.response = this.sanitizeResponse(result.response);
    aiRequestData.tokens = {
      input: aiRequestData.tokens.input,
      output: result.tokens || 0,
      total: aiRequestData.tokens.input + (result.tokens || 0),
    };
    aiRequestData.error = result.error;

    // Determine if AI request was slow
    const isSlowAIRequest =
      duration >= this.config.performanceThresholds.slowAIRequest;
    const isVerySlowAIRequest =
      duration >= this.config.performanceThresholds.verySlowAIRequest;

    // Log AI request completion
    const logLevel = !aiRequestData.success
      ? 'error'
      : isVerySlowAIRequest
      ? 'warn'
      : isSlowAIRequest
      ? 'info'
      : 'debug';

    const logData = {
      aiRequestId,
      provider: aiRequestData.provider,
      operation: aiRequestData.operation,
      success: aiRequestData.success,
      duration,
      tokens: aiRequestData.tokens,
      isSlowAIRequest,
      isVerySlowAIRequest,
    };

    if (aiRequestData.error) {
      logData.error = aiRequestData.error;
    }

    if (this.structuredLogger) {
      this.structuredLogger[logLevel]('AI request completed', logData);
    }

    // Log performance warnings
    if (isVerySlowAIRequest) {
      logger.warn('Very slow AI request detected', logData);
    } else if (isSlowAIRequest) {
      logger.info('Slow AI request detected', logData);
    }

    // Clean up AI request data after some time
    setTimeout(() => {
      this.aiRequestTracker.delete(aiRequestId);
    }, 600000); // 10 minutes

    logger.debug('AI request logging completed', {
      aiRequestId,
      provider: aiRequestData.provider,
      duration,
      success: aiRequestData.success,
    });
  }

  /**
   * Log application error
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  logError(error, context = {}) {
    const errorData = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
    };

    // Log through error logging integration
    if (this.errorLoggingIntegration) {
      this.errorLoggingIntegration.logApplicationError(error);
    }

    // Log through structured logger
    if (this.structuredLogger) {
      this.structuredLogger.error('Application error', errorData);
    }

    logger.error('Application error logged', {
      message: error.message,
      context,
    });
  }

  /**
   * Update performance metrics for an endpoint
   * @private
   */
  updatePerformanceMetrics(endpoint, duration, statusCode) {
    if (!this.config.enablePerformanceLogging) return;

    if (!this.performanceMetrics.has(endpoint)) {
      this.performanceMetrics.set(endpoint, {
        requests: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        statusCodes: {},
        slowRequests: 0,
        verySlowRequests: 0,
      });
    }

    const metrics = this.performanceMetrics.get(endpoint);
    metrics.requests++;
    metrics.totalDuration += duration;
    metrics.avgDuration = metrics.totalDuration / metrics.requests;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);

    // Update status code counts
    metrics.statusCodes[statusCode] =
      (metrics.statusCodes[statusCode] || 0) + 1;

    // Update slow request counts
    if (duration >= this.config.performanceThresholds.verySlowRequest) {
      metrics.verySlowRequests++;
    } else if (duration >= this.config.performanceThresholds.slowRequest) {
      metrics.slowRequests++;
    }
  }

  /**
   * Sanitize request headers
   * @private
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };

    this.config.requestTracking.sensitiveFields.forEach((field) => {
      Object.keys(sanitized).forEach((key) => {
        if (key.toLowerCase().includes(field)) {
          sanitized[key] = '[REDACTED]';
        }
      });
    });

    return sanitized;
  }

  /**
   * Sanitize request body
   * @private
   */
  sanitizeRequestBody(body) {
    if (!body || !this.config.requestTracking.enableFullRequestLogging) {
      return '[BODY_NOT_LOGGED]';
    }

    let sanitized = { ...body };

    // Remove sensitive fields
    this.config.requestTracking.sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Truncate if too large
    const bodyString = JSON.stringify(sanitized);
    if (bodyString.length > this.config.requestTracking.maxRequestBodySize) {
      return (
        bodyString.substring(
          0,
          this.config.requestTracking.maxRequestBodySize
        ) + '[TRUNCATED]'
      );
    }

    return sanitized;
  }

  /**
   * Sanitize AI prompt
   * @private
   */
  sanitizePrompt(prompt) {
    if (!prompt || !this.config.aiRequestTracking.enablePromptLogging) {
      return '[PROMPT_NOT_LOGGED]';
    }

    if (
      typeof prompt === 'string' &&
      prompt.length > this.config.aiRequestTracking.maxPromptSize
    ) {
      return (
        prompt.substring(0, this.config.aiRequestTracking.maxPromptSize) +
        '[TRUNCATED]'
      );
    }

    return prompt;
  }

  /**
   * Sanitize AI response
   * @private
   */
  sanitizeResponse(response) {
    if (!response || !this.config.aiRequestTracking.enableResponseLogging) {
      return '[RESPONSE_NOT_LOGGED]';
    }

    if (
      typeof response === 'string' &&
      response.length > this.config.aiRequestTracking.maxResponseSize
    ) {
      return (
        response.substring(0, this.config.aiRequestTracking.maxResponseSize) +
        '[TRUNCATED]'
      );
    }

    return response;
  }

  /**
   * Get performance metrics for all endpoints
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    const metrics = {};

    for (const [endpoint, data] of this.performanceMetrics.entries()) {
      metrics[endpoint] = { ...data };
    }

    return {
      timestamp: new Date(),
      endpoints: metrics,
      summary: {
        totalEndpoints: this.performanceMetrics.size,
        totalRequests: Array.from(this.performanceMetrics.values()).reduce(
          (sum, m) => sum + m.requests,
          0
        ),
        avgResponseTime: this.calculateOverallAvgResponseTime(),
      },
    };
  }

  /**
   * Calculate overall average response time
   * @private
   */
  calculateOverallAvgResponseTime() {
    let totalDuration = 0;
    let totalRequests = 0;

    for (const metrics of this.performanceMetrics.values()) {
      totalDuration += metrics.totalDuration;
      totalRequests += metrics.requests;
    }

    return totalRequests > 0 ? totalDuration / totalRequests : 0;
  }

  /**
   * Get comprehensive logging report
   * @returns {Object} Logging report
   */
  getLoggingReport() {
    const report = {
      timestamp: new Date(),
      configuration: {
        enableErrorLogging: this.config.enableErrorLogging,
        enableStructuredLogging: this.config.enableStructuredLogging,
        enablePerformanceLogging: this.config.enablePerformanceLogging,
        enableRequestLogging: this.config.enableRequestLogging,
        enableAIRequestLogging: this.config.enableAIRequestLogging,
        logLevel: this.config.logLevel,
      },
      statistics: {
        activeRequests: this.requestTracker.size,
        activeAIRequests: this.aiRequestTracker.size,
        trackedEndpoints: this.performanceMetrics.size,
      },
      performance: this.getPerformanceMetrics(),
    };

    // Add error statistics if available
    if (this.errorLoggingIntegration) {
      report.errors = this.errorLoggingIntegration.getErrorReport();
    }

    return report;
  }

  /**
   * Cleanup old tracking data
   */
  cleanup() {
    const now = Date.now();
    const requestTimeout = 600000; // 10 minutes
    const aiRequestTimeout = 1800000; // 30 minutes

    // Clean up old request tracking data
    for (const [requestId, requestData] of this.requestTracker.entries()) {
      if (now - requestData.startTime > requestTimeout) {
        this.requestTracker.delete(requestId);
      }
    }

    // Clean up old AI request tracking data
    for (const [
      aiRequestId,
      aiRequestData,
    ] of this.aiRequestTracker.entries()) {
      if (now - aiRequestData.startTime > aiRequestTimeout) {
        this.aiRequestTracker.delete(aiRequestId);
      }
    }

    // Cleanup error logging integration
    if (this.errorLoggingIntegration) {
      this.errorLoggingIntegration.cleanup();
    }

    logger.debug('Enhanced logging integration cleanup completed', {
      activeRequests: this.requestTracker.size,
      activeAIRequests: this.aiRequestTracker.size,
    });
  }

  /**
   * Destroy the integration and cleanup resources
   */
  destroy() {
    // Destroy error logging integration
    if (this.errorLoggingIntegration) {
      this.errorLoggingIntegration.destroy();
    }

    // Clear tracking data
    this.requestTracker.clear();
    this.aiRequestTracker.clear();
    this.performanceMetrics.clear();

    this.isInitialized = false;
    logger.info('EnhancedLoggingIntegration destroyed');
  }
}

module.exports = EnhancedLoggingIntegration;
