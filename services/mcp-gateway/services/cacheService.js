// services/cacheService.js
// Integration service for enhanced caching system

const ResponseCache = require('../engine/ResponseCache');
const CacheManager = require('../utils/CacheManager');
const { logger, EnhancedLogger } = require('../utils/Logger');

class CacheService {
  constructor(config = {}) {
    this.config = {
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      defaultTtl: parseInt(
        config.defaultTtl || process.env.CACHE_DEFAULT_TTL || '3600'
      ),
      maxCacheSize: parseInt(
        config.maxCacheSize || process.env.CACHE_MAX_SIZE || '10000'
      ),
      enableSemanticSimilarity:
        (config.enableSemanticSimilarity ||
          process.env.CACHE_ENABLE_SEMANTIC_SIMILARITY ||
          'true') === 'true',
      ...config,
    };

    this.responseCache = null;
    this.cacheManager = null;
    this.initialized = false;
  }

  // Initialize the caching system
  async initialize() {
    try {
      logger.info('Initializing enhanced caching system...');

      // Initialize ResponseCache
      this.responseCache = new ResponseCache(this.config);

      // Wait a moment for Redis connection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Initialize CacheManager
      this.cacheManager = new CacheManager(this.responseCache);

      this.initialized = true;
      logger.info('Enhanced caching system initialized successfully');

      // Log initial stats
      const stats = this.responseCache.getStats();
      logger.info('Cache system ready:', {
        backend: stats.backend,
        semantic_similarity: this.config.enableSemanticSimilarity,
        default_ttl: this.config.defaultTtl,
      });
    } catch (error) {
      logger.error('Failed to initialize caching system:', error);
      this.initialized = false;
      throw error;
    }
  }

  // Get cached dream response
  async getCachedDream(prompt, options = {}) {
    if (!this.initialized) {
      logger.warn('Cache service not initialized, skipping cache lookup');
      return null;
    }

    try {
      const cacheKey = this.responseCache.generateCacheKey(prompt, options);
      const cached = await this.responseCache.get(cacheKey, {
        prompt,
        ...options,
      });

      if (cached) {
        // Update access metadata
        if (cached.cacheMetadata) {
          cached.cacheMetadata.lastAccessed = Date.now();
          cached.cacheMetadata.accessCount =
            (cached.cacheMetadata.accessCount || 0) + 1;
        }

        logger.debug(
          `Cache hit for dream prompt: ${prompt.substring(0, 50)}...`
        );
        return cached;
      }

      return null;
    } catch (error) {
      logger.error('Error retrieving cached dream:', error);
      return null;
    }
  }

  // Cache dream response
  async cacheDreamResponse(prompt, response, options = {}) {
    if (!this.initialized) {
      logger.warn('Cache service not initialized, skipping cache storage');
      return false;
    }

    try {
      const cacheKey = this.responseCache.generateCacheKey(prompt, options);

      // Add original prompt to response for semantic similarity
      const enhancedResponse = {
        ...response,
        originalPrompt: prompt,
        cacheKey: cacheKey,
      };

      // Determine TTL based on quality and options
      const customTtl = this.calculateTtl(response, options);

      const success = await this.responseCache.set(
        cacheKey,
        enhancedResponse,
        customTtl
      );

      if (success) {
        logger.debug(`Cached dream response: ${prompt.substring(0, 50)}...`);
      }

      return success;
    } catch (error) {
      logger.error('Error caching dream response:', error);
      return false;
    }
  }

  // Calculate appropriate TTL based on response quality and options
  calculateTtl(response, options) {
    const quality = response.metadata?.quality || options.quality || 'standard';
    const confidence = response.metadata?.confidence || 1;

    // Base TTL from quality tiers
    const baseTtl =
      this.responseCache.qualityTiers[quality]?.ttl || this.config.defaultTtl;

    // Adjust based on confidence
    let adjustedTtl = baseTtl;
    if (confidence < 0.5) {
      adjustedTtl = Math.floor(baseTtl * 0.5); // Reduce TTL for low confidence
    } else if (confidence > 0.9) {
      adjustedTtl = Math.floor(baseTtl * 1.5); // Increase TTL for high confidence
    }

    // Respect custom TTL if provided
    return options.customTtl || adjustedTtl;
  }

