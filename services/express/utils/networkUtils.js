// services/express/utils/networkUtils.js
// Network utilities with retry mechanism, exponential backoff, and circuit breaker pattern
//
// This module provides robust HTTP request handling for the Dreamscapes Express service,
// specifically designed to handle communication with the MCP Gateway and other services.
//
// Features:
// - Exponential backoff retry mechanism with jitter
// - Circuit breaker pattern to prevent cascading failures
// - Comprehensive error categorization and logging
// - Configurable timeout and retry parameters
// - Network error detection and appropriate retry decisions

const fetch = require('node-fetch');
const { logger } = require('./logger');

/**
 * Enhanced fetch function with retry mechanism, exponential backoff, and circuit breaker pattern
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts (default: 2)
 * @param {object} retryConfig - Retry configuration options
 * @returns {Promise<Response>} - The fetch response
 */
async function fetchWithRetry(
  url,
  options = {},
  maxRetries = 2,
  retryConfig = {}
) {
  const config = {
    baseDelay: retryConfig.baseDelay || 1000, // 1 second
    maxDelay: retryConfig.maxDelay || 10000, // 10 seconds
    backoffMultiplier: retryConfig.backoffMultiplier || 2.0,
    jitterEnabled: retryConfig.jitterEnabled !== false, // Default to true
    ...retryConfig,
  };

  let lastError = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    let controller = null;
    let timeoutId = null;

    try {
      // Configure appropriate timeout values for different types of requests
      const timeout = getTimeoutForRequest(url, options);

      // Implement proper AbortController usage for request cancellation
      controller = new AbortController();

      // Set up timeout with proper cleanup
      timeoutId = setTimeout(() => {
        logger.warn('Fetch request timeout triggered', {
          url,
          timeout: `${timeout}ms`,
          attempt: attempt + 1,
          elapsedTime: `${Date.now() - attemptStartTime}ms`,
          requestType: getRequestType(url, options),
        });
        controller.abort();
      }, timeout);

      // Enhanced fetch options with signal and improved configuration
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        // Add connection management headers
        headers: {
          Connection: 'keep-alive',
          'Keep-Alive': 'timeout=30, max=100',
          ...options.headers,
        },
      };

      logger.debug('Fetch attempt starting', {
        url,
        attempt: attempt + 1,
        maxAttempts: maxRetries + 1,
        isRetry: attempt > 0,
        timeout: `${timeout}ms`,
        method: fetchOptions.method || 'GET',
        requestType: getRequestType(url, options),
        hasAbortController: !!controller,
      });

      const response = await fetch(url, fetchOptions);

      // Clear timeout on successful response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const attemptTime = Date.now() - attemptStartTime;

      logger.debug('Fetch attempt completed', {
        url,
        attempt: attempt + 1,
        status: response.status,
        ok: response.ok,
        attemptTime: `${attemptTime}ms`,
        totalTime: `${Date.now() - startTime}ms`,
        contentLength: response.headers.get('content-length'),
        contentType: response.headers.get('content-type'),
      });

      return response;
    } catch (error) {
      // Clean up timeout and controller
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      lastError = error;
      const attemptTime = Date.now() - attemptStartTime;

      // Add network error detection and appropriate fallback triggers
      const errorCategory = categorizeNetworkError(error);
      const networkErrorDetails = analyzeNetworkError(error, url, options);
      const shouldRetry = shouldRetryError(
        error,
        attempt,
        maxRetries,
        networkErrorDetails
      );

      logger.warn('Fetch attempt failed', {
        url,
        attempt: attempt + 1,
        maxAttempts: maxRetries + 1,
        error: error.message,
        errorType: error.constructor.name,
        errorCode: error.code,
        errorCategory,
        networkErrorDetails,
        shouldRetry,
        attemptTime: `${attemptTime}ms`,
        totalElapsed: `${Date.now() - startTime}ms`,
        abortReason: error.name === 'AbortError' ? 'timeout_or_manual' : 'none',
      });

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt >= maxRetries || !shouldRetry) {
        break;
      }

      // Calculate delay with exponential backoff and optional jitter
      const exponentialDelay =
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
      const jitter = config.jitterEnabled ? Math.random() * 1000 : 0;
      const finalDelay = Math.min(exponentialDelay + jitter, config.maxDelay);

      logger.info('Fetch retry scheduled', {
        url,
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        delay: `${Math.round(finalDelay)}ms`,
        baseDelay: `${config.baseDelay}ms`,
        exponentialDelay: `${Math.round(exponentialDelay)}ms`,
        jitter: `${Math.round(jitter)}ms`,
        maxDelay: `${config.maxDelay}ms`,
        retryReason: networkErrorDetails.retryReason,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // All retries exhausted
  const totalTime = Date.now() - startTime;
  const finalErrorDetails = analyzeNetworkError(lastError, url, options);

  logger.error('Fetch all retries exhausted', {
    url,
    totalAttempts: maxRetries + 1,
    totalTime: `${totalTime}ms`,
    finalError: lastError?.message,
    errorCategory: categorizeNetworkError(lastError),
    networkErrorDetails: finalErrorDetails,
    fallbackRecommendation: finalErrorDetails.fallbackRecommendation,
  });

  // Enhance the final error with retry information
  if (lastError) {
    lastError.totalAttempts = maxRetries + 1;
    lastError.totalRetryTime = totalTime;
    lastError.retriesExhausted = true;
    lastError.url = url;
    lastError.networkErrorDetails = finalErrorDetails;
  }

  throw lastError || new Error(`Fetch failed after ${maxRetries + 1} attempts`);
}

/**
 * Categorize network errors for better error handling and retry decisions
 * @param {Error} error - The error to categorize
 * @returns {string} - The error category
 */
function categorizeNetworkError(error) {
  if (!error) return 'unknown';

  if (error.name === 'AbortError') {
    return 'timeout';
  }

  if (error.code) {
    switch (error.code) {
      case 'ECONNREFUSED':
        return 'connection_refused';
      case 'ENOTFOUND':
        return 'dns_resolution';
      case 'ECONNRESET':
        return 'connection_reset';
      case 'ETIMEDOUT':
        return 'network_timeout';
      case 'ECONNABORTED':
        return 'connection_aborted';
      case 'EHOSTUNREACH':
        return 'host_unreachable';
      case 'ENETUNREACH':
        return 'network_unreachable';
      default:
        return `network_${error.code.toLowerCase()}`;
    }
  }

  if (error.type) {
    switch (error.type) {
      case 'request-timeout':
        return 'request_timeout';
      case 'body-timeout':
        return 'body_timeout';
      case 'system':
        return 'system_error';
      default:
        return `fetch_${error.type}`;
    }
  }

  return 'unknown';
}

/**
 * Configure appropriate timeout values for different types of requests
 * @param {string} url - The request URL
 * @param {object} options - Fetch options
 * @returns {number} - Timeout in milliseconds
 */
function getTimeoutForRequest(url, options = {}) {
  // Use explicit timeout if provided
  if (options.timeout) {
    return options.timeout;
  }

  // Environment-based timeout configuration
  const baseTimeout = parseInt(process.env.MCP_TIMEOUT_MS) || 30000;
  const healthCheckTimeout =
    parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS) || 5000;
  const longOperationTimeout =
    parseInt(process.env.LONG_OPERATION_TIMEOUT_MS) || 60000;

  // Determine request type and set appropriate timeout
  if (url.includes('/health')) {
    return healthCheckTimeout;
  }

  if (url.includes('/parse') || url.includes('/generate')) {
    // AI generation requests may take longer
    return longOperationTimeout;
  }

  if (options.method === 'POST' && options.body) {
    // POST requests with large bodies may need more time
    const bodySize = typeof options.body === 'string' ? options.body.length : 0;
    if (bodySize > 10000) {
      // 10KB threshold
      return Math.min(baseTimeout * 2, longOperationTimeout);
    }
  }

  return baseTimeout;
}

