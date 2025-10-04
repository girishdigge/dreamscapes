// shared/utils/ValidationHelpers.js
/**
 * Shared Validation Helper Utilities
 * Common functions for validation formatting, error handling, and data sanitization
 */

/**
 * Format validation error into readable message
 * @param {Object} error - Validation error object
 * @returns {string} Formatted error message
 */
function formatValidationError(error) {
  if (!error) return 'Unknown validation error';

  // If error is already a string, return it
  if (typeof error === 'string') return error;

  // Handle different error formats
  if (error.message) return error.message;

  const path = error.instancePath || error.schemaPath || error.field || '';
  const field = path.split('/').pop() || 'root';

  // Handle AJV-style errors
  if (error.keyword) {
    switch (error.keyword) {
      case 'required':
        return `Missing required field: ${
          error.params?.missingProperty || field
        }`;
      case 'type':
        return `${field}: expected ${error.schema}, got ${typeof error.data}`;
      case 'enum':
        return `${field}: must be one of [${error.schema?.join(', ') || ''}]`;
      case 'minimum':
        return `${field}: must be >= ${error.schema}`;
      case 'maximum':
        return `${field}: must be <= ${error.schema}`;
      case 'minLength':
        return `${field}: must be at least ${error.schema} characters`;
      case 'maxLength':
        return `${field}: must be at most ${error.schema} characters`;
      case 'pattern':
        return `${field}: format is invalid`;
      default:
        return `${field}: ${error.message || 'validation failed'}`;
    }
  }

  // Handle custom error format
  if (error.error) {
    return `${field}: ${error.error}`;
  }

  return `${field}: validation failed`;
}

/**
 * Format multiple validation errors into structured response
 * @param {Array} errors - Array of validation errors
 * @returns {Object} Formatted error response
 */
function formatValidationErrors(errors) {
  if (!Array.isArray(errors)) {
    errors = [errors];
  }

  return {
    error: 'Validation failed',
    details: errors.map(formatValidationError),
    errorCount: errors.length,
    timestamp: new Date().toISOString(),
    suggestions: [
      'Check the API documentation for correct request format',
      'Ensure all required fields are provided',
      'Verify data types match the schema requirements',
    ],
  };
}

/**
 * Sanitize text input by removing potentially harmful content
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized text
 */
function sanitizeText(text, maxLength = 2000) {
  if (typeof text !== 'string') return '';

  return text
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, maxLength); // Enforce max length
}

/**
 * Sanitize ID field by keeping only safe characters
 * @param {string} id - ID to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized ID
 */
function sanitizeId(id, maxLength = 50) {
  if (typeof id !== 'string') return '';

  return id
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '') // Keep only alphanumeric, underscore, dash
    .substring(0, maxLength); // Reasonable max length
}

/**
 * Create validation cache key from dream data
 * @param {Object} dreamData - Dream object
 * @returns {string} Cache key
 */
function createValidationCacheKey(dreamData) {
  if (!dreamData || typeof dreamData !== 'object') {
    return 'invalid';
  }

  // Create a hash-like key based on dream structure
  const keyData = {
    id: dreamData.id,
    title: dreamData.title,
    style: dreamData.style,
    structureCount: dreamData.structures?.length || 0,
    entityCount: dreamData.entities?.length || 0,
    hasEnvironment: !!dreamData.environment,
    hasCinematography: !!dreamData.cinematography,
  };

  return JSON.stringify(keyData);
}

/**
 * Ensure required fields exist in dream data
 * @param {Object} dreamData - Dream data to check
 * @param {string} originalText - Original prompt text for fallback
 * @returns {Object} Dream data with required fields ensured
 */
function ensureRequiredFields(dreamData, originalText = '') {
  if (!dreamData || typeof dreamData !== 'object') {
    return null;
  }

  const { v4: uuidv4 } = require('uuid');
  const result = { ...dreamData };
  let modified = false;

  // Ensure id field
  if (!result.id || typeof result.id !== 'string') {
    result.id = uuidv4();
    modified = true;
  }

  // Ensure title field
  if (!result.title || typeof result.title !== 'string') {
    // Generate title from original text (first 50 characters)
    let title = 'Generated Dream Scene';
    if (
      originalText &&
      typeof originalText === 'string' &&
      originalText.trim().length > 0
    ) {
      const cleanText = originalText.trim();
      title =
        cleanText.length <= 50
          ? cleanText
          : cleanText.substring(0, 47).trim() + '...';
    }
    result.title = title;
    modified = true;
  }

  // Ensure style field
  if (!result.style || typeof result.style !== 'string') {
    result.style = 'ethereal'; // Default style
    modified = true;
  }

  // Validate style is one of the allowed values
  const validStyles = [
    'ethereal',
    'cyberpunk',
    'surreal',
    'fantasy',
    'nightmare',
    'nature',
    'abstract',
  ];
  if (!validStyles.includes(result.style)) {
    result.style = 'ethereal';
    modified = true;
  }

  return { data: result, modified };
}

