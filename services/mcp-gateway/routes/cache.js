// routes/cache.js
// API endpoints for cache management and monitoring

const express = require('express');
const { getCacheService } = require('../services/cacheService');
const { logger, EnhancedLogger } = require('../utils/Logger');

const router = express.Router();

// Get cache statistics
router.get('/stats', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const stats = cacheService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics',
      message: error.message,
    });
  }
});

// Get detailed cache analytics
router.get('/analytics', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const analytics = await cacheService.getAnalytics();

    if (!analytics) {
      return res.status(503).json({
        success: false,
        error: 'Cache analytics not available',
        message: 'Cache service may not be initialized',
      });
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error getting cache analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache analytics',
      message: error.message,
    });
  }
});

// Get cache health status
router.get('/health', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const health = await cacheService.getHealthStatus();

    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'warning' || health.status === 'degraded'
        ? 200
        : 503;

    res.status(statusCode).json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error checking cache health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check cache health',
      message: error.message,
    });
  }
});

// Get cache configuration
router.get('/config', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const config = cacheService.getConfig();

    // Remove sensitive information
    const safeConfig = {
      ...config,
      redisUrl: config.redisUrl ? 'configured' : 'not configured',
    };

    res.json({
      success: true,
      data: safeConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache configuration',
      message: error.message,
    });
  }
});

// Invalidate cache entries
router.post('/invalidate', async (req, res) => {
  try {
    const { pattern = '*', reason } = req.body;

    const cacheService = getCacheService();
    const success = await cacheService.invalidateCache(pattern);

    if (success) {
      logger.info(
        `Cache invalidated via API - Pattern: ${pattern}, Reason: ${
          reason || 'Manual'
        }`
      );
      res.json({
        success: true,
        message: `Cache invalidated for pattern: ${pattern}`,
        pattern,
        reason: reason || 'Manual invalidation',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache',
        pattern,
      });
    }
  } catch (error) {
    logger.error('Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      message: error.message,
    });
  }
});

// Perform manual cache cleanup
router.post('/cleanup', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const cleanedCount = await cacheService.performCleanup();

    res.json({
      success: true,
      message: `Cache cleanup completed`,
      cleaned_entries: cleanedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error performing cache cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform cache cleanup',
      message: error.message,
    });
  }
});

// Warm cache with patterns
router.post('/warm', async (req, res) => {
  try {
    const { patterns, options = {} } = req.body;

    if (!patterns || !Array.isArray(patterns)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'patterns array is required',
      });
    }

    const cacheService = getCacheService();
    const results = await cacheService.warmCache(patterns);

    res.json({
      success: true,
      message: 'Cache warming completed',
      results,
      patterns_count: patterns.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error warming cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm cache',
      message: error.message,
    });
  }
});

// Process user feedback for cache management
router.post('/feedback', async (req, res) => {
  try {
    const { dreamId, feedback } = req.body;

    if (!dreamId || !feedback) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'dreamId and feedback are required',
      });
    }

    const cacheService = getCacheService();
    await cacheService.processFeedback(dreamId, feedback);

    res.json({
      success: true,
      message: 'Feedback processed for cache management',
      dreamId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error processing feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback',
      message: error.message,
    });
  }
});

// Handle content updates
router.post('/content-update', async (req, res) => {
  try {
    const { updateType, context = {} } = req.body;

    if (!updateType) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'updateType is required',
      });
    }

    const cacheService = getCacheService();
    await cacheService.handleContentUpdate(updateType, context);

    res.json({
      success: true,
      message: 'Content update processed',
      updateType,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error handling content update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle content update',
      message: error.message,
    });
  }
});

// Get popular cache patterns
router.get('/patterns', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const cacheService = getCacheService();

    if (!cacheService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Cache service not available',
      });
    }

    const stats = cacheService.getStats();
    const patterns = stats.top_patterns || [];

    res.json({
      success: true,
      data: {
        patterns: patterns.slice(0, parseInt(limit)),
        total_patterns: stats.popular_patterns || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting cache patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache patterns',
      message: error.message,
    });
  }
});

module.exports = router;
