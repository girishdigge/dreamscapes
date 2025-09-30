// services/express/middleware/cache.js
const { logger } = require('../utils/logger');

// In-memory cache (replace with Redis in production)
class MemoryCache {
  constructor(maxSize = 1000, ttl = 3600000) {
    // 1 hour TTL by default
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.evictions = 0;
    this.invalidations = 0;
    this.performanceMetrics = {
      averageGetTime: 0,
      averageSetTime: 0,
      totalGetTime: 0,
      totalSetTime: 0,
      getOperations: 0,
      setOperations: 0,
    };

    // Cleanup expired entries every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);

    // Performance monitoring interval
    setInterval(() => this.logPerformanceMetrics(), 5 * 60 * 1000); // Every 5 minutes
  }

  set(key, value, customTtl = null) {
    const startTime = Date.now();
    const expiry = Date.now() + (customTtl || this.ttl);

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.evictions++;
      logger.debug(`Cache EVICTION: ${firstKey} (cache full)`);
    }

    // Enhanced cache entry with metadata
    const cacheEntry = {
      value,
      expiry,
      created: Date.now(),
      accessed: Date.now(),
      hits: 0,
      size: this.estimateSize(value),
      source: value?.source || 'unknown',
      dreamId: value?.id || null,
      originalText: value?.originalText || null,
      style: value?.style || null,
    };

    this.cache.set(key, cacheEntry);
    this.sets++;

    // Track performance metrics
    const setTime = Date.now() - startTime;
    this.performanceMetrics.setOperations++;
    this.performanceMetrics.totalSetTime += setTime;
    this.performanceMetrics.averageSetTime =
      this.performanceMetrics.totalSetTime /
      this.performanceMetrics.setOperations;