/**
 * Determine the type of request for logging and timeout purposes
 * @param {string} url - The request URL
 * @param {object} options - Fetch options
 * @returns {string} - Request type
 */
function getRequestType(url, options = {}) {
  if (url.includes('/health')) return 'health_check';
  if (url.includes('/parse')) return 'dream_generation';
  if (url.includes('/generate')) return 'ai_generation';
  if (options.method === 'POST') return 'post_request';
  if (options.method === 'GET') return 'get_request';
  return 'unknown';
}

/**
 * Analyze network errors for better error handling and fallback decisions
 * @param {Error} error - The error to analyze
 * @param {string} url - The request URL
 * @param {object} options - Fetch options
 * @returns {object} - Error analysis details
 */
function analyzeNetworkError(error, url, options = {}) {
  if (!error) {
    return {
      severity: 'unknown',
      retryRecommended: false,
      fallbackRecommendation: 'none',
      retryReason: 'no_error',
    };
  }

  const category = categorizeNetworkError(error);
  const requestType = getRequestType(url, options);

  let severity = 'medium';
  let retryRecommended = true;
  let fallbackRecommendation = 'local_generation';
  let retryReason = 'network_error';

  switch (category) {
    case 'timeout':
      severity = 'high';
      retryRecommended = true;
      fallbackRecommendation = 'local_generation';
      retryReason = 'request_timeout';
      break;

    case 'connection_refused':
      severity = 'high';
      retryRecommended = true;
      fallbackRecommendation = 'service_unavailable';
      retryReason = 'service_down';
      break;

    case 'dns_resolution':
      severity = 'critical';
      retryRecommended = false;
      fallbackRecommendation = 'configuration_error';
      retryReason = 'dns_failure';
      break;

    case 'connection_reset':
      severity = 'medium';
      retryRecommended = true;
      fallbackRecommendation = 'local_generation';
      retryReason = 'connection_instability';
      break;

    case 'network_timeout':
      severity = 'high';
      retryRecommended = true;
      fallbackRecommendation = 'local_generation';
      retryReason = 'network_slow';
      break;

    case 'host_unreachable':
    case 'network_unreachable':
      severity = 'critical';
      retryRecommended = false;
      fallbackRecommendation = 'network_issue';
      retryReason = 'network_unreachable';
      break;

    default:
      if (error.status >= 500) {
        severity = 'high';
        retryRecommended = true;
        fallbackRecommendation = 'server_error';
        retryReason = 'server_error';
      } else if (error.status >= 400) {
        severity = 'medium';
        retryRecommended = false;
        fallbackRecommendation = 'client_error';
        retryReason = 'client_error';
      }
      break;
  }

  // Adjust recommendations based on request type
  if (requestType === 'health_check') {
    fallbackRecommendation = 'mark_service_unhealthy';
  } else if (requestType === 'dream_generation') {
    fallbackRecommendation = 'local_generation';
  }

  return {
    category,
    severity,
    retryRecommended,
    fallbackRecommendation,
    retryReason,
    requestType,
    errorCode: error.code,
    errorName: error.name,
    httpStatus: error.status,
  };
}

