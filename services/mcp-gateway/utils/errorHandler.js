// services/mcp-gateway/utils/errorHandler.js
const { logger } = require('./logger');

const isDev = process.env.NODE_ENV !== 'production';

// Main error handling middleware
function errorHandler(err, req, res, next) {
  // Log the error with structured data
  logger.error('MCP Gateway error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    name: err.name,
    code: err.code,
  });

  // Determine status code
  let status = 500;
  if (err.status && err.status >= 400 && err.status < 600) {
    status = err.status;
  } else if (err.code === 'ECONNREFUSED') {
    status = 503;
  } else if (err.code === 'ENOTFOUND') {
    status = 503;
  } else if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
    status = 504;
  } else if (err.name === 'ValidationError') {
    status = 400;
  }

  // Build error response
  const payload = {
    service: 'mcp-gateway',
    success: false,
    error: err.message || 'Internal error',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  // Add development-only details
  if (isDev) {
    payload.stack = err.stack;
    payload.details = {
      name: err.name,
      code: err.code,
      errno: err.errno,
    };
  }

  // Add suggestions based on error type
  const suggestions = getSuggestions(err, req);
  if (suggestions.length > 0) {
    payload.suggestions = suggestions;
  }

  res.status(status).json(payload);
}

// Generate helpful suggestions based on error type
function getSuggestions(err, req) {
  const suggestions = [];

  if (err.code === 'ECONNREFUSED') {
    suggestions.push('Check if AI services (Cerebras/OpenAI) are reachable');
    suggestions.push('Verify API keys are configured correctly');
    suggestions.push('Check network connectivity');
  }

  if (err.name === 'TimeoutError') {
    suggestions.push('Try reducing the complexity of your request');
    suggestions.push('Check if AI services are responding normally');
    suggestions.push('Consider using a different AI provider');
  }

  if (err.name === 'ValidationError') {
    suggestions.push('Check the API documentation for correct request format');
    suggestions.push('Ensure all required fields are provided');
  }

  if (req.path.includes('/parse') && err.status >= 500) {
    suggestions.push('Try using a shorter text description');
    suggestions.push('Consider using a different style');
    suggestions.push('Check if AI services are available');
  }

  return suggestions;
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// AI service error handler
function aiServiceErrorHandler(err, provider, operation) {
  logger.error(`AI Service Error - ${provider}`, {
    operation,
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status,
  });

  // Return standardized error for upstream handling
  const standardError = new Error(
    `${provider} ${operation} failed: ${err.message}`
  );
  standardError.status = err.status || 502;
  standardError.code = err.code;
  standardError.provider = provider;
  standardError.operation = operation;

  return standardError;
}

module.exports = {
  errorHandler,
  asyncHandler,
  aiServiceErrorHandler,
  getSuggestions,
};
