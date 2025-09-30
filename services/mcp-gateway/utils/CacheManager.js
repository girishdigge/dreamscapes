// utils/CacheManager.js
// Cache invalidation and management utilities

const { logger, EnhancedLogger } = require('./Logger');

class CacheManager {
  constructor(responseCache) {
    this.cache = responseCache;
    this.invalidationRules = new Map();
    this.cleanupInterval = null;
    this.analyticsInterval = null;

    this.config = {
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      analyticsIntervalMs: 15 * 60 * 1000, // 15 minutes
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
      lowQualityTtl: 30 * 60, // 30 minutes for low quality
      feedbackThreshold: 0.3, // Invalidate if feedback score < 0.3
    };

    this.setupInvalidationRules();
    this.startBackgroundTasks();
  }

  // Setup automatic invalidation rules
  setupInvalidationRules() {
    // Rule 1: Invalidate based on user feedback
    this.invalidationRules.set('user_feedback', {
      condition: (feedback) => feedback.rating < this.config.feedbackThreshold,
      action: async (context) => {
        const pattern = `dream:*${context.dreamId}*`;
        await this.cache.invalidate(pattern);
        logger.info(
          `Invalidated cache for dream ${context.dreamId} due to poor feedback`
        );
      },
    });

    // Rule 2: Invalidate low quality content more aggressively
    this.invalidationRules.set('quality_based', {
      condition: (metadata) =>
        metadata.quality === 'draft' && metadata.confidence < 0.5,
      action: async (context) => {
        const pattern = `dream:*${context.cacheKey}*`;
        await this.cache.invalidate(pattern);
        logger.info(`Invalidated low quality cache entry: ${context.cacheKey}`);
      },
    });

    // Rule 3: Invalidate based on content updates
    this.invalidationRules.set('content_update', {
      condition: (update) =>
        update.type === 'model_update' ||
        update.type === 'prompt_template_update',
      action: async (context) => {
        const pattern = context.affectedPattern || 'dream:*';
        await this.cache.invalidate(pattern);
        logger.info(
          `Invalidated cache due to content update: ${
            context.update?.type || 'unknown'
          }`
        );
      },
    });

    // Rule 4: Invalidate stale high-frequency patterns
    this.invalidationRules.set('stale_patterns', {
      condition: (pattern) => {
        const age = Date.now() - pattern.lastSeen;
        return age > this.config.maxCacheAge && pattern.count < 5;
      },
      action: async (context) => {
        await this.cache.invalidate(`dream:*${context.pattern}*`);
        logger.info(`Invalidated stale pattern: ${context.pattern}`);
      },
    });
  }

  // Process user feedback for cache invalidation
  async processFeedback(dreamId, feedback) {
    try {
      const rule = this.invalidationRules.get('user_feedback');

      if (rule.condition(feedback)) {
        await rule.action({ dreamId, feedback });

        // Also track negative feedback patterns
        await this.trackNegativeFeedback(dreamId, feedback);
      }

      logger.debug(`Processed feedback for dream ${dreamId}:`, feedback);
    } catch (error) {
      logger.error('Error processing feedback for cache invalidation:', error);
    }
  }

