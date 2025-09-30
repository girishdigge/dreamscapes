// services/express/middleware/errorHandler.js
const { logger } = require('../utils/logger');

// Main error handling middleware
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Default error response
  let statusCode = 500;
  let errorResponse = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.error = 'Validation Error';
    errorResponse.message = err.message;
    errorResponse.details = err.errors || [];
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorResponse.error = 'Invalid ID Format';
    errorResponse.message = 'The provided ID is not in a valid format';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorResponse.error = 'Service Unavailable';
    errorResponse.message = 'Unable to connect to required services';
    errorResponse.service = err.address || 'unknown';
  } else if (err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorResponse.error = 'Service Unavailable';
    errorResponse.message = 'Required service not found';
    errorResponse.hostname = err.hostname || 'unknown';
  } else if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
    statusCode = 504;
    errorResponse.error = 'Gateway Timeout';
    errorResponse.message = 'Request timed out while processing';
  } else if (
    err.name === 'SyntaxError' &&
    err.status === 400 &&
    'body' in err
  ) {
    statusCode = 400;
    errorResponse.error = 'Invalid JSON';
    errorResponse.message = 'Request body contains invalid JSON';
  } else if (err.status && err.status >= 400 && err.status < 600) {
    // HTTP errors with custom status codes
    statusCode = err.status;
    errorResponse.error = err.name || 'HTTP Error';
    errorResponse.message = err.message || 'Request could not be processed';
  }

  // Add development-only details
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port,
    };
  }

  // Add request context for debugging
  if (isDevelopment) {
    errorResponse.request = {
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    };
  }

  // Add suggestions based on error type
  const suggestions = getSuggestions(err, req);
  if (suggestions.length > 0) {
    errorResponse.suggestions = suggestions;
  }

  // Set appropriate headers
  res.set({
    'Content-Type': 'application/json',
    'X-Error-Type': err.name || 'Unknown',
    'X-Request-ID': req.id || 'unknown',
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Generate helpful suggestions based on error type
function getSuggestions(err, req) {
  const suggestions = [];

  if (err.name === 'ValidationError') {
    suggestions.push('Check the API documentation for correct request format');
    suggestions.push(
      'Ensure all required fields are provided with correct data types'
    );
  }

  if (err.code === 'ECONNREFUSED') {
    suggestions.push('Check if all required services are running');
    suggestions.push('Verify service URLs in environment configuration');
    suggestions.push('Check network connectivity between services');
  }

  if (err.name === 'TimeoutError') {
    suggestions.push('Try reducing the complexity of your request');
    suggestions.push('Check if external services are responding normally');
    suggestions.push('Consider breaking large requests into smaller parts');
  }

  if (req.path.includes('/parse-dream') && err.status >= 500) {
    suggestions.push('Try using a shorter dream description');
    suggestions.push('Consider using a different dream style');
    suggestions.push('Check if the AI services are available');
  }

  if (req.path.includes('/export') && err.status >= 500) {
    suggestions.push('Try exporting with lower quality settings');
    suggestions.push('Ensure the dream exists and is valid');
    suggestions.push('Consider using client-side recording as fallback');
  }

  return suggestions;
}

// 404 handler (not found)
function notFoundHandler(req, res, next) {
  const error = {
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /health',
      'GET /api',
      'POST /api/parse-dream',
      'POST /api/patch-dream',
      'POST /api/export',
      'GET /api/dreams',
      'GET /api/samples',
      'GET /api/scene/:id',
    ],
  };

  res.status(404).json(error);
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Rate limiting error handler
function rateLimitHandler(req, res, next) {
  const error = {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    timestamp: new Date().toISOString(),
    retryAfter: res.get('Retry-After') || '60 seconds',
    limits: {
      windowMs: '15 minutes',
      max: 100,
      message: 'Maximum 100 requests per 15 minutes',
    },
  };

  res.status(429).json(error);
}

// CORS error handler
function corsErrorHandler(err, req, res, next) {
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Cross-origin request blocked',
      origin: req.get('Origin'),
      allowedOrigins: process.env.FRONTEND_URL || 'http://localhost:3000',
      timestamp: new Date().toISOString(),
    });
  }

  next(err);
}