    logger.debug(
      `Cache SET: ${key} (size: ${this.cache.size}, source: ${cacheEntry.source}, setTime: ${setTime}ms)`
    );
  }

  get(key) {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      const getTime = Date.now() - startTime;
      this.updateGetMetrics(getTime);
      logger.debug(`Cache MISS: ${key} (getTime: ${getTime}ms)`);
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses++;
      const getTime = Date.now() - startTime;
      this.updateGetMetrics(getTime);
      logger.debug(`Cache EXPIRED: ${key} (getTime: ${getTime}ms)`);
      return null;
    }

    // Update access stats
    entry.accessed = Date.now();
    entry.hits++;
    this.hits++;

    const getTime = Date.now() - startTime;
    this.updateGetMetrics(getTime);

    logger.debug(
      `Cache HIT: ${key} (hits: ${entry.hits}, source: ${entry.source}, getTime: ${getTime}ms)`
    );
    return entry.value;
  }

  has(key) {
    const entry = this.cache.get(key);
    return entry && Date.now() <= entry.expiry;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    logger.info(`Cache CLEAR: removed ${size} entries`);
  }

  cleanup() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`Cache CLEANUP: removed ${removedCount} expired entries`);
    }

    return removedCount;
  }

  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate =
      totalRequests > 0 ? ((this.hits / totalRequests) * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      invalidations: this.invalidations,
      hitRate: `${hitRate}%`,
      memoryUsage: this.getMemoryUsage(),
      performance: {
        averageGetTime: `${this.performanceMetrics.averageGetTime.toFixed(
          2
        )}ms`,
        averageSetTime: `${this.performanceMetrics.averageSetTime.toFixed(
          2
        )}ms`,
        totalOperations:
          this.performanceMetrics.getOperations +
          this.performanceMetrics.setOperations,
        getOperations: this.performanceMetrics.getOperations,
        setOperations: this.performanceMetrics.setOperations,
      },
      sourceDistribution: this.getSourceDistribution(),
      ageDistribution: this.getAgeDistribution(),
    };
  }

  getMemoryUsage() {
    // Rough estimate of memory usage
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // Rough string size
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Metadata overhead
    }
    return Math.round(totalSize / 1024) + ' KB';
  }

  // Get entries sorted by access frequency
  getPopularEntries(limit = 10) {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, limit)
      .map(([key, entry]) => ({
        key,
        hits: entry.hits,
        created: new Date(entry.created).toISOString(),
        lastAccessed: new Date(entry.accessed).toISOString(),
      }));
  }

  // Get cache entries by pattern
  getByPattern(pattern) {
    const regex = new RegExp(pattern);
    const matches = [];

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key) && Date.now() <= entry.expiry) {
        matches.push({ key, value: entry.value });
      }
    }

    return matches;
  }

  // Update get operation metrics
  updateGetMetrics(getTime) {
    this.performanceMetrics.getOperations++;
    this.performanceMetrics.totalGetTime += getTime;
    this.performanceMetrics.averageGetTime =
      this.performanceMetrics.totalGetTime /
      this.performanceMetrics.getOperations;
  }

  // Estimate memory size of cached value
  estimateSize(value) {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch (error) {
      return 1024; // Default estimate if serialization fails
    }
  }

  // Get source distribution of cached dreams
  getSourceDistribution() {
    const distribution = {};
    for (const [, entry] of this.cache.entries()) {
      if (Date.now() <= entry.expiry) {
        const source = entry.source || 'unknown';
        distribution[source] = (distribution[source] || 0) + 1;
      }
    }
    return distribution;
  }

  // Get age distribution of cached entries
  getAgeDistribution() {
    const now = Date.now();
    const distribution = {
      fresh: 0, // < 5 minutes
      recent: 0, // 5-30 minutes
      old: 0, // 30-60 minutes
      stale: 0, // > 60 minutes
    };

    for (const [, entry] of this.cache.entries()) {
      if (now <= entry.expiry) {
        const age = now - entry.created;
        if (age < 5 * 60 * 1000) {
          distribution.fresh++;
        } else if (age < 30 * 60 * 1000) {
          distribution.recent++;
        } else if (age < 60 * 60 * 1000) {
          distribution.old++;
        } else {
          distribution.stale++;
        }
      }
    }

    return distribution;
  }

  // Log performance metrics periodically
  logPerformanceMetrics() {
    const stats = this.getStats();
    logger.info('Cache performance metrics', {
      hitRate: stats.hitRate,
      size: stats.size,
      memoryUsage: stats.memoryUsage,
      averageGetTime: stats.performance.averageGetTime,
      averageSetTime: stats.performance.averageSetTime,
      sourceDistribution: stats.sourceDistribution,
      ageDistribution: stats.ageDistribution,
    });
  }

  // Cache invalidation strategies
  invalidateBySource(source) {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.source === source) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.invalidations += invalidated;
    logger.info(`Cache invalidation by source: ${source}`, { invalidated });
    return invalidated;
  }

  invalidateByAge(maxAge) {
    const now = Date.now();
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.created > maxAge) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.invalidations += invalidated;
    logger.info(`Cache invalidation by age: ${maxAge}ms`, { invalidated });
    return invalidated;
  }

  invalidateByStyle(style) {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.style === style) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.invalidations += invalidated;
    logger.info(`Cache invalidation by style: ${style}`, { invalidated });
    return invalidated;
  }

  invalidateFailedAI() {
    let invalidated = 0;
    const failedSources = [
      'safe_fallback',
      'emergency_fallback',
      'local_fallback',
    ];
    for (const [key, entry] of this.cache.entries()) {
      if (failedSources.includes(entry.source)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.invalidations += invalidated;
    logger.info('Cache invalidation of failed AI generations', { invalidated });
    return invalidated;
  }

  // Smart cache warming for popular dreams
  warmCacheWithPopularDreams() {
    const popular = this.getPopularEntries(10);
    logger.info('Cache warming with popular dreams', {
      popularCount: popular.length,
      totalHits: popular.reduce((sum, entry) => sum + entry.hits, 0),
    });
    return popular;
  }

  // Proactive cache management
  optimizeCache() {
    const stats = this.getStats();
    let optimizations = [];

    // If hit rate is low, consider evicting least used entries
    const hitRate = parseFloat(stats.hitRate);
    if (hitRate < 50 && this.cache.size > this.maxSize * 0.8) {
      const evicted = this.evictLeastUsed(Math.floor(this.maxSize * 0.1));
      optimizations.push(`Evicted ${evicted} least used entries`);
    }

    // If too many failed AI generations, invalidate them
    const sourceDistribution = stats.sourceDistribution;
    const failedCount =
      (sourceDistribution.safe_fallback || 0) +
      (sourceDistribution.emergency_fallback || 0) +
      (sourceDistribution.local_fallback || 0);

    if (failedCount > this.cache.size * 0.3) {
      const invalidated = this.invalidateFailedAI();
      optimizations.push(`Invalidated ${invalidated} failed AI generations`);
    }

    // Clean up expired entries
    const cleanedUp = this.cleanup();
    if (cleanedUp > 0) {
      optimizations.push(`Cleaned up ${cleanedUp} expired entries`);
    }

    if (optimizations.length > 0) {
      logger.info('Cache optimization completed', { optimizations });
    }

    return optimizations;
  }
}

// Initialize cache instances
const dreamCache = new MemoryCache(
  parseInt(process.env.MAX_CACHE_SIZE) || 1000,
  parseInt(process.env.CACHE_TTL) || 3600000 // 1 hour
);

const quickCache = new MemoryCache(500, 300000); // 5 minute TTL for quick data

// Cache middleware factory
function cacheMiddleware(cacheInstance, keyGenerator, options = {}) {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const cached = cacheInstance.get(key);

    if (cached && !options.skipCache) {
      logger.debug(`Serving cached response for: ${key}`);
      return res.json({
        ...cached,
        cached: true,
        cachedAt: new Date().toISOString(),
      });
    }

    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (body) {
      // Cache successful responses
      if (res.statusCode === 200 && body && !body.error) {
        cacheInstance.set(key, body, options.ttl);
      }

      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  };
}

// Key generators for different endpoints
const dreamParseKeyGenerator = (req) => {
  const { text, style, options } = req.body;
  const hash = require('crypto')
    .createHash('md5')
    .update(JSON.stringify({ text, style, options }))
    .digest('hex');
  return `parse:${hash}`;
};

const dreamByIdKeyGenerator = (req) => {
  return `dream:${req.params.id}`;
};

const healthKeyGenerator = (req) => {
  return `health:${Math.floor(Date.now() / 30000)}`; // 30 second buckets
};

// Specialized cache functions
function getFromCache(key) {
  return dreamCache.get(key);
}

function setToCache(key, value, ttl = null) {
  return dreamCache.set(key, value, ttl);
}

function deleteFromCache(key) {
  return dreamCache.delete(key);
}

function clearCache() {
  return dreamCache.clear();
}

// Cache warming function
async function warmCache() {
  logger.info('Warming cache with sample dreams...');

  const sampleDreams = [
    {
      text: 'A floating library with glowing books',
      style: 'ethereal',
    },
    {
      text: 'Neon butterflies in digital space',
      style: 'cyberpunk',
    },
    {
      text: 'Impossible architecture floating in clouds',
      style: 'surreal',
    },
  ];

  for (const sample of sampleDreams) {
    const key = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(sample))
      .digest('hex');

    // This would normally generate the dream, but for warming we'll skip
    logger.debug(`Cache key prepared: parse:${key}`);
  }
}

