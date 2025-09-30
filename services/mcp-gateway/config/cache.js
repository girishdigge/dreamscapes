// config/cache.js
// Cache configuration for enhanced response caching

module.exports = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'dreamscapes:',
  },

  ttl: {
    draft: parseInt(process.env.CACHE_TTL_DRAFT) || 300, // 5 minutes
    standard: parseInt(process.env.CACHE_TTL_STANDARD) || 1800, // 30 minutes
    high: parseInt(process.env.CACHE_TTL_HIGH) || 3600, // 1 hour
    cinematic: parseInt(process.env.CACHE_TTL_CINEMATIC) || 7200, // 2 hours
  },

  maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000, // Maximum number of cached items

  warming: {
    enabled: process.env.CACHE_WARMING_ENABLED === 'true',
    patterns: [
      'peaceful garden',
      'cyberpunk city',
      'ethereal library',
      'cosmic landscape',
      'underwater world',
    ],
  },
};