// Payload too large handler
function payloadTooLargeHandler(err, req, res, next) {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body exceeds maximum allowed size',
      maxSize: '10MB',
      received: req.get('Content-Length') || 'unknown',
      timestamp: new Date().toISOString(),
      suggestions: [
        'Reduce the size of your dream description',
        'Remove unnecessary data from the request',
        'Split large requests into smaller parts',
      ],
    });
  }

  next(err);
}

// Database connection error handler
function dbErrorHandler(err, req, res, next) {
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    logger.error('Database error:', err);

    return res.status(503).json({
      error: 'Database Unavailable',
      message: 'Database connection error',
      timestamp: new Date().toISOString(),
      suggestions: [
        'Try again in a few moments',
        'Check if the database service is running',
        'Contact support if the issue persists',
      ],
    });
  }

  next(err);
}

// Error monitoring and alerting
function errorMonitoring(err, req, res, next) {
  // Count errors by type for monitoring
  const errorType = err.name || 'UnknownError';
  const statusCode = err.status || res.statusCode || 500;

  // Log error metrics (could integrate with monitoring service)
  logger.info('Error metrics:', {
    type: errorType,
    statusCode,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Alert on critical errors (5xx)
  if (statusCode >= 500) {
    logger.error('Critical error detected:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  next(err);
}

// Security error handler
function securityErrorHandler(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions',
      timestamp: new Date().toISOString(),
    });
  }

  next(err);
}

// Graceful shutdown error handler
function gracefulShutdownHandler() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Close server gracefully
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Close server gracefully
    process.exit(1);
  });
}

// Error response formatter
function formatError(error, includeStack = false) {
  const formatted = {
    name: error.name || 'Error',
    message: error.message || 'An error occurred',
    status: error.status || error.statusCode || 500,
    timestamp: new Date().toISOString(),
  };

  if (includeStack) {
    formatted.stack = error.stack;
  }

  if (error.code) {
    formatted.code = error.code;
  }

  if (error.errno) {
    formatted.errno = error.errno;
  }

  return formatted;
}

// Error aggregation for monitoring
class ErrorAggregator {
  constructor() {
    this.errors = new Map();
    this.resetInterval = 15 * 60 * 1000; // 15 minutes

    setInterval(() => this.reset(), this.resetInterval);
  }

  record(error, req) {
    const key = `${error.name}:${req.path}`;
    const existing = this.errors.get(key) || { count: 0, samples: [] };

    existing.count++;
    existing.lastOccurrence = new Date();

    // Keep last 3 samples
    existing.samples.push({
      message: error.message,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (existing.samples.length > 3) {
      existing.samples.shift();
    }

    this.errors.set(key, existing);
  }

  getStats() {
    const stats = {};

    for (const [key, data] of this.errors.entries()) {
      stats[key] = {
        count: data.count,
        lastOccurrence: data.lastOccurrence,
        recentSamples: data.samples.length,
      };
    }

    return stats;
  }

  getTopErrors(limit = 10) {
    return Array.from(this.errors.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([key, data]) => ({
        error: key,
        count: data.count,
        lastOccurrence: data.lastOccurrence,
      }));
  }

  reset() {
    this.errors.clear();
    logger.info('Error aggregator reset');
  }
}

const errorAggregator = new ErrorAggregator();

// Enhanced error handler with aggregation
function enhancedErrorHandler(err, req, res, next) {
  // Record error for monitoring
  errorAggregator.record(err, req);

  // Call main error handler
  errorHandler(err, req, res, next);
}

// Error statistics endpoint
function getErrorStats() {
  return {
    aggregated: errorAggregator.getStats(),
    topErrors: errorAggregator.getTopErrors(),
    systemInfo: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    },
  };
}

module.exports = {
  errorHandler,
  enhancedErrorHandler,
  notFoundHandler,
  asyncHandler,
  rateLimitHandler,
  corsErrorHandler,
  payloadTooLargeHandler,
  dbErrorHandler,
  errorMonitoring,
  securityErrorHandler,
  gracefulShutdownHandler,
  formatError,
  getErrorStats,
  errorAggregator,
};
