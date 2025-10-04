/**
 * ParameterValidator
 *
 * Validates and repairs entity parameters to ensure they conform to schema constraints.
 * Provides parameter clamping, validation, and dream-wide repair functionality.
 */

const DreamSchema = require('../schemas/DreamSchema');

/**
 * Parameter constraints for all entity types
 * Defines min, max, and default values for each parameter
 */
const PARAMETER_CONSTRAINTS = {
  // Particle stream entities
  particle_stream: {
    glow: { min: 0, max: 1, default: 0.5 },
    speed: { min: 0, max: 10, default: 1 },
    size: { min: 0.1, max: 5, default: 1 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffffff' },
  },

  // Floating orbs entities
  floating_orbs: {
    glow: { min: 0, max: 1, default: 0.7 },
    speed: { min: 0, max: 5, default: 0.5 },
    size: { min: 0.5, max: 3, default: 1.5 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffffff' },
  },

  // Particle swarm entities
  particle_swarm: {
    glow: { min: 0, max: 1, default: 0.6 },
    speed: { min: 0, max: 10, default: 2 },
    size: { min: 0.1, max: 5, default: 0.8 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffffff' },
  },

  // Energy beings entities
  energy_beings: {
    glow: { min: 0, max: 1, default: 0.8 },
    speed: { min: 0, max: 10, default: 1.5 },
    size: { min: 0.1, max: 5, default: 2 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#00ffff' },
  },

  // Geometric shapes entities
  geometric_shapes: {
    glow: { min: 0, max: 1, default: 0.4 },
    speed: { min: 0, max: 10, default: 0.8 },
    size: { min: 0.1, max: 5, default: 1.2 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffffff' },
  },

  // Book swarm entities
  book_swarm: {
    glow: { min: 0, max: 1, default: 0.3 },
    speed: { min: 0, max: 10, default: 1 },
    size: { min: 0.1, max: 5, default: 0.5 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#f5deb3' },
  },

  // Shadow figures entities
  shadow_figures: {
    glow: { min: 0, max: 1, default: 0.2 },
    speed: { min: 0, max: 10, default: 0.5 },
    size: { min: 0.1, max: 5, default: 1.8 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#1a1a1a' },
  },

  // Light butterflies entities
  light_butterflies: {
    glow: { min: 0, max: 1, default: 0.9 },
    speed: { min: 0, max: 10, default: 3 },
    size: { min: 0.1, max: 5, default: 0.3 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffff00' },
  },

  // Memory fragments entities
  memory_fragments: {
    glow: { min: 0, max: 1, default: 0.5 },
    speed: { min: 0, max: 10, default: 0.7 },
    size: { min: 0.1, max: 5, default: 1 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#add8e6' },
  },

  // Crystal shards entities
  crystal_shards: {
    glow: { min: 0, max: 1, default: 0.7 },
    speed: { min: 0, max: 10, default: 1.2 },
    size: { min: 0.1, max: 5, default: 0.8 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#e0ffff' },
  },

  // Default constraints for unknown entity types
  default: {
    glow: { min: 0, max: 1, default: 0.5 },
    speed: { min: 0, max: 10, default: 1 },
    size: { min: 0.1, max: 5, default: 1 },
    color: { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffffff' },
  },
};

class ParameterValidator {
  /**
   * Static metrics for aggregate reporting
   */
  static metrics = {
    repairsByType: {
      parameter: 0,
    },
    repairsByField: {},
    lastMetricsLog: Date.now(),
    metricsLogInterval: 60000, // Log metrics every 60 seconds
  };

  /**
   * Track repair metrics for aggregate reporting
   * @private
   */
  static _trackRepairMetrics(repairs) {
    if (!repairs || repairs.length === 0) {
      return;
    }

    for (const repair of repairs) {
      // Count by type
      this.metrics.repairsByType.parameter++;

      // Count by field
      const field = `${repair.entityType}.${repair.paramName}`;
      if (!this.metrics.repairsByField[field]) {
        this.metrics.repairsByField[field] = 0;
      }
      this.metrics.repairsByField[field]++;
    }

    // Check if it's time to log aggregate metrics
    const now = Date.now();
    if (now - this.metrics.lastMetricsLog >= this.metrics.metricsLogInterval) {
      this._logAggregateMetrics();
      this.metrics.lastMetricsLog = now;
    }
  }

  /**
   * Log aggregate repair metrics
   * @private
   */
  static _logAggregateMetrics() {
    const totalRepairs = this.metrics.repairsByType.parameter;

    if (totalRepairs === 0) {
      return; // No repairs to report
    }

    console.log(
      '[ParameterValidator] Aggregate repair metrics',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalRepairs,
        repairsByType: { ...this.metrics.repairsByType },
        repairsByField: { ...this.metrics.repairsByField },
      })
    );
  }

  /**
   * Get current repair metrics (for monitoring/testing)
   */
  static getRepairMetrics() {
    return {
      totalRepairs: this.metrics.repairsByType.parameter,
      repairsByType: { ...this.metrics.repairsByType },
      repairsByField: { ...this.metrics.repairsByField },
    };
  }

  /**
   * Reset repair metrics (useful for testing)
   */
  static resetRepairMetrics() {
    this.metrics.repairsByType = {
      parameter: 0,
    };
    this.metrics.repairsByField = {};
    this.metrics.lastMetricsLog = Date.now();
  }

  /**
   * Validates and clamps a parameter value to allowed range
   * @param {string} paramName - Parameter name (e.g., 'glow', 'speed', 'size')
   * @param {number} value - Value to validate
   * @param {Object} constraints - {min, max} from schema
   * @returns {Object} {value: number, clamped: boolean, original: number}
   */
  static validateAndClamp(paramName, value, constraints) {
    // Handle edge cases
    if (value === null || value === undefined) {
      return {
        value: constraints.default,
        clamped: true,
        original: value,
        reason: 'null_or_undefined',
      };
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return {
        value: constraints.default,
        clamped: true,
        original: value,
        reason: 'invalid_type',
      };
    }

    if (!isFinite(value)) {
      return {
        value: constraints.default,
        clamped: true,
        original: value,
        reason: 'infinite',
      };
    }

    // Clamp to min/max range
    let clampedValue = value;
    let wasClamped = false;
    let reason = null;

    if (value < constraints.min) {
      clampedValue = constraints.min;
      wasClamped = true;
      reason = 'below_minimum';
    } else if (value > constraints.max) {
      clampedValue = constraints.max;
      wasClamped = true;
      reason = 'above_maximum';
    }

    // Enhanced logging when clamping occurs with all required fields
    if (wasClamped) {
      console.log(
        `[ParameterValidator] Clamped parameter`,
        JSON.stringify({
          field: paramName,
          original: value,
          clamped: clampedValue,
          range: { min: constraints.min, max: constraints.max },
          reason,
          timestamp: new Date().toISOString(),
        })
      );
    }

    return {
      value: clampedValue,
      clamped: wasClamped,
      original: value,
      reason,
    };
  }

  /**
   * Gets parameter constraints from schema
   * @param {string} entityType - Entity type (e.g., 'particle_stream')
   * @param {string} paramName - Parameter name (e.g., 'glow')
   * @returns {Object} {min, max, default}
   */
  static getParameterConstraints(entityType, paramName) {
    // Get constraints for entity type, fallback to default
    const entityConstraints =
      PARAMETER_CONSTRAINTS[entityType] || PARAMETER_CONSTRAINTS.default;

    // Get constraints for parameter, fallback to generic defaults
    const paramConstraints = entityConstraints[paramName];

    if (!paramConstraints) {
      // Return generic constraints based on parameter name
      if (paramName === 'glow') {
        return { min: 0, max: 1, default: 0.5 };
      } else if (paramName === 'speed') {
        return { min: 0, max: 10, default: 1 };
      } else if (paramName === 'size') {
        return { min: 0.1, max: 5, default: 1 };
      } else if (paramName === 'color') {
        return { pattern: /^#[0-9a-fA-F]{6}$/, default: '#ffffff' };
      }

      // Generic numeric constraint
      return { min: 0, max: 10, default: 1 };
    }

    return paramConstraints;
  }

  /**
   * Validates all parameters in an entity
   * @param {Object} entity - Entity object with params
   * @returns {Object} {valid: boolean, repairs: Array}
   */
  static validateEntityParams(entity) {
    const repairs = [];

    if (!entity || !entity.params) {
      return { valid: true, repairs };
    }

    const entityType = entity.type || 'default';
    const params = entity.params;

    // Validate each parameter
    for (const [paramName, paramValue] of Object.entries(params)) {
      // Skip color validation (handled separately)
      if (paramName === 'color') {
        continue;
      }

      // Get constraints for this parameter
      const constraints = this.getParameterConstraints(entityType, paramName);

      // Skip if no numeric constraints
      if (!constraints.min && !constraints.max) {
        continue;
      }

      // Validate and clamp
      const result = this.validateAndClamp(paramName, paramValue, constraints);

      if (result.clamped) {
        repairs.push({
          entityId: entity.id,
          entityType,
          paramName,
          original: result.original,
          clamped: result.value,
          reason: result.reason,
          constraints: { min: constraints.min, max: constraints.max },
        });

        // Update the parameter value
        params[paramName] = result.value;
      }
    }

    return {
      valid: repairs.length === 0,
      repairs,
    };
  }

  /**
   * Repairs all out-of-range parameters in a dream
   * @param {Object} dream - Dream object
   * @returns {Object} {repaired: boolean, repairs: Array}
   */
  static repairDreamParameters(dream) {
    const allRepairs = [];

    if (!dream || !dream.entities || !Array.isArray(dream.entities)) {
      return { repaired: false, repairs: [] };
    }

    // Iterate through all entities
    for (const entity of dream.entities) {
      const result = this.validateEntityParams(entity);

      if (result.repairs.length > 0) {
        allRepairs.push(...result.repairs);
      }
    }

    // Enhanced logging if repairs were made
    if (allRepairs.length > 0) {
      const timestamp = new Date().toISOString();

      // Log summary with all required fields
      console.log(
        `[ParameterValidator] Completed parameter repairs`,
        JSON.stringify({
          totalRepairs: allRepairs.length,
          dreamId: dream.id || 'unknown',
          timestamp,
        })
      );

      // Log each repair with all required fields
      allRepairs.forEach((repair) => {
        console.log(
          `[ParameterValidator] Parameter repair detail`,
          JSON.stringify({
            type: 'parameter',
            field: `${repair.entityType}.${repair.paramName}`,
            entityId: repair.entityId,
            entityType: repair.entityType,
            paramName: repair.paramName,
            original: repair.original,
            clamped: repair.clamped,
            range: repair.constraints,
            reason: repair.reason,
            dreamId: dream.id || 'unknown',
            timestamp,
          })
        );
      });

      // Track metrics for aggregate reporting
      this._trackRepairMetrics(allRepairs);
    }

    return {
      repaired: allRepairs.length > 0,
      repairs: allRepairs,
    };
  }
}

module.exports = ParameterValidator;
