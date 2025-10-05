// services/express/routes/parse.js
const express = require('express');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { validateDream } = require('../middleware/validation');
const {
  getFromCache,
  setToCache,
  validateCachedDream,
  getCacheStats,
  clearCache,
  dreamCache,
} = require('../middleware/cache');
const { createFallbackDream } = require('../utils/fallbackGenerator');
const { logger } = require('../utils/logger');
const { dreamProcessingLogger } = require('../utils/dreamProcessingLogger');
const { responseProcessor } = require('../utils/responseProcessor');
const { serviceMonitor } = require('../utils/serviceMonitor');
const {
  fetchWithRetry,
  CircuitBreaker,
  categorizeNetworkError,
  analyzeNetworkError,
} = require('../utils/networkUtils');

const router = express.Router();
const MCP_GATEWAY_URL =
  process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: parseInt(process.env.MCP_MAX_RETRIES) || 2,
  baseDelay: parseInt(process.env.MCP_RETRY_BASE_DELAY) || 1000, // 1 second
  maxDelay: parseInt(process.env.MCP_RETRY_MAX_DELAY) || 10000, // 10 seconds
  backoffMultiplier:
    parseFloat(process.env.MCP_RETRY_BACKOFF_MULTIPLIER) || 2.0,
};

// Circuit breaker for MCP Gateway
const mcpGatewayCircuitBreaker = new CircuitBreaker({
  name: 'MCP-Gateway',
  failureThreshold: parseInt(process.env.MCP_CIRCUIT_BREAKER_THRESHOLD) || 5,
  timeout: parseInt(process.env.MCP_CIRCUIT_BREAKER_TIMEOUT) || 60000, // 1 minute
  monitoringPeriod:
    parseInt(process.env.MCP_CIRCUIT_BREAKER_MONITORING) || 10000, // 10 seconds
});

// Health check function for MCP Gateway
async function checkMCPGatewayHealth() {
  const startTime = Date.now();

  try {
    const healthCheckTimeout =
      parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS) || 5000;

    logger.debug('Checking MCP Gateway health', {
      url: `${MCP_GATEWAY_URL}/health`,
      timeout: `${healthCheckTimeout}ms`,
    });

    // Use fetchWithRetry for consistent timeout and error handling
    const response = await fetchWithRetry(
      `${MCP_GATEWAY_URL}/health`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Dreamscapes-Express/1.0.0',
          'X-Health-Check': 'true',
        },
        timeout: healthCheckTimeout,
      },
      0, // No retries for health checks
      {
        baseDelay: 0,
        jitterEnabled: false,
      }
    );

    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok;

    logger.info('MCP Gateway health check completed', {
      healthy: isHealthy,
      status: response.status,
      responseTime: `${responseTime}ms`,
      url: `${MCP_GATEWAY_URL}/health`,
      contentType: response.headers.get('content-type'),
    });

    return {
      healthy: isHealthy,
      status: response.status,
      responseTime,
      headers: {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorCategory = categorizeNetworkError(error);
    const networkDetails = analyzeNetworkError(
      error,
      `${MCP_GATEWAY_URL}/health`,
      { method: 'GET' }
    );

    logger.warn('MCP Gateway health check failed', {
      error: error.message,
      errorCategory,
      networkDetails,
      responseTime: `${responseTime}ms`,
      url: `${MCP_GATEWAY_URL}/health`,
      abortReason: error.name === 'AbortError' ? 'timeout' : 'network_error',
    });

    return {
      healthy: false,
      error: error.message,
      errorCategory,
      networkDetails,
      responseTime,
    };
  }
}

// Helper function to get circuit breaker state for logging
function getCircuitBreakerState() {
  return mcpGatewayCircuitBreaker.getState();
}

// Retry wrapper with exponential backoff and circuit breaker
async function callMCPGatewayWithRetry(text, style, options = {}) {
  const overallStartTime = Date.now();

  logger.info('MCP Gateway retry wrapper starting', {
    textLength: text.trim().length,
    style,
    maxRetries: RETRY_CONFIG.maxRetries,
    circuitBreakerState: getCircuitBreakerState(),
  });

  try {
    // Use circuit breaker to execute the MCP Gateway call with retries
    const result = await mcpGatewayCircuitBreaker.execute(async () => {
      return await callMCPGatewayWithFetchRetry(text, style, options);
    });

    const totalTime = Date.now() - overallStartTime;
    logger.info('MCP Gateway retry wrapper completed successfully', {
      totalTime: `${totalTime}ms`,
      circuitBreakerState: getCircuitBreakerState(),
    });

    // Record successful MCP request metrics
    serviceMonitor.recordMCPRequest(true, totalTime, result.source);

    return result;
  } catch (error) {
    const totalTime = Date.now() - overallStartTime;

    logger.error('MCP Gateway retry wrapper failed', {
      error: error.message,
      errorCategory: error.category || 'unknown',
      totalTime: `${totalTime}ms`,
      circuitBreakerState: getCircuitBreakerState(),
      retriesExhausted: error.retriesExhausted,
      totalAttempts: error.totalAttempts,
    });

    // Record failed MCP request metrics
    serviceMonitor.recordMCPRequest(false, totalTime, null, error);

    // Record error pattern
    const errorType =
      error.category === 'timeout'
        ? 'timeout'
        : error.category === 'network'
        ? 'network'
        : 'unknown';
    serviceMonitor.recordError(errorType, error.message, error.status);

    throw error;
  }
}

