// services/render-worker/utils/logger.js
const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Colors for console output
const COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m', // Yellow
  INFO: '\x1b[36m', // Cyan
  DEBUG: '\x1b[37m', // White
  RESET: '\x1b[0m',
};

class Logger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'render-worker';
    this.level = LOG_LEVELS[options.level || process.env.LOG_LEVEL || 'INFO'];
    this.enableColors = options.colors !== false;
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.logDir = options.logDir || 'logs';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;

    // Ensure log directory exists
    if (this.enableFile) {
      this.ensureLogDir();
    }
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    const baseLog = {
      timestamp,
      level,
      service: this.serviceName,
      pid,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    // Add metadata if provided
    if (Object.keys(meta).length > 0) {
      baseLog.meta = meta;
    }

    return baseLog;
  }

  formatConsoleMessage(logObj) {
    const { timestamp, level, service, message, meta } = logObj;
    const color = this.enableColors ? COLORS[level] : '';
    const reset = this.enableColors ? COLORS.RESET : '';

    let formatted = `${color}[${timestamp}] ${level.padEnd(
      5
    )} [${service}] ${message}${reset}`;

    if (meta && Object.keys(meta).length > 0) {
      formatted += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return formatted;
  }

  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] > this.level) {
      return; // Skip if level is below threshold
    }

    const logObj = this.formatMessage(level, message, meta);

    // Console output
    if (this.enableConsole) {
      const consoleMsg = this.formatConsoleMessage(logObj);

      if (level === 'ERROR') {
        console.error(consoleMsg);
      } else if (level === 'WARN') {
        console.warn(consoleMsg);
      } else {
        console.log(consoleMsg);
      }
    }

    // File output
    if (this.enableFile) {
      this.writeToFile(level, logObj);
    }
  }

  writeToFile(level, logObj) {
    const fileName = level === 'ERROR' ? 'error.log' : 'app.log';
    const filePath = path.join(this.logDir, fileName);
    const logLine = JSON.stringify(logObj) + '\n';

    try {
      // Check file size and rotate if needed
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > this.maxFileSize) {
          this.rotateFile(filePath);
        }
      }

      fs.appendFileSync(filePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  rotateFile(filePath) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    // Rotate existing files
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldFile = path.join(dir, `${baseName}.${i}${ext}`);
      const newFile = path.join(dir, `${baseName}.${i + 1}${ext}`);

      if (fs.existsSync(oldFile)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current file to .1
    const rotatedFile = path.join(dir, `${baseName}.1${ext}`);
    fs.renameSync(filePath, rotatedFile);
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  // HTTP request logging
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: responseTime + 'ms',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length') || 0,
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP Request', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  // Render job logging
  logJobEvent(jobId, event, meta = {}) {
    const logData = {
      jobId,
      event,
      ...meta,
    };

    this.info(`Job ${event}`, logData);
  }

  // Performance logging
  logPerformance(operation, duration, meta = {}) {
    const logData = {
      operation,
      duration: duration + 'ms',
      ...meta,
    };

    if (duration > 30000) {
      // > 30 seconds for render operations
      this.warn('Slow Operation', logData);
    } else {
      this.debug('Performance', logData);
    }
  }

  // System resource logging
  logSystemResources() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.debug('System Resources', {
      memory: {
        rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(usage.external / 1024 / 1024) + ' MB',
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: Math.round(process.uptime()) + 's',
    });
  }
}

// Create default logger instance
const logger = new Logger({
  serviceName: 'render-worker',
  level: process.env.LOG_LEVEL || 'INFO',
  colors: process.env.NODE_ENV !== 'production',
  console: true,
  file: process.env.NODE_ENV === 'production',
});

// Express middleware for request logging
function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      const responseTime = Date.now() - start;
      logger.logRequest(req, res, responseTime);
      originalEnd.call(res, chunk, encoding);
    };

    next();
  };
}

// Structured error logging
function logError(error, context = {}) {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context,
  };

  logger.error('Application Error', errorData);
}

module.exports = {
  logger,
  Logger,
  requestLogger,
  logError,
  LOG_LEVELS,
};
