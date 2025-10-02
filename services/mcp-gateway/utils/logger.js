// utils/Logger.js
// Enhanced logging system with structured data

const winston = require('winston');

// Create transports array based on environment
const transports = [
  new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  new winston.transports.File({ filename: 'logs/combined.log' }),
];

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-gateway' },
  transports,
});

// Add close method for proper cleanup
logger.close = function () {
  if (this.transports) {
    this.transports.forEach((transport) => {
      if (transport.close && typeof transport.close === 'function') {
        transport.close();
      }
    });
  }
};

class EnhancedLogger {
  static logProviderRequest(provider, prompt, options = {}) {
    logger.info('Provider request', {
      provider,
      promptLength: prompt.length,
      options,
      timestamp: new Date().toISOString(),
    });
  }

  static logProviderResponse(provider, success, responseTime, error = null) {
    const logData = {
      provider,
      success,
      responseTime,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      logData.error = {
        message: error.message,
        type: error.type,
        stack: error.stack,
      };
    }

    if (success) {
      logger.info('Provider response success', logData);
    } else {
      logger.error('Provider response failed', logData);
    }
  }

  static logProviderFallback(fromProvider, toProvider, reason) {
    logger.warn('Provider fallback', {
      fromProvider,
      toProvider,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  static logValidationError(content, errors) {
    logger.error('Validation failed', {
      contentLength: content?.length || 0,
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  static logCacheHit(key, provider) {
    logger.debug('Cache hit', {
      key: key.substring(0, 50) + '...',
      provider,
      timestamp: new Date().toISOString(),
    });
  }

  static logCacheMiss(key, provider) {
    logger.debug('Cache miss', {
      key: key.substring(0, 50) + '...',
      provider,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  logger,
  EnhancedLogger,
};