// Internal function that uses fetchWithRetry for the actual HTTP calls
async function callMCPGatewayWithFetchRetry(text, style, options = {}) {
  const startTime = Date.now();
  const requestId = uuidv4();
  const requestPayload = { text: text.trim(), style, options };

  logger.info('MCP Gateway fetch retry starting', {
    requestId,
    url: `${MCP_GATEWAY_URL}/parse`,
    textLength: text.trim().length,
    style,
    maxRetries: RETRY_CONFIG.maxRetries,
  });

  try {
    // Use fetchWithRetry for the HTTP request with exponential backoff
    const response = await fetchWithRetry(
      `${MCP_GATEWAY_URL}/parse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Dreamscapes-Express/1.0.0',
          'X-Request-ID': requestId,
          'X-Request-Source': 'express-orchestrator',
          'X-Dream-Style': style,
          'X-Request-Timestamp': new Date().toISOString(),
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(requestPayload),
        timeout: parseInt(process.env.MCP_TIMEOUT_MS) || 45000,
        compress: true,
        follow: 3,
        size: 50 * 1024 * 1024, // 50MB max response size
      },
      RETRY_CONFIG.maxRetries,
      {
        baseDelay: RETRY_CONFIG.baseDelay,
        maxDelay: RETRY_CONFIG.maxDelay,
        backoffMultiplier: RETRY_CONFIG.backoffMultiplier,
        jitterEnabled: true,
      }
    );

    const responseTime = Date.now() - startTime;

    logger.info('MCP Gateway fetch retry response received', {
      requestId,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseTime: `${responseTime}ms`,
      contentType: response.headers.get('content-type'),
    });

    // Handle HTTP errors
    if (!response.ok) {
      let errorText = '';
      let errorDetails = {};

      try {
        errorText = await response.text();
        try {
          errorDetails = JSON.parse(errorText);
        } catch (parseErr) {
          errorDetails = { rawError: errorText };
        }
      } catch (textError) {
        logger.error('Failed to read error response body', {
          requestId,
          error: textError.message,
          responseTime: `${responseTime}ms`,
        });
        errorText = 'Unable to read error response';
      }

      logger.error('MCP Gateway HTTP error response', {
        requestId,
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.slice(0, 1000),
        errorDetails,
        responseTime: `${responseTime}ms`,
      });

      const httpError = new Error(
        `MCP Gateway HTTP ${response.status}: ${response.statusText}`
      );
      httpError.status = response.status;
      httpError.statusText = response.statusText;
      httpError.details = errorDetails;
      httpError.responseTime = responseTime;
      httpError.category = `http_${response.status}`;
      httpError.shouldRetry = response.status >= 500 && response.status < 600;

      throw httpError;
    }

    // Process the successful response
    const processedResponse = await responseProcessor.processResponse(
      response,
      requestId,
      responseTime,
      text.trim()
    );

    logger.info('MCP Gateway fetch retry processed successfully', {
      requestId,
      dreamId: processedResponse.dreamJson.id,
      source: processedResponse.source,
      validationPassed: processedResponse.validation.valid,
      responseTime: `${responseTime}ms`,
    });

    return processedResponse;
  } catch (error) {
    const errorTime = Date.now() - startTime;

    // Enhance error with additional context
    error.requestId = requestId;
    error.responseTime = errorTime;

    if (!error.category) {
      error.category = 'unknown';
    }

    logger.error('MCP Gateway fetch retry failed', {
      requestId,
      error: error.message,
      errorCategory: error.category,
      responseTime: `${errorTime}ms`,
      retriesExhausted: error.retriesExhausted,
      totalAttempts: error.totalAttempts,
    });

    throw error;
  }
}

// The old callMCPGateway function has been replaced by callMCPGatewayWithFetchRetry
// which uses the new fetchWithRetry utility and circuit breaker pattern

// Get all cached dreams
router.get('/dreams', (req, res) => {
  try {
    const { page = 1, limit = 10, style } = req.query;
    const allDreams = getFromCache('all_dreams') || [];

    // Filter by style if provided
    let filteredDreams = style
      ? allDreams.filter((dream) => dream.style === style)
      : allDreams;

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDreams = filteredDreams.slice(startIndex, endIndex);

    // Return summary info only
    const dreamSummaries = paginatedDreams.map((dream) => ({
      id: dream.id,
      title: dream.title,
      style: dream.style,
      duration: dream.cinematography?.durationSec || 30,
      structures: dream.structures?.length || 0,
      entities: dream.entities?.length || 0,
      created: dream.created,
      seed: dream.seed,
    }));

    res.json({
      dreams: dreamSummaries,
      pagination: {
        currentPage: parseInt(page),
        totalItems: filteredDreams.length,
        totalPages: Math.ceil(filteredDreams.length / limit),
        hasNext: endIndex < filteredDreams.length,
        hasPrev: startIndex > 0,
      },
      filters: { style },
    });
  } catch (error) {
    logger.error('Error fetching dreams:', error);
    res.status(500).json({ error: 'Failed to fetch dreams' });
  }
});

// Get specific dream scene
router.get('/scene/:id', (req, res) => {
  try {
    const { id } = req.params;
    const dream = getFromCache(id);

    if (!dream) {
      return res.status(404).json({
        error: 'Dream not found',
        id,
        suggestion: 'Check /api/dreams for available dreams',
      });
    }

    res.json(dream);
  } catch (error) {
    logger.error('Error fetching scene:', error);
    res.status(500).json({ error: 'Failed to fetch scene' });
  }
});

// Get sample dreams
router.get('/samples', (req, res) => {
  const samples = [
    {
      id: 'sample_ethereal',
      text: 'A floating library where books fly around like birds, spelling out messages of hope in the sky while soft light emanates from their pages',
      style: 'ethereal',
      title: 'Library of Light',
      description: 'Soft, dreamy library with luminous books',
    },
    {
      id: 'sample_cyberpunk',
      text: 'Neon butterflies dance around a crystalline tower in a digital void, their wings leaving trails of code that forms into blooming flowers',
      style: 'cyberpunk',
      title: 'Digital Garden',
      description: 'Futuristic tower with code-trail butterflies',
    },
    {
      id: 'sample_surreal',
      text: 'A house that grows like a tree with rooms as leaves, floating in cotton candy clouds while impossible staircases spiral into infinity',
      style: 'surreal',
      title: 'Tree House Dreams',
      description: 'Impossible architecture defying physics',
    },
    {
      id: 'sample_fantasy',
      text: 'A magnificent crystal castle perched on a floating mountain, with phoenixes circling golden spires and waterfalls flowing upward into starlit skies',
      style: 'fantasy',
      title: 'Phoenix Castle',
      description: 'Magical castle with mythical creatures',
    },
    {
      id: 'sample_nightmare',
      text: 'A twisted maze of black mirrors reflecting distorted memories, with shadow figures lurking in corridors that shift and change when not observed',
      style: 'nightmare',
      title: 'Mirror Maze',
      description: 'Dark labyrinth of fears and shadows',
    },
  ];

  res.json({
    samples,
    count: samples.length,
    usage:
      'Use these as inspiration or send the text directly to /api/parse-dream',
  });
});

// Enhanced cache management endpoints
router.get('/cache/stats', (req, res) => {
  try {
    const stats = getCacheStats();

    res.json({
      service: 'Dream Cache',
      stats,
      features: [
        'Performance monitoring with response time tracking',
        'Source-based cache distribution analysis',
        'Age-based cache entry management',
        'Smart invalidation strategies',
        'Automatic cache optimization',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache stats endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      service: 'Dream Cache',
      error: 'Failed to get cache statistics',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/cache/invalidate', (req, res) => {
  try {
    const { strategy, value } = req.body;
    let invalidated = 0;
    let message = '';

    switch (strategy) {
      case 'source':
        invalidated = dreamCache.invalidateBySource(value);
        message = `Invalidated ${invalidated} entries with source: ${value}`;
        break;
      case 'style':
        invalidated = dreamCache.invalidateByStyle(value);
        message = `Invalidated ${invalidated} entries with style: ${value}`;
        break;
      case 'age':
        const maxAge = parseInt(value) || 3600000; // Default 1 hour
        invalidated = dreamCache.invalidateByAge(maxAge);
        message = `Invalidated ${invalidated} entries older than ${maxAge}ms`;
        break;
      case 'failed_ai':
        invalidated = dreamCache.invalidateFailedAI();
        message = `Invalidated ${invalidated} failed AI generation entries`;
        break;
      case 'all':
        clearCache();
        message = 'Cleared entire cache';
        invalidated = 'all';
        break;
      default:
        return res.status(400).json({
          error: 'Invalid invalidation strategy',
          validStrategies: ['source', 'style', 'age', 'failed_ai', 'all'],
          provided: strategy,
        });
    }

    logger.info('Cache invalidation completed via API', {
      strategy,
      value,
      invalidated,
    });

    res.json({
      success: true,
      message,
      strategy,
      value,
      invalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache invalidation endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/cache/optimize', (req, res) => {
  try {
    const optimizations = dreamCache.optimizeCache();

    logger.info('Cache optimization triggered via API', {
      optimizations,
    });

    res.json({
      success: true,
      message: 'Cache optimization completed',
      optimizations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache optimization endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to optimize cache',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/cache/performance', (req, res) => {
  try {
    const stats = getCacheStats();
    const performanceData = {
      hitRate: stats.dreamCache.hitRate,
      averageGetTime: stats.dreamCache.performance.averageGetTime,
      averageSetTime: stats.dreamCache.performance.averageSetTime,
      totalOperations: stats.dreamCache.performance.totalOperations,
      sourceDistribution: stats.dreamCache.sourceDistribution,
      ageDistribution: stats.dreamCache.ageDistribution,
      memoryUsage: stats.dreamCache.memoryUsage,
      cacheEfficiency: {
        hitRateNumeric: parseFloat(stats.dreamCache.hitRate),
        evictionRate: stats.dreamCache.evictions / (stats.dreamCache.sets || 1),
        invalidationRate:
          stats.dreamCache.invalidations / (stats.dreamCache.sets || 1),
      },
      recommendations: generateCacheRecommendations(stats.dreamCache),
    };

    res.json({
      service: 'Cache Performance Monitor',
      performance: performanceData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache performance endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      service: 'Cache Performance Monitor',
      error: 'Failed to get performance data',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Response processor statistics endpoint
router.get('/response-processor/stats', (req, res) => {
  try {
    const stats = responseProcessor.getCacheStats();

    res.json({
      service: 'Response Processor',
      cache: {
        validationCache: stats,
        description: 'Caches validation results to improve performance',
      },
      features: [
        'Enhanced JSON parsing with error detection',
        'Comprehensive response structure validation',
        'Dream schema validation with caching',
        'Detailed logging of processing stages',
        'Error categorization and retry recommendations',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Response processor stats endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      service: 'Response Processor',
      error: 'Failed to get statistics',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Clear response processor cache endpoint
router.post('/response-processor/clear-cache', (req, res) => {
  try {
    const statsBefore = responseProcessor.getCacheStats();
    responseProcessor.clearValidationCache();
    const statsAfter = responseProcessor.getCacheStats();

    logger.info('Response processor cache cleared via API', {
      cacheSizeBefore: statsBefore.size,
      cacheSizeAfter: statsAfter.size,
    });

    res.json({
      success: true,
      message: 'Response processor cache cleared',
      before: statsBefore,
      after: statsAfter,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Response processor cache clear endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test route to verify route registration
router.get('/test-route', (req, res) => {
  res.json({
    message: 'Test route working',
    timestamp: new Date().toISOString(),
  });
});

// Enhanced cache management endpoints
router.get('/cache/stats', (req, res) => {
  res.json({
    service: 'Dream Cache',
    message: 'Cache stats endpoint working',
    timestamp: new Date().toISOString(),
  });
});

router.post('/cache/invalidate', (req, res) => {
  try {
    const { strategy, value } = req.body;
    let invalidated = 0;
    let message = '';

    switch (strategy) {
      case 'source':
        invalidated = dreamCache.invalidateBySource(value);
        message = `Invalidated ${invalidated} entries with source: ${value}`;
        break;
      case 'style':
        invalidated = dreamCache.invalidateByStyle(value);
        message = `Invalidated ${invalidated} entries with style: ${value}`;
        break;
      case 'age':
        const maxAge = parseInt(value) || 3600000; // Default 1 hour
        invalidated = dreamCache.invalidateByAge(maxAge);
        message = `Invalidated ${invalidated} entries older than ${maxAge}ms`;
        break;
      case 'failed_ai':
        invalidated = dreamCache.invalidateFailedAI();
        message = `Invalidated ${invalidated} failed AI generation entries`;
        break;
      case 'all':
        clearCache();
        message = 'Cleared entire cache';
        invalidated = 'all';
        break;
      default:
        return res.status(400).json({
          error: 'Invalid invalidation strategy',
          validStrategies: ['source', 'style', 'age', 'failed_ai', 'all'],
          provided: strategy,
        });
    }

    logger.info('Cache invalidation completed via API', {
      strategy,
      value,
      invalidated,
    });

    res.json({
      success: true,
      message,
      strategy,
      value,
      invalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache invalidation endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/cache/optimize', (req, res) => {
  try {
    const optimizations = dreamCache.optimizeCache();

    logger.info('Cache optimization triggered via API', {
      optimizations,
    });

    res.json({
      success: true,
      message: 'Cache optimization completed',
      optimizations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache optimization endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to optimize cache',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/cache/performance', (req, res) => {
  try {
    const stats = getCacheStats();
    const performanceData = {
      hitRate: stats.dreamCache.hitRate,
      averageGetTime: stats.dreamCache.performance.averageGetTime,
      averageSetTime: stats.dreamCache.performance.averageSetTime,
      totalOperations: stats.dreamCache.performance.totalOperations,
      sourceDistribution: stats.dreamCache.sourceDistribution,
      ageDistribution: stats.dreamCache.ageDistribution,
      memoryUsage: stats.dreamCache.memoryUsage,
      cacheEfficiency: {
        hitRateNumeric: parseFloat(stats.dreamCache.hitRate),
        evictionRate: stats.dreamCache.evictions / (stats.dreamCache.sets || 1),
        invalidationRate:
          stats.dreamCache.invalidations / (stats.dreamCache.sets || 1),
      },
      recommendations: generateCacheRecommendations(stats.dreamCache),
    };

    res.json({
      service: 'Cache Performance Monitor',
      performance: performanceData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache performance endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      service: 'Cache Performance Monitor',
      error: 'Failed to get performance data',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Dream processing performance monitoring endpoint
router.get('/dream-processing/performance', (req, res) => {
  try {
    const performanceSummary = dreamProcessingLogger.getPerformanceSummary();

    res.json({
      service: 'Dream Processing Logger',
      performance: performanceSummary,
      features: [
        'Structured logging for all dream processing stages',
        'Performance metrics tracking with response times',
        'Error context logging with stack traces and request details',
        'Active request monitoring and cleanup',
        'Comprehensive MCP Gateway communication logging',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Dream processing performance endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      service: 'Dream Processing Logger',
      error: 'Failed to get performance summary',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Clean up stale dream processing requests endpoint
router.post('/dream-processing/cleanup', (req, res) => {
  try {
    const { maxAge } = req.body;
    const cleanedCount = dreamProcessingLogger.cleanupStaleRequests(maxAge);

    res.json({
      success: true,
      message: 'Stale request cleanup completed',
      cleanedRequests: cleanedCount,
      maxAge: maxAge || 300000,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Dream processing cleanup endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to cleanup stale requests',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// MCP Gateway health check endpoint
router.get('/mcp-gateway/health', async (req, res) => {
  try {
    const healthCheck = await checkMCPGatewayHealth();
    const circuitBreakerState = getCircuitBreakerState();

    res.status(healthCheck.healthy ? 200 : 503).json({
      service: 'MCP Gateway',
      url: MCP_GATEWAY_URL,
      healthy: healthCheck.healthy,
      status: healthCheck.status,
      responseTime: `${healthCheck.responseTime}ms`,
      timestamp: new Date().toISOString(),
      circuitBreaker: {
        state: circuitBreakerState.state,
        failureCount: circuitBreakerState.failureCount,
        successCount: circuitBreakerState.successCount,
        failureThreshold: circuitBreakerState.failureThreshold,
        timeout: circuitBreakerState.timeout,
        lastFailureTime: circuitBreakerState.lastFailureTime,
        nextAttemptTime: circuitBreakerState.nextAttemptTime,
      },
      retryConfig: RETRY_CONFIG,
      error: healthCheck.error,
    });
  } catch (error) {
    logger.error('Health check endpoint error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      service: 'MCP Gateway',
      healthy: false,
      error: 'Health check failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      circuitBreaker: getCircuitBreakerState(),
    });
  }
});

// Main dream parsing endpoint
router.post('/parse-dream', async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4();

  try {
    const { text, style = 'ethereal', options = {} } = req.body;

    // Input validation
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Dream text is required',
        details: 'Provide a text description of your dream',
        example: 'A floating library with glowing books',
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        error: 'Dream text too long',
        details: 'Maximum 2000 characters allowed',
        currentLength: text.length,
      });
    }

    const validStyles = [
      'ethereal',
      'cyberpunk',
      'surreal',
      'fantasy',
      'nightmare',
    ];
    if (!validStyles.includes(style)) {
      return res.status(400).json({
        error: 'Invalid style',
        details: `Style must be one of: ${validStyles.join(', ')}`,
        provided: style,
      });
    }

    // Initialize structured logging for this request
    dreamProcessingLogger.logProcessingStart(
      requestId,
      text.trim(),
      style,
      options
    );

    // Check cache first
    const cacheKey = hashString(
      `${text.trim()}|${style}|${JSON.stringify(options)}`
    );
    const cachedDream = getFromCache(cacheKey);

    dreamProcessingLogger.logCacheCheck(requestId, cacheKey, !!cachedDream);

    if (cachedDream) {
      const cacheProcessingTime = Date.now() - startTime;

      dreamProcessingLogger.logProcessingComplete(
        requestId,
        cachedDream,
        'cache',
        true,
        { cached: true, totalTime: cacheProcessingTime }
      );

      // Record performance metrics for cached response
      serviceMonitor.recordPerformance(cacheProcessingTime);

      return res.json({
        success: true,
        data: cachedDream,
        cached: true,
        processingTime: cacheProcessingTime,
      });
    }

    let dreamJson = null;
    let source = 'unknown';
    let mcpResponseTime = 0;

    // Try to call MCP Gateway for AI processing with retry logic
    let mcpValidation = null;
    try {
      dreamProcessingLogger.logMCPCallStart(
        requestId,
        `${MCP_GATEWAY_URL}/parse`,
        { text: text.trim(), style, options },
        RETRY_CONFIG
      );

      const mcpResult = await callMCPGatewayWithRetry(
        text.trim(),
        style,
        options
      );
      dreamJson = mcpResult.dreamJson;
      source = mcpResult.source;
      mcpResponseTime = mcpResult.responseTime;
      mcpValidation = mcpResult.validation;

      if (dreamJson) {
        dreamProcessingLogger.logMCPSuccess(
          requestId,
          { status: 200, headers: { get: () => 'application/json' } }, // Mock response for logging
          mcpResponseTime,
          mcpResult
        );
      }
    } catch (mcpError) {
      dreamProcessingLogger.logMCPFailure(
        requestId,
        mcpError,
        mcpError.responseTime || 0,
        mcpError.totalAttempts || 1,
        getCircuitBreakerState().state
      );
      dreamJson = null;
    }

    // Fallback to local generation if MCP failed
    if (!dreamJson) {
      dreamJson = createFallbackDream(text.trim(), style, options);
      source = 'local_fallback';

      dreamProcessingLogger.logFallbackGeneration(
        requestId,
        'MCP Gateway call failed or returned no data',
        'local_fallback',
        dreamJson
      );

      // Record fallback usage in service monitor
      serviceMonitor.recordFallbackUsage(
        'MCP Gateway call failed or returned no data',
        'local_fallback'
      );
    }

    // Validate the generated dream (use MCP validation if available, otherwise validate locally)
    let validation = mcpValidation;

    if (!validation) {
      validation = validateDream(dreamJson);
    }

    dreamProcessingLogger.logDreamValidation(
      requestId,
      dreamJson,
      validation,
      source
    );

    if (!validation.valid) {
      const originalDream = { ...dreamJson };

      // Record validation error
      serviceMonitor.recordError('validation', 'Dream validation failed', null);

      try {
        // Attempt to repair the dream
        dreamJson = repairDream(dreamJson, validation.errors);

        // Re-validate
        const revalidation = validateDream(dreamJson);
        const repairSuccess = revalidation.valid;

        dreamProcessingLogger.logDreamRepair(
          requestId,
          originalDream,
          validation.errors,
          dreamJson,
          repairSuccess
        );

        if (!repairSuccess) {
          dreamJson = createFallbackDream(text.trim(), style, options);
          source = 'safe_fallback';
          dreamProcessingLogger.logFallbackGeneration(
            requestId,
            'Dream repair failed - still has validation errors',
            'safe_fallback',
            dreamJson
          );

          // Record fallback usage in service monitor
          serviceMonitor.recordFallbackUsage(
            'Dream repair failed - still has validation errors',
            'safe_fallback'
          );
        } else {
          source += '_repaired';

          // Record AI repaired usage
          serviceMonitor.recordFallbackUsage(
            'AI response repaired successfully',
            'ai_repaired'
          );
        }
      } catch (repairError) {
        dreamProcessingLogger.logErrorWithContext(
          requestId,
          'dream_repair',
          repairError,
          { originalDreamId: originalDream?.id, source }
        );

        dreamJson = createFallbackDream(text.trim(), style, options);
        source = 'safe_fallback';
        dreamProcessingLogger.logFallbackGeneration(
          requestId,
          'Dream repair threw an error',
          'safe_fallback',
          dreamJson
        );

        // Record fallback usage in service monitor
        serviceMonitor.recordFallbackUsage(
          'Dream repair threw an error',
          'safe_fallback'
        );
      }
    }

    // Ensure required fields
    dreamJson.id = dreamJson.id || uuidv4();
    dreamJson.seed = dreamJson.seed || Math.floor(Math.random() * 1000000);
    dreamJson.created = dreamJson.created || new Date().toISOString();
    dreamJson.originalText = text.trim();
    dreamJson.source = source;

    // Add generation metadata
    dreamJson.metadata = {
      generatedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      source,
      version: '1.0.0',
      originalText: text.trim(),
      requestedStyle: style,
      options,
    };

    // Cache the result with enhanced validation and performance tracking
    try {
      const cacheStartTime = Date.now();

      // Validate dream before caching
      const cacheValidation = validateCachedDream(dreamJson);
      if (!cacheValidation.valid) {
        logger.warn('Dream failed cache validation', {
          dreamId: dreamJson.id,
          reason: cacheValidation.reason,
          source: dreamJson.source,
        });
      }

      // Set appropriate TTL based on source quality
      let cacheTtl = null;
      if (dreamJson.source === 'ai' || dreamJson.source === 'openai') {
        cacheTtl = 24 * 60 * 60 * 1000; // 24 hours for AI-generated dreams
      } else if (dreamJson.source === 'ai_repaired') {
        cacheTtl = 12 * 60 * 60 * 1000; // 12 hours for repaired dreams
      } else {
        cacheTtl = 2 * 60 * 60 * 1000; // 2 hours for fallback dreams
      }

      setToCache(cacheKey, dreamJson, cacheTtl);
      setToCache(dreamJson.id, dreamJson, cacheTtl);

      // Update the all_dreams cache with source-aware management
      const allDreams = getFromCache('all_dreams') || [];
      allDreams.unshift(dreamJson); // Add to beginning

      // Keep more AI-generated dreams, fewer fallback dreams
      const maxDreams =
        dreamJson.source === 'ai' || dreamJson.source === 'openai' ? 150 : 100;
      if (allDreams.length > maxDreams) {
        // Prioritize keeping AI-generated dreams
        const sortedDreams = allDreams.sort((a, b) => {
          const aScore = getSourcePriority(a.source);
          const bScore = getSourcePriority(b.source);
          if (aScore !== bScore) return bScore - aScore;
          return new Date(b.created) - new Date(a.created);
        });
        allDreams.splice(maxDreams);
      }

      setToCache('all_dreams', allDreams, 6 * 60 * 60 * 1000); // 6 hours for dream list

      const cacheTime = Date.now() - cacheStartTime;

      dreamProcessingLogger.logCacheStorage(
        requestId,
        cacheKey,
        dreamJson,
        true
      );

      logger.info('Dream cached successfully', {
        dreamId: dreamJson.id,
        source: dreamJson.source,
        cacheTime: `${cacheTime}ms`,
        ttl: `${cacheTtl}ms`,
        cacheValidation: cacheValidation.valid,
      });
    } catch (cacheError) {
      dreamProcessingLogger.logCacheStorage(
        requestId,
        cacheKey,
        dreamJson,
        false
      );
      dreamProcessingLogger.logErrorWithContext(
        requestId,
        'cache_storage',
        cacheError,
        { dreamId: dreamJson?.id }
      );
    }

    // Log successful completion
    dreamProcessingLogger.logProcessingComplete(
      requestId,
      dreamJson,
      source,
      true,
      {
        mcpResponseTime,
        cached: false,
        totalTime: Date.now() - startTime,
      }
    );

    const finalProcessingTime = Date.now() - startTime;

    // Record performance metrics in service monitor
    serviceMonitor.recordPerformance(finalProcessingTime);

    res.json({
      success: true,
      data: dreamJson,
      metadata: {
        processingTime: finalProcessingTime,
        source,
        cached: false,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log error with comprehensive context
    dreamProcessingLogger.logErrorWithContext(
      requestId,
      'parse_dream_endpoint',
      error,
      {
        textLength: req.body.text?.length,
        style: req.body.style,
        processingTime,
      }
    );

    // Return emergency fallback
    const emergencyFallback = createFallbackDream(
      req.body.text || 'Emergency dream generation',
      req.body.style || 'ethereal'
    );

    emergencyFallback.metadata = {
      error: error.message,
      processingTime,
      source: 'emergency_fallback',
    };

    // Log emergency fallback generation
    dreamProcessingLogger.logFallbackGeneration(
      requestId,
      'Unhandled error in parse-dream endpoint',
      'emergency_fallback',
      emergencyFallback
    );

    // Record emergency fallback usage in service monitor
    serviceMonitor.recordFallbackUsage(
      'Unhandled error in parse-dream endpoint',
      'emergency_fallback'
    );

    // Log failed completion
    dreamProcessingLogger.logProcessingComplete(
      requestId,
      emergencyFallback,
      'emergency_fallback',
      false,
      {
        error: error.message,
        totalTime: processingTime,
      }
    );

    res.status(200).json({
      success: false,
      error: error.message,
      data: emergencyFallback,
      metadata: {
        processingTime,
        source: 'emergency_fallback',
        errorOccurred: true,
      },
    });
  }
});

// Utility functions
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Helper function to get source priority for caching
function getSourcePriority(source) {
  const priorities = {
    ai: 5,
    openai: 5,
    cerebras: 4,
    ai_repaired: 3,
    local_fallback: 2,
    safe_fallback: 1,
    emergency_fallback: 0,
  };
  return priorities[source] || 0;
}

// Generate cache performance recommendations
function generateCacheRecommendations(cacheStats) {
  const recommendations = [];
  const hitRate = parseFloat(cacheStats.hitRate);
  const sourceDistribution = cacheStats.sourceDistribution || {};

  if (hitRate < 50) {
    recommendations.push({
      type: 'performance',
      message:
        'Low cache hit rate detected. Consider increasing cache size or TTL.',
      priority: 'high',
    });
  }

  const failedSources = [
    'safe_fallback',
    'emergency_fallback',
    'local_fallback',
  ];
  const failedCount = failedSources.reduce(
    (sum, source) => sum + (sourceDistribution[source] || 0),
    0
  );
  const totalCached = Object.values(sourceDistribution).reduce(
    (sum, count) => sum + count,
    0
  );

  if (totalCached > 0 && failedCount / totalCached > 0.3) {
    recommendations.push({
      type: 'quality',
      message:
        'High proportion of fallback dreams in cache. Consider invalidating failed AI generations.',
      priority: 'medium',
    });
  }

  if (cacheStats.evictions > cacheStats.sets * 0.1) {
    recommendations.push({
      type: 'capacity',
      message: 'High eviction rate detected. Consider increasing cache size.',
      priority: 'medium',
    });
  }

  const avgGetTime = parseFloat(cacheStats.performance.averageGetTime);
  if (avgGetTime > 10) {
    recommendations.push({
      type: 'performance',
      message: 'Slow cache get operations. Consider cache optimization.',
      priority: 'low',
    });
  }

  return recommendations;
}

function repairDream(dreamJson, errors) {
  logger.info('REPAIR FUNCTION CALLED - START', {
    dreamId: dreamJson?.id,
    errorCount: errors?.length,
    hasErrors: !!errors,
  });

  const repaired = { ...dreamJson };

  logger.info('Attempting to repair dream', {
    dreamId: dreamJson.id,
    errorCount: errors.length,
    errors: errors.slice(0, 5), // Log first 5 errors
  });

  // Fix missing required fields
  repaired.id = repaired.id || uuidv4();
  repaired.title = repaired.title || 'Repaired Dream';
  repaired.style = repaired.style || 'ethereal';

  // Ensure valid style enum
  const validStyles = [
    'ethereal',
    'cyberpunk',
    'surreal',
    'fantasy',
    'nightmare',
  ];
  if (!validStyles.includes(repaired.style)) {
    repaired.style = 'ethereal';
  }

  // Ensure arrays exist
  repaired.structures = Array.isArray(repaired.structures)
    ? repaired.structures
    : [];
  repaired.entities = Array.isArray(repaired.entities) ? repaired.entities : [];
  repaired.assumptions = Array.isArray(repaired.assumptions)
    ? repaired.assumptions
    : [];

  // Fix environment preset enum values
  if (repaired.environment && repaired.environment.preset) {
    const validPresets = ['dawn', 'dusk', 'night', 'void', 'underwater'];
    const presetMappings = {
      morning: 'dawn',
      sunrise: 'dawn',
      evening: 'dusk',
      sunset: 'dusk',
      midnight: 'night',
      dark: 'night',
      space: 'void',
      ocean: 'underwater',
      sea: 'underwater',
      water: 'underwater',
    };

    if (!validPresets.includes(repaired.environment.preset)) {
      const mapped = presetMappings[repaired.environment.preset.toLowerCase()];
      repaired.environment.preset = mapped || 'dusk';
      logger.info('Repaired environment preset', {
        original: dreamJson.environment.preset,
        repaired: repaired.environment.preset,
      });
    }
  }

  // Fix structure template enum values
  const validTemplates = [
    'floating_library',
    'crystal_tower',
    'twisted_house',
    'portal_arch',
    'floating_island',
    'infinite_staircase',
  ];
  const templateMappings = {
    library: 'floating_library',
    tower: 'crystal_tower',
    spire: 'crystal_tower',
    house: 'twisted_house',
    building: 'twisted_house',
    portal: 'portal_arch',
    arch: 'portal_arch',
    gate: 'portal_arch',
    island: 'floating_island',
    platform: 'floating_island',
    stairs: 'infinite_staircase',
    staircase: 'infinite_staircase',
    steps: 'infinite_staircase',
  };

  repaired.structures.forEach((structure, index) => {
    if (structure.template && !validTemplates.includes(structure.template)) {
      const mapped = templateMappings[structure.template.toLowerCase()];
      const original = structure.template;
      structure.template = mapped || 'floating_library';
      logger.info('Repaired structure template', {
        index,
        original,
        repaired: structure.template,
      });
    }

    // Ensure features is an array
    if (structure.features && !Array.isArray(structure.features)) {
      structure.features =
        typeof structure.features === 'string' ? [structure.features] : [];
    }

    // Ensure rotation is an array of 3 numbers
    if (structure.rotation !== undefined) {
      logger.info('Checking structure rotation', {
        index,
        rotation: structure.rotation,
        type: typeof structure.rotation,
        isArray: Array.isArray(structure.rotation),
      });

      if (!Array.isArray(structure.rotation)) {
        const original = structure.rotation;
        structure.rotation = [0, 0, 0];
        logger.info('Repaired structure rotation (not array)', {
          index,
          original,
          repaired: structure.rotation,
        });
      } else if (structure.rotation.length !== 3) {
        const original = [...structure.rotation];
        structure.rotation = [
          structure.rotation[0] || 0,
          structure.rotation[1] || 0,
          structure.rotation[2] || 0,
        ];
        logger.info('Repaired structure rotation (wrong length)', {
          index,
          original,
          repaired: structure.rotation,
        });
      }
    } else {
      // Add default rotation if missing
      structure.rotation = [0, 0, 0];
      logger.info('Added default rotation', {
        index,
        rotation: structure.rotation,
      });
    }
  });

  // Fix entity type enum values
  const validEntityTypes = [
    'book_swarm',
    'floating_orbs',
    'particle_stream',
    'shadow_figures',
    'light_butterflies',
    'memory_fragments',
  ];
  const entityMappings = {
    books: 'book_swarm',
    orbs: 'floating_orbs',
    spheres: 'floating_orbs',
    balls: 'floating_orbs',
    particles: 'particle_stream',
    dust: 'particle_stream',
    shadows: 'shadow_figures',
    figures: 'shadow_figures',
    butterflies: 'light_butterflies',
    moths: 'light_butterflies',
    insects: 'light_butterflies',
    memories: 'memory_fragments',
    fragments: 'memory_fragments',
    pieces: 'memory_fragments',
  };

  repaired.entities.forEach((entity, index) => {
    if (entity.type && !validEntityTypes.includes(entity.type)) {
      const mapped = entityMappings[entity.type.toLowerCase()];
      const original = entity.type;
      entity.type = mapped || 'floating_orbs';
      logger.info('Repaired entity type', {
        index,
        original,
        repaired: entity.type,
      });
    }

    // Fix entity params
    if (entity.params) {
      // Ensure size is a number
      if (entity.params.size && typeof entity.params.size !== 'number') {
        entity.params.size = parseFloat(entity.params.size) || 1.0;
      }

      // Ensure color is a valid hex color
      if (entity.params.color && typeof entity.params.color === 'string') {
        if (!entity.params.color.match(/^#[0-9a-fA-F]{6}$/)) {
          // Try to fix common color formats
          let color = entity.params.color.toLowerCase();
          if (color.startsWith('#') && color.length === 4) {
            // Convert #RGB to #RRGGBB
            color =
              '#' +
              color[1] +
              color[1] +
              color[2] +
              color[2] +
              color[3] +
              color[3];
          } else if (!color.startsWith('#')) {
            // Add # prefix if missing
            color = '#' + color;
          }

          // If still invalid, use default colors
          if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
            color = '#ffffff'; // Default to white
          }

          entity.params.color = color;
          logger.info('Repaired entity color', {
            index,
            original: entity.params.color,
            repaired: color,
          });
        }
      }

      // Ensure other numeric params are numbers
      ['speed', 'glow'].forEach((param) => {
        if (entity.params[param] && typeof entity.params[param] !== 'number') {
          entity.params[param] = parseFloat(entity.params[param]) || 1.0;
        }
      });
    }
  });

  // Fix cinematography shot types
  const validShotTypes = [
    'establish',
    'flythrough',
    'orbit',
    'close_up',
    'pull_back',
    'dolly_zoom',
    'spiral',
    'tracking',
  ];
  const shotMappings = {
    establishing: 'establish',
    wide: 'establish',
    overview: 'establish',
    fly: 'flythrough',
    flight: 'flythrough',
    circle: 'orbit',
    around: 'orbit',
    closeup: 'close_up',
    close: 'close_up',
    zoom_out: 'pull_back',
    pullback: 'pull_back',
    zoom: 'dolly_zoom',
    dolly: 'dolly_zoom',
    spin: 'spiral',
    rotate: 'spiral',
    follow: 'tracking',
    track: 'tracking',
  };

  // Add default cinematography if missing
  if (!repaired.cinematography || !repaired.cinematography.shots) {
    repaired.cinematography = {
      durationSec: 30,
      shots: [
        {
          type: 'establish',
          target: repaired.structures[0]?.id || 's1',
          duration: 30,
          startPos: [0, 30, 50],
          endPos: [0, 15, -20],
        },
      ],
    };
  } else {
    // Fix existing shot types
    repaired.cinematography.shots.forEach((shot, index) => {
      if (shot.type && !validShotTypes.includes(shot.type)) {
        const mapped = shotMappings[shot.type.toLowerCase()];
        const original = shot.type;
        shot.type = mapped || 'establish';
        logger.info('Repaired shot type', {
          index,
          original,
          repaired: shot.type,
        });
      }
    });
  }

  // Add repair note
  repaired.assumptions = repaired.assumptions || [];
  repaired.assumptions.push(
    'Dream automatically repaired due to validation errors'
  );

  logger.info('Dream repair completed', {
    dreamId: repaired.id,
    structuresRepaired: repaired.structures.length,
    entitiesRepaired: repaired.entities.length,
    shotsRepaired: repaired.cinematography?.shots?.length || 0,
  });

  return repaired;
}

module.exports = router;