  // Track negative feedback patterns
  async trackNegativeFeedback(dreamId, feedback) {
    // This could be used to improve future caching decisions
    const pattern = `negative_feedback:${dreamId}`;

    // Store feedback data for analysis
    if (this.cache.client) {
      await this.cache.client.setEx(
        pattern,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          dreamId,
          feedback,
          timestamp: Date.now(),
        })
      );
    }
  }

  // Process content updates that should trigger invalidation
  async processContentUpdate(updateType, context = {}) {
    try {
      const rule = this.invalidationRules.get('content_update');
      const update = { type: updateType, ...context };

      if (rule.condition(update)) {
        await rule.action({ ...context, update });
      }

      logger.debug(`Processed content update: ${updateType}`);
    } catch (error) {
      logger.error(
        'Error processing content update for cache invalidation:',
        error
      );
    }
  }

  // Smart cache cleanup based on usage patterns and quality
  async performSmartCleanup() {
    try {
      logger.info('Starting smart cache cleanup...');

      const stats = await this.cache.getAnalytics();
      let cleanedCount = 0;

      // Clean up based on quality and age
      if (this.cache.client) {
        const keys = await this.cache.client.keys('dream:*');

        for (const key of keys) {
          const cached = await this.cache.client.get(key);
          if (!cached) continue;

          try {
            const entry = JSON.parse(cached);
            const metadata = entry.cacheMetadata || {};

            // Check if entry should be cleaned up
            if (this.shouldCleanupEntry(metadata, entry)) {
              await this.cache.client.del(key);
              cleanedCount++;
            }
          } catch (parseError) {
            // Remove corrupted entries
            await this.cache.client.del(key);
            cleanedCount++;
          }
        }
      } else {
        // Cleanup in-memory cache
        for (const [key, entry] of this.cache.fallbackCache) {
          const metadata = entry.cacheMetadata || {};

          if (this.shouldCleanupEntry(metadata, entry)) {
            this.cache.fallbackCache.delete(key);
            cleanedCount++;
          }
        }
      }

      logger.info(`Smart cleanup completed. Removed ${cleanedCount} entries.`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error during smart cache cleanup:', error);
      return 0;
    }
  }

  // Determine if a cache entry should be cleaned up
  shouldCleanupEntry(metadata, entry) {
    const now = Date.now();
    const age = now - (metadata.cachedAt || 0);
    const accessCount = metadata.accessCount || 0;
    const quality = metadata.quality || 'standard';

    // Remove very old entries
    if (age > this.config.maxCacheAge) {
      return true;
    }

    // Remove low quality entries that haven't been accessed
    if (
      quality === 'draft' &&
      accessCount === 0 &&
      age > this.config.lowQualityTtl * 1000
    ) {
      return true;
    }

    // Remove entries with very low confidence that haven't been accessed
    const confidence = entry.metadata?.confidence || 1;
    if (confidence < 0.3 && accessCount === 0 && age > 60 * 60 * 1000) {
      // 1 hour
      return true;
    }

    return false;
  }

  // Get cache size and manage limits
  async manageCacheSize() {
    try {
      const stats = this.cache.getStats();

      if (stats.backend === 'memory') {
        const currentSize = stats.cache_size;
        const maxSize = this.cache.config.maxCacheSize;

        if (currentSize > maxSize * 0.9) {
          // 90% full
          logger.warn(`Cache approaching limit: ${currentSize}/${maxSize}`);

          // Trigger aggressive cleanup
          const cleaned = await this.performSmartCleanup();
          logger.info(`Aggressive cleanup removed ${cleaned} entries`);
        }
      }

      return stats;
    } catch (error) {
      logger.error('Error managing cache size:', error);
      return null;
    }
  }

  // Generate cache analytics report
  async generateAnalyticsReport() {
    try {
      const analytics = await this.cache.getAnalytics();
      const timestamp = new Date().toISOString();

      const report = {
        timestamp,
        cache_performance: {
          hit_rate: analytics.hit_rate,
          miss_rate: analytics.miss_rate,
          total_requests: analytics.hits + analytics.misses,
          efficiency_rating: analytics.performance_metrics.cache_efficiency,
        },
        storage_info: {
          backend: analytics.backend,
          size: analytics.cache_size,
          memory_usage: analytics.cache_info.memory_usage || 'N/A',
        },
        content_analysis: {
          quality_distribution: analytics.quality_distribution,
          popular_patterns: analytics.top_patterns,
          total_patterns: analytics.popular_patterns,
        },
        operational_metrics: {
          total_sets: analytics.sets,
          total_invalidations: analytics.invalidations,
          error_count: analytics.errors,
          avg_response_time: analytics.performance_metrics.avg_response_time,
        },
        recommendations: this.generateRecommendations(analytics),
      };

      logger.info('Cache analytics report generated:', {
        hit_rate: report.cache_performance.hit_rate,
        efficiency: report.cache_performance.efficiency_rating,
        backend: report.storage_info.backend,
      });

      return report;
    } catch (error) {
      logger.error('Error generating analytics report:', error);
      return null;
    }
  }

  // Generate recommendations based on analytics
  generateRecommendations(analytics) {
    const recommendations = [];

    // Hit rate recommendations
    if (analytics.hit_rate < 0.5) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message:
          'Low cache hit rate detected. Consider adjusting TTL values or improving cache key generation.',
      });
    }

    // Backend recommendations
    if (analytics.backend === 'memory' && analytics.cache_size > 5000) {
      recommendations.push({
        type: 'infrastructure',
        priority: 'medium',
        message:
          'Large in-memory cache detected. Consider enabling Redis for better performance and persistence.',
      });
    }

    // Quality distribution recommendations
    const qualityDist = analytics.quality_distribution;
    const totalQuality = Object.values(qualityDist).reduce((a, b) => a + b, 0);

    if (totalQuality > 0 && qualityDist.draft / totalQuality > 0.6) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        message:
          'High proportion of draft quality content. Consider improving AI model parameters or prompt engineering.',
      });
    }

    // Error rate recommendations
    if (analytics.errors > analytics.hits * 0.1) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message:
          'High error rate detected in cache operations. Check Redis connectivity and error logs.',
      });
    }

    return recommendations;
  }

  // Start background maintenance tasks
  startBackgroundTasks() {
    // Cleanup task
    this.cleanupInterval = setInterval(async () => {
      await this.performSmartCleanup();
      await this.manageCacheSize();
    }, this.config.cleanupIntervalMs);

    // Analytics task
    this.analyticsInterval = setInterval(async () => {
      const report = await this.generateAnalyticsReport();
      if (report) {
        // Could send to monitoring system or store for later analysis
        logger.debug('Periodic analytics report generated');
      }
    }, this.config.analyticsIntervalMs);

    logger.info('Cache management background tasks started');
  }

  // Stop background tasks
  stopBackgroundTasks() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }

    logger.info('Cache management background tasks stopped');
  }

  // Manual cache warming for specific patterns
  async warmCacheForPatterns(patterns, options = {}) {
    try {
      logger.info(`Starting cache warming for ${patterns.length} patterns`);

      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
      };

      for (const pattern of patterns) {
        try {
          // Check if pattern already cached
          const cacheKey = this.cache.generateCacheKey(pattern, options);
          const existing = await this.cache.get(cacheKey);

          if (existing) {
            results.skipped++;
            continue;
          }

          // This would typically trigger actual content generation
          // For now, we just log the warming intent
          logger.debug(`Would warm cache for pattern: ${pattern}`);
          results.success++;
        } catch (error) {
          logger.warn(
            `Failed to warm cache for pattern "${pattern}":`,
            error.message
          );
          results.failed++;
        }
      }

      logger.info('Cache warming completed:', results);
      return results;
    } catch (error) {
      logger.error('Error during cache warming:', error);
      return { success: 0, failed: patterns.length, skipped: 0 };
    }
  }

  // Get cache health status
  async getHealthStatus() {
    try {
      const stats = this.cache.getStats();
      const analytics = await this.cache.getAnalytics();

      const health = {
        status: 'healthy',
        issues: [],
        metrics: {
          hit_rate: stats.hit_rate,
          error_rate:
            stats.errors / (stats.hits + stats.misses + stats.errors) || 0,
          backend_status: stats.backend,
          cache_size: stats.cache_size,
        },
      };

      // Check for issues
      if (health.metrics.hit_rate < 0.3) {
        health.status = 'degraded';
        health.issues.push('Low cache hit rate');
      }

      if (health.metrics.error_rate > 0.1) {
        health.status = 'degraded';
        health.issues.push('High error rate');
      }

      if (stats.backend === 'memory' && stats.cache_size > 8000) {
        health.status = 'warning';
        health.issues.push('Large in-memory cache - consider Redis');
      }

      if (health.issues.length === 0) {
        health.status = 'healthy';
      }

      return health;
    } catch (error) {
      logger.error('Error checking cache health:', error);
      return {
        status: 'error',
        issues: ['Failed to check cache health'],
        metrics: {},
      };
    }
  }

  // Cleanup method
  async cleanup() {
    this.stopBackgroundTasks();
    this.invalidationRules.clear();
  }
}

module.exports = CacheManager;
