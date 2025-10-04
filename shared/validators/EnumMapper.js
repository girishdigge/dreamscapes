/**
 * EnumMapper - Centralized enum mapping and validation utility
 *
 * Provides mapping between internal values and schema-valid enum values,
 * ensuring consistency across all services.
 */

const DreamSchema = require('../schemas/DreamSchema');

/**
 * Source enum mappings - maps fallback types to valid source enums
 */
const SOURCE_MAPPINGS = {
  local_fallback: 'express',
  safe_fallback: 'express',
  'mcp-gateway-fallback': 'mcp-gateway',
  fallback: 'express',
  default: 'express',
};

/**
 * Shot type enum mappings - maps aliases to valid shot types
 */
const SHOT_TYPE_MAPPINGS = {
  dolly_zoom: 'zoom',
  tracking: 'flythrough',
  pan: 'orbit',
  tilt: 'orbit',
  static: 'establish',
};

class EnumMapper {
  /**
   * Maps fallback type strings to valid source enum values
   * @param {string} fallbackType - e.g., 'local_fallback', 'safe_fallback'
   * @param {string} service - Optional service name for context
   * @returns {string} Valid source enum value
   */
  static mapFallbackToSource(fallbackType, service = null) {
    if (!fallbackType) {
      console.warn('[EnumMapper] No fallback type provided, using default');
      return SOURCE_MAPPINGS.default;
    }

    const mapped = SOURCE_MAPPINGS[fallbackType] || SOURCE_MAPPINGS.default;

    console.log('[EnumMapper] Mapping fallback to source', {
      fallbackType,
      service,
      mapped,
    });

    return mapped;
  }

  /**
   * Maps shot type aliases to valid enum values
   * @param {string} shotType - e.g., 'dolly_zoom', 'tracking'
   * @returns {string} Valid shot type enum value
   */
  static mapShotType(shotType) {
    if (!shotType) {
      console.warn('[EnumMapper] No shot type provided, using default');
      return 'establish';
    }

    const mapped = SHOT_TYPE_MAPPINGS[shotType] || shotType;

    if (mapped !== shotType) {
      console.log('[EnumMapper] Mapping shot type', {
        original: shotType,
        mapped,
      });
    }

    return mapped;
  }

  /**
   * Gets all valid values for an enum field from DreamSchema
   * @param {string} fieldPath - e.g., 'source', 'cinematography.shots[].type'
   * @returns {string[]} Array of valid enum values
   */
  static getValidEnumValues(fieldPath) {
    const schema = DreamSchema.getSchema();

    // Handle top-level fields
    if (fieldPath === 'source') {
      return schema.source.enum || [];
    }

    if (fieldPath === 'style') {
      return schema.style.enum || [];
    }

    // Handle cinematography shot types
    if (
      fieldPath === 'cinematography.shots[].type' ||
      fieldPath === 'cinematography.shots.type'
    ) {
      const cinematographySchema = DreamSchema.getCinematographySchema();
      return cinematographySchema.shots.itemSchema.type.enum || [];
    }

    // Handle structure types
    if (fieldPath === 'structures[].type' || fieldPath === 'structures.type') {
      const structureSchema = DreamSchema.getStructureSchema();
      return structureSchema.type.enum || [];
    }

    // Handle entity types
    if (fieldPath === 'entities[].type' || fieldPath === 'entities.type') {
      const entitySchema = DreamSchema.getEntitySchema();
      return entitySchema.type.enum || [];
    }

    // Handle render quality
    if (fieldPath === 'render.quality') {
      const renderSchema = DreamSchema.getRenderSchema();
      return renderSchema.quality.enum || [];
    }

    // Handle render fps
    if (fieldPath === 'render.fps') {
      const renderSchema = DreamSchema.getRenderSchema();
      return renderSchema.fps.enum || [];
    }

    // Handle environment preset
    if (fieldPath === 'environment.preset') {
      const environmentSchema = DreamSchema.getEnvironmentSchema();
      return environmentSchema.preset.enum || [];
    }

    console.warn('[EnumMapper] Unknown field path for enum values:', fieldPath);
    return [];
  }

  /**
   * Checks if a value is valid for an enum field
   * @param {string} fieldPath - Field path in schema
   * @param {string} value - Value to check
   * @returns {boolean} True if valid
   */
  static isValidEnumValue(fieldPath, value) {
    const validValues = this.getValidEnumValues(fieldPath);
    const isValid = validValues.includes(value);

    if (!isValid) {
      console.log('[EnumMapper] Invalid enum value detected', {
        fieldPath,
        value,
        validValues,
      });
    }

    return isValid;
  }

  /**
   * Finds closest valid enum value for an invalid one using string similarity
   * @param {string} fieldPath - Field path in schema
   * @param {string} invalidValue - Invalid value
   * @returns {string} Closest valid enum value
   */
  static findClosestEnumValue(fieldPath, invalidValue) {
    const validValues = this.getValidEnumValues(fieldPath);

    if (validValues.length === 0) {
      console.warn('[EnumMapper] No valid values found for field:', fieldPath);
      return null;
    }

    if (!invalidValue) {
      console.warn(
        '[EnumMapper] No invalid value provided, returning first valid value'
      );
      return validValues[0];
    }

    // Try exact match first (case-insensitive)
    const lowerInvalid = invalidValue.toLowerCase();
    const exactMatch = validValues.find(
      (v) => v.toLowerCase() === lowerInvalid
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Calculate Levenshtein distance for each valid value
    let closestValue = validValues[0];
    let minDistance = this.levenshteinDistance(
      invalidValue.toLowerCase(),
      validValues[0].toLowerCase()
    );

    for (let i = 1; i < validValues.length; i++) {
      const distance = this.levenshteinDistance(
        invalidValue.toLowerCase(),
        validValues[i].toLowerCase()
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestValue = validValues[i];
      }
    }

    console.log('[EnumMapper] Found closest enum value', {
      fieldPath,
      invalidValue,
      closestValue,
      distance: minDistance,
    });

    return closestValue;
  }

  /**
   * Calculates Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }
}

module.exports = EnumMapper;