// Cache statistics endpoint data
function getCacheStats() {
  return {
    dreamCache: dreamCache.getStats(),
    quickCache: quickCache.getStats(),
    popularDreams: dreamCache.getPopularEntries(5),
    systemMemory: process.memoryUsage(),
  };
}

// Cache management functions
function evictLeastUsed(count = 10) {
  const entries = Array.from(dreamCache.cache.entries())
    .sort((a, b) => a[1].hits - b[1].hits)
    .slice(0, count);

  let evicted = 0;
  for (const [key] of entries) {
    if (dreamCache.delete(key)) {
      evicted++;
    }
  }

  dreamCache.evictions += evicted;
  logger.info(`Evicted ${evicted} least used cache entries`);
  return evicted;
}

function evictExpired() {
  dreamCache.cleanup();
  quickCache.cleanup();
}

function evictByPattern(pattern) {
  const regex = new RegExp(pattern);
  let evicted = 0;

  for (const [key] of dreamCache.cache.entries()) {
    if (regex.test(key)) {
      dreamCache.delete(key);
      evicted++;
    }
  }

  logger.info(`Evicted ${evicted} entries matching pattern: ${pattern}`);
  return evicted;
}

// Middleware for cache headers
function setCacheHeaders(maxAge = 300) {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      ETag: require('crypto')
        .createHash('md5')
        .update(req.originalUrl)
        .digest('hex'),
    });
    next();
  };
}

