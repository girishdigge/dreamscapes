// monitoring/StructuredLogger.js
// Enhanced structured logging system for comprehensive debugging

const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Structured Logger - Enhanced logging with structured data for debugging
 */
class StructuredLogger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'info',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      enableStructuredData: config.enableStructuredData !== false,

      // File logging configuration
      logDirectory: config.logDirectory || 'logs',
      maxFileSize: config.maxFileSize || 10485760, // 10MB
      maxFiles: config.maxFiles || 5,

      // Structured data configuration
      includeTimestamp: config.includeTimestamp !== false,
      includeLevel: config.includeLevel !== false,
      includeMetadata: config.includeMetadata !== false,
      includeStackTrace: config.includeStackTrace !== false,

      // Performance logging
      enablePerformanceLogging: config.enablePerformanceLogging !== false,
      performanceThreshold: config.performanceThreshold || 1000, // 1 second

      // Request/Response logging
      enableRequestLogging: config.enableRequestLogging !== false,
      enableResponseLogging: config.enableResponseLogging !== false,
      maxBodySize: config.maxBodySize || 1024, // 1KB for request/response bodies

      // Error logging
      enableErrorDetails: config.enableErrorDetails !== false,
      enableErrorContext: config.enableErrorContext !== false,

      ...config,
    };

    // Ensure log directory exists
    this.ensureLogDirectory();

    // Create Winston logger instance
    this.logger = this.createLogger();

    // Request tracking
    this.activeRequests = new Map();
    this.requestSequence = 0;

    // Performance tracking
    this.performanceMetrics = new Map();

    // Error tracking
    this.errorHistory = [];
    this.maxErrorHistory = 1000;

    console.log('StructuredLogger initialized', { config: this.config });
  }

  /**
   * Ensure log directory exists
   * @private
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  /**
   * Create Winston logger instance
   * @private
   */
  createLogger() {
    const transports = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: this.config.level,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr =
                Object.keys(meta).length > 0
                  ? `\n${JSON.stringify(meta, null, 2)}`
                  : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // File transports
    if (this.config.enableFile) {
      // General log file
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'structured.log'),
          level: this.config.level,
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Error-specific log file
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'errors.log'),
          level: 'error',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Performance log file
      if (this.config.enablePerformanceLogging) {
        transports.push(
          new winston.transports.File({
            filename: path.join(this.config.logDirectory, 'performance.log'),
            level: 'info',
            maxsize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            ),
          })
        );
      }

      // Request/Response log file
      if (this.config.enableRequestLogging) {
        transports.push(
          new winston.transports.File({
            filename: path.join(this.config.logDirectory, 'requests.log'),
            level: 'info',
            maxsize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            ),
          })
        );
      }
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
      exitOnError: false,
    });
  }

  /**
   * Log with structured data
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Structured data
   * @param {Object} context - Additional context
   */
  log(level, message, data = {}, context = {}) {
    const logEntry = {
      message,
      level,
      timestamp: new Date().toISOString(),
      ...data,
    };

    // Add context if enabled
    if (this.config.includeMetadata && Object.keys(context).length > 0) {
      logEntry.context = context;
    }

    // Add system information
    if (this.config.includeMetadata) {
      logEntry.system = {
        hostname: require('os').hostname(),
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      };
    }

    this.logger.log(level, logEntry);
  }

  /**
   * Log info message with structured data
   */
  info(message, data = {}, context = {}) {
    this.log('info', message, data, context);
  }

  /**
   * Log warning message with structured data
   */
  warn(message, data = {}, context = {}) {
    this.log('warn', message, data, context);
  }

  /**
   * Log error message with structured data
   */
  error(message, error = null, data = {}, context = {}) {
    const errorData = { ...data };

    if (error) {
      errorData.error = {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status || error.response?.status,
      };

      if (this.config.includeStackTrace && error.stack) {
        errorData.error.stack = error.stack;
      }

      if (this.config.enableErrorContext && error.context) {
        errorData.error.context = error.context;
      }

      // Track error in history
      this.trackError(error, context);
    }

    this.log('error', message, errorData, context);
  }

  /**
   * Log debug message with structured data
   */
  debug(message, data = {}, context = {}) {
    this.log('debug', message, data, context);
  }

  /**
   * Start request logging
   * @param {Object} req - Express request object
   * @returns {string} Request ID
   */
  startRequest(req) {
    if (!this.config.enableRequestLogging) return null;

    const requestId = `req_${++this.requestSequence}_${Date.now()}`;
    const startTime = Date.now();

    const requestData = {
      id: requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: this.sanitizeHeaders(req.headers),
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      startTime,
      body: this.sanitizeBody(req.body),
    };

    // Store active request
    this.activeRequests.set(requestId, requestData);

    // Log request start
    this.logger.info('Request started', {
      type: 'request',
      phase: 'start',
      requestId,
      method: req.method,
      url: req.url,
      ip: requestData.ip,
      userAgent: requestData.userAgent,
      timestamp: new Date().toISOString(),
    });

    return requestId;
  }

  /**
   * End request logging
   * @param {string} requestId - Request ID
   * @param {Object} res - Express response object
   * @param {Object} additionalData - Additional data to log
   */
  endRequest(requestId, res, additionalData = {}) {
    if (!this.config.enableRequestLogging || !requestId) return;

    const requestData = this.activeRequests.get(requestId);
    if (!requestData) return;

    const endTime = Date.now();
    const duration = endTime - requestData.startTime;

    const responseData = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: this.sanitizeHeaders(res.getHeaders()),
      duration,
      ...additionalData,
    };

    // Log request completion
    this.logger.info('Request completed', {
      type: 'response',
      phase: 'end',
      requestId,
      method: requestData.method,
      url: requestData.url,
      statusCode: res.statusCode,
      duration,
      success: res.statusCode < 400,
      timestamp: new Date().toISOString(),
      request: {
        method: requestData.method,
        url: requestData.url,
        query: requestData.query,
        ip: requestData.ip,
      },
      response: responseData,
    });

    // Track performance if enabled
    if (this.config.enablePerformanceLogging) {
      this.trackPerformance('http_request', duration, {
        method: requestData.method,
        url: requestData.url,
        statusCode: res.statusCode,
      });
    }

    // Remove from active requests
    this.activeRequests.delete(requestId);
  }

  /**
   * Log AI provider request
   * @param {string} provider - Provider name
   * @param {string} operation - Operation name
   * @param {Object} requestData - Request data
   * @returns {string} Request ID
   */
  startAIRequest(provider, operation, requestData = {}) {
    const requestId = `ai_${provider}_${++this.requestSequence}_${Date.now()}`;
    const startTime = Date.now();

    const logData = {
      type: 'ai_request',
      phase: 'start',
      requestId,
      provider,
      operation,
      startTime,
      model: requestData.model,
      temperature: requestData.temperature,
      maxTokens: requestData.maxTokens,
      streaming: requestData.streaming,
      promptLength: requestData.prompt?.length || 0,
      timestamp: new Date().toISOString(),
    };

    // Store active AI request
    this.activeRequests.set(requestId, {
      ...logData,
      requestData,
    });

    this.logger.info('AI request started', logData);
    return requestId;
  }

  /**
   * End AI provider request logging
   * @param {string} requestId - Request ID
   * @param {Object} result - Request result
   */
  endAIRequest(requestId, result = {}) {
    if (!requestId) return;

    const requestData = this.activeRequests.get(requestId);
    if (!requestData) return;

    const endTime = Date.now();
    const duration = endTime - requestData.startTime;

    const logData = {
      type: 'ai_response',
      phase: 'end',
      requestId,
      provider: requestData.provider,
      operation: requestData.operation,
      duration,
      success: result.success !== false,
      error: result.error,
      responseLength: result.response?.length || 0,
      tokensUsed: result.tokens || 0,
      model: requestData.model,
      timestamp: new Date().toISOString(),
    };

    if (result.error) {
      this.logger.error('AI request failed', logData);
    } else {
      this.logger.info('AI request completed', logData);
    }

    // Track performance
    if (this.config.enablePerformanceLogging) {
      this.trackPerformance('ai_request', duration, {
        provider: requestData.provider,
        operation: requestData.operation,
        success: result.success !== false,
      });
    }

    // Remove from active requests
    this.activeRequests.delete(requestId);
  }

  /**
   * Track performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  trackPerformance(operation, duration, metadata = {}) {
    if (!this.config.enablePerformanceLogging) return;

    const performanceData = {
      type: 'performance',
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Log if above threshold
    if (duration > this.config.performanceThreshold) {
      this.logger.warn('Slow operation detected', performanceData);
    } else {
      this.logger.info('Performance metric', performanceData);
    }

    // Store in performance metrics
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }

    const metrics = this.performanceMetrics.get(operation);
    metrics.push({
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Keep only recent metrics (last 1000)
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  /**
   * Track error for analysis
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @private
   */
  trackError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status || error.response?.status,
      stack: error.stack,
      context,
    };

    this.errorHistory.push(errorRecord);

    // Keep only recent errors
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.splice(
        0,
        this.errorHistory.length - this.maxErrorHistory
      );
    }
  }

  /**
   * Sanitize headers for logging
   * @param {Object} headers - Headers object
   * @returns {Object} Sanitized headers
   * @private
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-auth-token',
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize request/response body for logging
   * @param {*} body - Body data
   * @returns {*} Sanitized body
   * @private
   */
  sanitizeBody(body) {
    if (!body) return body;

    // Limit body size
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (bodyStr.length > this.config.maxBodySize) {
      return `${bodyStr.substring(0, this.config.maxBodySize)}... [TRUNCATED]`;
    }

    // Remove sensitive fields
    if (typeof body === 'object') {
      const sanitized = { ...body };
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

      sensitiveFields.forEach((field) => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      return sanitized;
    }

    return body;
  }

  /**
   * Get performance statistics
   * @param {string} operation - Operation name (optional)
   * @returns {Object} Performance statistics
   */
  getPerformanceStats(operation = null) {
    if (operation) {
      const metrics = this.performanceMetrics.get(operation) || [];
      if (metrics.length === 0) return null;

      const durations = metrics.map((m) => m.duration);
      return {
        operation,
        count: metrics.length,
        avgDuration:
          durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        p95Duration: this.calculatePercentile(durations, 0.95),
        p99Duration: this.calculatePercentile(durations, 0.99),
        recentMetrics: metrics.slice(-10),
      };
    }

    // Return stats for all operations
    const stats = {};
    for (const [op, metrics] of this.performanceMetrics.entries()) {
      stats[op] = this.getPerformanceStats(op);
    }
    return stats;
  }

  /**
   * Calculate percentile
   * @param {Array} values - Array of values
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} Percentile value
   * @private
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[index] || 0;
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    if (this.errorHistory.length === 0) {
      return {
        total: 0,
        byType: {},
        byCode: {},
        recent: [],
      };
    }

    const stats = {
      total: this.errorHistory.length,
      byType: {},
      byCode: {},
      recent: this.errorHistory.slice(-10),
    };

    this.errorHistory.forEach((error) => {
      // Count by type
      stats.byType[error.name] = (stats.byType[error.name] || 0) + 1;

      // Count by code
      if (error.code) {
        stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Get active requests
   * @returns {Array} Active requests
   */
  getActiveRequests() {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Export logs
   * @param {Object} options - Export options
   * @returns {Object} Exported log data
   */
  exportLogs(options = {}) {
    const timeRange = options.timeRange || 3600000; // 1 hour
    const cutoffTime = Date.now() - timeRange;

    return {
      timestamp: new Date().toISOString(),
      timeRange,
      performanceStats: this.getPerformanceStats(),
      errorStats: this.getErrorStats(),
      activeRequests: this.getActiveRequests(),
      recentErrors: this.errorHistory.filter(
        (error) => new Date(error.timestamp).getTime() > cutoffTime
      ),
      configuration: this.config,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.activeRequests.clear();
    this.performanceMetrics.clear();
    this.errorHistory.length = 0;

    if (this.logger) {
      this.logger.close();
    }

    console.log('StructuredLogger destroyed');
  }
}

module.exports = StructuredLogger;
