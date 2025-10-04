// engine/ResponseCache.js
// Enhanced intelligent response caching system with Redis backend

const redis = require('redis');
const crypto = require('crypto');
const { logger, EnhancedLogger } = require('../utils/Logger');

class ResponseCache {
  constructor(config = {}) {
    this.config = {
      redisUrl:
        config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTtl: config.defaultTtl || 3600, // 1 hour default
      maxCacheSize: config.maxCacheSize || 10000,
      enableSemanticSimilarity: config.enableSemanticSimilarity !== false,
      similarityThreshold: config.similarityThreshold || 0.85,
      connectionTimeout: config.connectionTimeout || 2000, // 2 seconds default for tests
      ...config,
    };

    this.client = null;
    this.fallbackCache = new Map(); // In-memory fallback
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
    };

    this.qualityTiers = {
      draft: { ttl: 1800, priority: 1 }, // 30 minutes
      standard: { ttl: 3600, priority: 2 }, // 1 hour
      high: { ttl: 7200, priority: 3 }, // 2 hours
      cinematic: { ttl: 14400, priority: 4 }, // 4 hours
    };

    this.popularPatterns = new Map(); // Track popular dream patterns
    this.initializeRedis();
  }

  async initializeRedis() {
    // Skip Redis initialization if no URL provided
    if (!this.config.redisUrl) {
      logger.info('No Redis URL provided, using in-memory cache');
      this.client = null;
      return;
    }

    try {
      this.client = redis.createClient({
        url: this.config.redisUrl,
        socket: {
          connectTimeout: this.config.connectionTimeout,
          commandTimeout: this.config.connectionTimeout,
        },
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.warn('Redis connection refused, using fallback cache');
            return undefined; // Don't retry
          }
          if (options.total_retry_time > this.config.connectionTimeout) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 1) {
            // Reduce retry attempts for faster failure in tests
            return undefined;
          }
          return Math.min(options.attempt * 50, 500); // Even shorter retry intervals
        },
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.stats.errors++;
        // Set client to null on connection errors to trigger fallback
        if (
          err.code === 'ECONNREFUSED' ||
          err.code === 'ENOTFOUND' ||
          err.message.includes('timeout')
        ) {
          this.client = null;
        }
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis cache');
      });

      // Connect with timeout
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection timeout')),
            this.config.connectionTimeout
          )
        ),
      ]);

      // Test the connection by trying a simple operation with timeout
      await Promise.race([
        this.client.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ping timeout')), 500)
        ),
      ]);
    } catch (error) {
      logger.warn(
        'Failed to connect to Redis, using in-memory fallback:',
        error.message
      );
      this.client = null;
    }
  }

  // Generate content-based cache key with semantic similarity support
  generateCacheKey(prompt, options = {}) {
    const normalizedPrompt = this.normalizePrompt(prompt);
    const optionsHash = this.hashOptions(options);

    // Create base key from normalized content
    const baseKey = crypto
      .createHash('sha256')
      .update(`${normalizedPrompt}:${optionsHash}`)
      .digest('hex')
      .substring(0, 32);

    return `dream:${baseKey}`;
  }

  // Normalize prompt for better cache key generation
  normalizePrompt(prompt) {
    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Hash options for cache key
  hashOptions(options) {
    const relevantOptions = {
      style: options.style,
      quality: options.quality,
      provider: options.provider,
      model: options.model,
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(relevantOptions))
      .digest('hex')
      .substring(0, 16);
  }

  // Get cached response with semantic similarity check
  async get(key, options = {}) {
    try {
      let result = null;

      // Try exact match first
      if (this.client) {
        try {
          const cached = await this.client.get(key);
          if (cached) {
            try {
              result = JSON.parse(cached);
              this.stats.hits++;
              EnhancedLogger.logCacheHit(key, 'redis-exact');
              return result;
            } catch (parseError) {
              logger.warn('Malformed cache data found, removing:', key);
              await this.client.del(key);
              // Continue to check other sources
            }
          }
        } catch (redisError) {
          logger.warn(
            'Redis operation failed, falling back to memory cache:',
            redisError.message
          );
          this.client = null; // Trigger fallback for subsequent operations
        }
      }

      if (!this.client) {
        // Fallback to in-memory cache
        result = this.fallbackCache.get(key);
        if (result) {
          // Check if result is valid cache entry (should be an object, not a string)
          if (typeof result === 'string') {
            logger.warn(
              'Malformed cache data found in memory (string instead of object), removing:',
              key
            );
            this.fallbackCache.delete(key);
            // Continue to check other sources
          } else {
            try {
              // Verify it's valid JSON-serializable data
              JSON.stringify(result);
              this.stats.hits++;
              EnhancedLogger.logCacheHit(key, 'memory-exact');
              return result;
            } catch (parseError) {
              logger.warn(
                'Malformed cache data found in memory, removing:',
                key
              );
              this.fallbackCache.delete(key);
              // Continue to check other sources
            }
          }
        }
      }

      // Try semantic similarity if enabled
      if (this.config.enableSemanticSimilarity && options.prompt) {
        result = await this.findSimilarCached(options.prompt, options);
        if (result) {
          this.stats.hits++;
          EnhancedLogger.logCacheHit(key, 'semantic-similarity');
          return result;
        }
      }

      this.stats.misses++;
      EnhancedLogger.logCacheMiss(key, this.client ? 'redis' : 'memory');
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      this.stats.errors++;
      return null;
    }
  }

  // Set cached response with intelligent TTL
  async set(key, value, customTtl = null) {
    try {
      const quality = value.metadata?.quality || 'standard';
      const tier = this.qualityTiers[quality] || this.qualityTiers.standard;
      const ttl = customTtl || tier.ttl;

      // Add cache metadata
      const cacheEntry = {
        ...value,
        cacheMetadata: {
          cachedAt: Date.now(),
          ttl: ttl,
          quality: quality,
          priority: tier.priority,
          accessCount: 0,
        },
      };

      if (this.client) {
        try {
          await this.client.setEx(key, ttl, JSON.stringify(cacheEntry));

          // Store prompt for semantic similarity
          if (value.originalPrompt) {
            await this.client.setEx(
              `prompt:${key}`,
              ttl,
              JSON.stringify({
                prompt: value.originalPrompt,
                normalized: this.normalizePrompt(value.originalPrompt),
                quality: quality,
              })
            );
          }
        } catch (redisError) {
          logger.warn(
            'Redis operation failed, falling back to memory cache:',
            redisError.message
          );
          this.client = null;
          // Fall through to in-memory cache
        }
      }

      if (!this.client) {
        // Fallback to in-memory cache with size limit
        if (this.fallbackCache.size >= this.config.maxCacheSize) {
          this.evictOldestEntries();
        }
        this.fallbackCache.set(key, cacheEntry);
      }

      // Track popular patterns
      this.trackPopularPattern(value.originalPrompt, quality);

      this.stats.sets++;
      logger.debug(
        `Cached response with key ${key}, TTL: ${ttl}s, quality: ${quality}`
      );
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // Find semantically similar cached responses
  async findSimilarCached(prompt, options = {}) {
    if (!this.client) return null;

    try {
      const normalizedPrompt = this.normalizePrompt(prompt);
      const promptKeys = await this.client.keys('prompt:*');

      for (const promptKey of promptKeys.slice(0, 100)) {
        // Limit search
        const promptData = await this.client.get(promptKey);
        if (!promptData) continue;

        const {
          prompt: cachedPrompt,
          normalized: cachedNormalized,
          quality,
        } = JSON.parse(promptData);
        const similarity = this.calculateSimilarity(
          normalizedPrompt,
          cachedNormalized
        );

        if (similarity >= this.config.similarityThreshold) {
          const cacheKey = promptKey.replace('prompt:', '');
          const cached = await this.client.get(cacheKey);

          if (cached) {
            const result = JSON.parse(cached);
            // Update access count
            result.cacheMetadata.accessCount =
              (result.cacheMetadata.accessCount || 0) + 1;
            await this.client.setEx(
              cacheKey,
              result.cacheMetadata.ttl,
              JSON.stringify(result)
            );

            logger.debug(
              `Found similar cached content (similarity: ${similarity.toFixed(
                3
              )})`
            );
            return result;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Semantic similarity search error:', error);
      return null;
    }
  }

  // Simple similarity calculation (Jaccard similarity)
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  // Track popular dream patterns for cache warming
  trackPopularPattern(prompt, quality) {
    if (!prompt) return;

    const pattern = this.extractPattern(prompt);
    const key = `${pattern}:${quality}`;

    const current = this.popularPatterns.get(key) || {
      count: 0,
      lastSeen: Date.now(),
    };
    current.count++;
    current.lastSeen = Date.now();

    this.popularPatterns.set(key, current);

    // Keep only top 1000 patterns
    if (this.popularPatterns.size > 1000) {
      const sorted = [...this.popularPatterns.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 1000);

      this.popularPatterns.clear();
      sorted.forEach(([k, v]) => this.popularPatterns.set(k, v));
    }
  }

  // Extract pattern from prompt for popularity tracking
  extractPattern(prompt) {
    const normalized = this.normalizePrompt(prompt);
    const words = normalized.split(' ').filter((word) => word.length > 3);
    return words.slice(0, 5).join(' '); // First 5 significant words
  }

  // Cache warming for popular patterns
  async warmCache(patterns = null) {
    const patternsToWarm = patterns || this.getTopPatterns(50);

    logger.info(`Warming cache for ${patternsToWarm.length} popular patterns`);

    for (const pattern of patternsToWarm) {
      // This would typically trigger background generation
      // For now, we just log the intent
      logger.debug(`Would warm cache for pattern: ${pattern}`);
    }
  }

  // Get top popular patterns
  getTopPatterns(limit = 10) {
    return [...this.popularPatterns.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([pattern]) => pattern);
  }

  // Invalidate cache entries
  async invalidate(pattern) {
    try {
      let deletedCount = 0;

      if (this.client) {
        if (pattern === '*') {
          await this.client.flushDb();
          deletedCount = 'all';
        } else {
          const keys = await this.client.keys(pattern);
          if (keys.length > 0) {
            deletedCount = await this.client.del(keys);
          }
        }
      } else {
        if (pattern === '*') {
          deletedCount = this.fallbackCache.size;
          this.fallbackCache.clear();
        } else {
          // Simple pattern matching for fallback
          const keysToDelete = [...this.fallbackCache.keys()].filter((key) =>
            key.includes(pattern.replace('*', ''))
          );
          keysToDelete.forEach((key) => this.fallbackCache.delete(key));
          deletedCount = keysToDelete.length;
        }
      }

      this.stats.invalidations++;
      logger.info(
        `Invalidated ${deletedCount} cache entries with pattern: ${pattern}`
      );
      return true;
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // Evict oldest entries from in-memory cache
  evictOldestEntries() {
    const entries = [...this.fallbackCache.entries()];
    entries.sort((a, b) => {
      const aTime = a[1].cacheMetadata?.cachedAt || 0;
      const bTime = b[1].cacheMetadata?.cachedAt || 0;
      return aTime - bTime;
    });

    // Remove oldest 10%
    const toRemove = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.fallbackCache.delete(entries[i][0]);
    }
  }

  // Get cache statistics
  getStats() {
    const hitRate =
      this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    const missRate = 1 - hitRate;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      invalidations: this.stats.invalidations,
      errors: this.stats.errors,
      hit_rate: parseFloat(hitRate.toFixed(4)),
      miss_rate: parseFloat(missRate.toFixed(4)),
      cache_size: this.client ? 'redis' : this.fallbackCache.size,
      backend: this.client ? 'redis' : 'memory',
      popular_patterns: this.popularPatterns.size,
      top_patterns: this.getTopPatterns(5),
    };
  }

  // Get cache analytics
  async getAnalytics() {
    const stats = this.getStats();

    let cacheInfo = {
      backend: stats.backend,
      size: stats.cache_size,
    };

    if (this.client) {
      try {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
        if (memoryMatch) {
          cacheInfo.memory_usage = memoryMatch[1].trim();
        }
      } catch (error) {
        logger.warn('Could not get Redis memory info:', error.message);
      }
    }

    return {
      ...stats,
      cache_info: cacheInfo,
      quality_distribution: this.getQualityDistribution(),
      performance_metrics: {
        avg_response_time: this.calculateAverageResponseTime(),
        cache_efficiency:
          stats.hit_rate > 0.7
            ? 'good'
            : stats.hit_rate > 0.5
            ? 'fair'
            : 'poor',
      },
    };
  }

  // Get quality distribution from popular patterns
  getQualityDistribution() {
    const distribution = { draft: 0, standard: 0, high: 0, cinematic: 0 };

    for (const [pattern] of this.popularPatterns) {
      const quality = pattern.split(':')[1] || 'standard';
      if (distribution.hasOwnProperty(quality)) {
        distribution[quality]++;
      }
    }

    return distribution;
  }

  // Calculate average response time (placeholder)
  calculateAverageResponseTime() {
    // This would be implemented with actual timing data
    return this.stats.hits > 0 ? '< 50ms' : 'N/A';
  }

  // Cleanup method
  async cleanup() {
    if (this.client) {
      await this.client.quit();
    }
    this.fallbackCache.clear();
    this.popularPatterns.clear();
  }
}

module.exports = ResponseCache;