/**
 * Determine if an error should trigger a retry
 * @param {Error} error - The error to evaluate
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} maxRetries - Maximum number of retries
 * @param {object} networkErrorDetails - Detailed error analysis
 * @returns {boolean} - Whether to retry
 */
function shouldRetryError(
  error,
  attempt,
  maxRetries,
  networkErrorDetails = {}
) {
  // Don't retry if we've reached max attempts
  if (attempt >= maxRetries) {
    return false;
  }

  // Don't retry if error explicitly says not to
  if (error.shouldRetry === false) {
    return false;
  }

  // Use network error analysis if available
  if (networkErrorDetails.retryRecommended !== undefined) {
    return networkErrorDetails.retryRecommended;
  }

  const category = categorizeNetworkError(error);

  // Retryable error categories
  const retryableCategories = [
    'timeout',
    'connection_refused',
    'connection_reset',
    'network_timeout',
    'connection_aborted',
    'host_unreachable',
    'network_unreachable',
    'request_timeout',
    'body_timeout',
    'system_error',
  ];

  // Non-retryable error categories
  const nonRetryableCategories = [
    'dns_resolution', // DNS issues usually don't resolve quickly
  ];

  if (nonRetryableCategories.includes(category)) {
    return false;
  }

  if (retryableCategories.includes(category)) {
    return true;
  }

  // For HTTP errors, check status code if available
  if (error.status) {
    // Retry server errors (5xx) but not client errors (4xx)
    return error.status >= 500 && error.status < 600;
  }

  // Default to retry for unknown errors (conservative approach)
  return true;
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    this.name = options.name || 'CircuitBreaker';
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - The function to execute
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} - The function result
   */
  async execute(fn, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        const error = new Error(`${this.name} circuit breaker is OPEN`);
        error.circuitBreakerState = this.getState();
        error.shouldRetry = false;
        throw error;
      } else {
        this.state = 'HALF_OPEN';
        logger.info(`${this.name} circuit breaker transitioning to HALF_OPEN`, {
          state: this.getState(),
        });
      }
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      logger.info(
        `${this.name} circuit breaker CLOSED after successful recovery`,
        {
          state: this.getState(),
        }
      );
    }
  }

  /**
   * Handle failed execution
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;

      logger.error(`${this.name} circuit breaker OPENED due to failures`, {
        state: this.getState(),
        error: error?.message,
      });
    }
  }

  /**
   * Get current circuit breaker state
   * @returns {object} - Current state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      timeout: this.timeout,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    logger.info(`${this.name} circuit breaker reset`, {
      state: this.getState(),
    });
  }
}

module.exports = {
  fetchWithRetry,
  categorizeNetworkError,
  shouldRetryError,
  CircuitBreaker,
  getTimeoutForRequest,
  getRequestType,
  analyzeNetworkError,
};