/**
 * Generate statistics about dream data
 * @param {Object} dreamData - Dream object
 * @returns {Object} Statistics object
 */
function generateDreamStats(dreamData) {
  if (!dreamData || typeof dreamData !== 'object') {
    return {
      structures: 0,
      entities: 0,
      totalEntityCount: 0,
      shots: 0,
      duration: 0,
      assumptions: 0,
      complexityScore: 0,
      complexityRating: 'unknown',
    };
  }

  const stats = {
    structures: dreamData.structures?.length || 0,
    entities: dreamData.entities?.length || 0,
    totalEntityCount:
      dreamData.entities?.reduce((sum, e) => sum + (e.count || 0), 0) || 0,
    shots: dreamData.cinematography?.shots?.length || 0,
    duration: dreamData.cinematography?.durationSec || 0,
    assumptions: dreamData.assumptions?.length || 0,
  };

  // Calculate complexity score
  stats.complexityScore = calculateComplexityScore(dreamData);
  stats.complexityRating = getComplexityRating(stats.complexityScore);

  return stats;
}

/**
 * Calculate complexity score for dream
 * @param {Object} dreamData - Dream object
 * @returns {number} Complexity score
 */
function calculateComplexityScore(dreamData) {
  if (!dreamData || typeof dreamData !== 'object') {
    return 0;
  }

  let score = 0;

  // Base complexity from counts
  score += (dreamData.structures?.length || 0) * 2;
  score += (dreamData.entities?.length || 0) * 1;
  score += Math.min((dreamData.cinematography?.shots?.length || 0) * 0.5, 5);

  // Entity count impact
  const totalEntities =
    dreamData.entities?.reduce((sum, e) => sum + (e.count || 0), 0) || 0;
  score += Math.min(totalEntities / 50, 10);

  // Duration impact
  const duration = dreamData.cinematography?.durationSec || 0;
  score += Math.min(duration / 30, 5);

  return Math.round(score * 10) / 10;
}

/**
 * Get complexity rating from score
 * @param {number} score - Complexity score
 * @returns {string} Complexity rating
 */
function getComplexityRating(score) {
  if (score < 5) return 'simple';
  if (score < 15) return 'moderate';
  if (score < 25) return 'complex';
  return 'very_complex';
}

/**
 * Check if value is a valid UUID
 * @param {string} value - Value to check
 * @returns {boolean} True if valid UUID
 */
function isValidUUID(value) {
  if (typeof value !== 'string') return false;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if value is a valid ISO date string
 * @param {string} value - Value to check
 * @returns {boolean} True if valid ISO date
 */
function isValidISODate(value) {
  if (typeof value !== 'string') return false;

  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
}

/**
 * Check if value is a valid hex color
 * @param {string} value - Value to check
 * @returns {boolean} True if valid hex color
 */
function isValidHexColor(value) {
  if (typeof value !== 'string') return false;

  const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
  return hexColorRegex.test(value);
}

/**
 * Validate array of 3D coordinates
 * @param {Array} coords - Coordinates array [x, y, z]
 * @returns {Object} Validation result
 */
function validateCoordinates(coords) {
  if (!Array.isArray(coords)) {
    return { valid: false, error: 'Coordinates must be an array' };
  }

  if (coords.length !== 3) {
    return { valid: false, error: 'Coordinates must have exactly 3 values' };
  }

  if (!coords.every((v) => typeof v === 'number' && isFinite(v))) {
    return {
      valid: false,
      error: 'All coordinate values must be finite numbers',
    };
  }

  return { valid: true };
}

/**
 * Validate numeric range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {Object} Validation result
 */
function validateRange(value, min, max) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return { valid: false, error: 'Value must be a finite number' };
  }

  if (value < min) {
    return { valid: false, error: `Value must be >= ${min}` };
  }

  if (value > max) {
    return { valid: false, error: `Value must be <= ${max}` };
  }

  return { valid: true };
}

module.exports = {
  formatValidationError,
  formatValidationErrors,
  sanitizeText,
  sanitizeId,
  createValidationCacheKey,
  ensureRequiredFields,
  generateDreamStats,
  calculateComplexityScore,
  getComplexityRating,
  isValidUUID,
  isValidISODate,
  isValidHexColor,
  validateCoordinates,
  validateRange,
};