// Cache monitoring middleware
function cacheMonitoring() {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const stats = dreamCache.getStats();

      // Log cache performance periodically
      if (Math.random() < 0.01) {
        // 1% sampling
        logger.info('Cache stats:', {
          hitRate: stats.hitRate,
          size: stats.size,
          responseTime: duration,
          endpoint: req.path,
          averageGetTime: stats.performance.averageGetTime,
          sourceDistribution: stats.sourceDistribution,
        });
      }
    });

    next();
  };
}

// Enhanced cache validation for AI-generated dreams
function validateCachedDream(dreamJson) {
  if (!dreamJson || typeof dreamJson !== 'object') {
    return { valid: false, reason: 'Invalid dream object' };
  }

  // Check for required fields
  const requiredFields = ['id', 'structures', 'entities', 'source'];
  for (const field of requiredFields) {
    if (!dreamJson[field]) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Validate AI-generated content quality
  if (dreamJson.source === 'ai' || dreamJson.source === 'openai') {
    if (!dreamJson.structures || dreamJson.structures.length === 0) {
      return { valid: false, reason: 'AI dream missing structures' };
    }

    if (!dreamJson.entities || dreamJson.entities.length === 0) {
      return { valid: false, reason: 'AI dream missing entities' };
    }
  }

  return { valid: true };
}

// Smart cache invalidation based on AI service health
function invalidateBasedOnServiceHealth(serviceHealth) {
  let totalInvalidated = 0;

  // If MCP Gateway is unhealthy, invalidate recent failed attempts
  if (serviceHealth.mcpGateway?.status === 'unhealthy') {
    const recentFailures = dreamCache.invalidateByAge(5 * 60 * 1000); // 5 minutes
    totalInvalidated += recentFailures;
    logger.info('Invalidated recent cache entries due to MCP Gateway issues', {
      invalidated: recentFailures,
    });
  }

  // If AI services are degraded, prioritize successful AI generations
  if (serviceHealth.overall === 'degraded') {
    const failedInvalidated = dreamCache.invalidateFailedAI();
    totalInvalidated += failedInvalidated;
  }

  return totalInvalidated;
}

// Cache performance optimization scheduler
function startCacheOptimization() {
  // Run optimization every 15 minutes
  setInterval(() => {
    try {
      const optimizations = dreamCache.optimizeCache();
      if (optimizations.length > 0) {
        logger.info('Scheduled cache optimization completed', {
          optimizations,
        });
      }
    } catch (error) {
      logger.error('Cache optimization failed', { error: error.message });
    }
  }, 15 * 60 * 1000);

  logger.info('Cache optimization scheduler started (15 minute intervals)');
}

// Start cache optimization on module load
startCacheOptimization();

module.exports = {
  dreamCache,
  quickCache,
  cacheMiddleware,
  dreamParseKeyGenerator,
  dreamByIdKeyGenerator,
  healthKeyGenerator,
  getFromCache,
  setToCache,
  deleteFromCache,
  clearCache,
  warmCache,
  getCacheStats,
  evictLeastUsed,
  evictExpired,
  evictByPattern,
  setCacheHeaders,
  cacheMonitoring,
  validateCachedDream,
  invalidateBasedOnServiceHealth,
  startCacheOptimization,
};