  // Process user feedback for cache management
  async processFeedback(dreamId, feedback) {
    if (!this.initialized || !this.cacheManager) {
      return;
    }

    try {
      await this.cacheManager.processFeedback(dreamId, feedback);
      logger.debug(`Processed feedback for dream ${dreamId}`);
    } catch (error) {
      logger.error('Error processing feedback:', error);
    }
  }

  // Handle content updates that may affect cache
  async handleContentUpdate(updateType, context = {}) {
    if (!this.initialized || !this.cacheManager) {
      return;
    }

    try {
      await this.cacheManager.processContentUpdate(updateType, context);
      logger.debug(`Processed content update: ${updateType}`);
    } catch (error) {
      logger.error('Error handling content update:', error);
    }
  }

  // Warm cache with popular patterns
  async warmCache(patterns = null) {
    if (!this.initialized) {
      logger.warn('Cache service not initialized, skipping cache warming');
      return { success: 0, failed: 0, skipped: 0 };
    }

    try {
      if (!patterns) {
        // Use popular patterns from cache
        await this.responseCache.warmCache();
        return { success: 1, failed: 0, skipped: 0 };
      } else {
        return await this.cacheManager.warmCacheForPatterns(patterns);
      }
    } catch (error) {
      logger.error('Error warming cache:', error);
      return { success: 0, failed: patterns?.length || 1, skipped: 0 };
    }
  }

  // Get cache statistics
  getStats() {
    if (!this.initialized) {
      return {
        initialized: false,
        backend: 'none',
        hit_rate: 0,
        miss_rate: 0,
      };
    }

    const stats = this.responseCache.getStats();
    return {
      ...stats,
      initialized: true,
      config: {
        redis_url: this.config.redisUrl ? 'configured' : 'not configured',
        semantic_similarity: this.config.enableSemanticSimilarity,
        default_ttl: this.config.defaultTtl,
        max_size: this.config.maxCacheSize,
      },
    };
  }

  // Get detailed analytics
  async getAnalytics() {
    if (!this.initialized || !this.cacheManager) {
      return null;
    }

    try {
      return await this.cacheManager.generateAnalyticsReport();
    } catch (error) {
      logger.error('Error getting cache analytics:', error);
      return null;
    }
  }

  // Get cache health status
  async getHealthStatus() {
    if (!this.initialized || !this.cacheManager) {
      return {
        status: 'not_initialized',
        issues: ['Cache service not initialized'],
        metrics: {},
      };
    }

    try {
      return await this.cacheManager.getHealthStatus();
    } catch (error) {
      logger.error('Error checking cache health:', error);
      return {
        status: 'error',
        issues: ['Failed to check cache health'],
        metrics: {},
      };
    }
  }

  // Invalidate cache entries
  async invalidateCache(pattern = '*') {
    if (!this.initialized) {
      logger.warn('Cache service not initialized, cannot invalidate cache');
      return false;
    }

    try {
      const success = await this.responseCache.invalidate(pattern);
      logger.info(
        `Cache invalidation ${
          success ? 'successful' : 'failed'
        } for pattern: ${pattern}`
      );
      return success;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return false;
    }
  }

  // Perform manual cache cleanup
  async performCleanup() {
    if (!this.initialized || !this.cacheManager) {
      logger.warn('Cache service not initialized, cannot perform cleanup');
      return 0;
    }

    try {
      const cleanedCount = await this.cacheManager.performSmartCleanup();
      logger.info(
        `Manual cache cleanup completed. Removed ${cleanedCount} entries.`
      );
      return cleanedCount;
    } catch (error) {
      logger.error('Error performing cache cleanup:', error);
      return 0;
    }
  }

  // Check if caching is available
  isAvailable() {
    return this.initialized && this.responseCache !== null;
  }

  // Get cache configuration
  getConfig() {
    return {
      ...this.config,
      initialized: this.initialized,
      available: this.isAvailable(),
    };
  }

  // Cleanup method
  async cleanup() {
    try {
      if (this.cacheManager) {
        await this.cacheManager.cleanup();
      }

      if (this.responseCache) {
        await this.responseCache.cleanup();
      }

      this.initialized = false;
      logger.info('Cache service cleanup completed');
    } catch (error) {
      logger.error('Error during cache service cleanup:', error);
    }
  }
}

// Export singleton instance
let cacheServiceInstance = null;

function getCacheService(config = {}) {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(config);
  }
  return cacheServiceInstance;
}

module.exports = {
  CacheService,
  getCacheService,
};
