/**
 * Response Structure Inspector
 *
 * Inspects and logs AI provider response structures to help identify
 * extraction patterns and debug response parsing issues.
 */

const { logger } = require('./logger');

class ResponseStructureInspector {
  constructor(options = {}) {
    this.options = {
      maxDepth: options.maxDepth || 5,
      maxSampleLength: options.maxSampleLength || 500,
      logLevel: options.logLevel || 'debug',
      enableDetailedLogging: options.enableDetailedLogging !== false,
      ...options,
    };
  }

  /**
   * Inspect and log complete response structure
   * @param {*} response - Response to inspect
   * @param {string} provider - Provider name
   * @param {Object} context - Additional context
   * @returns {Object} Inspection result
   */
  inspectResponse(response, provider, context = {}) {
    const inspection = {
      provider,
      timestamp: new Date().toISOString(),
      responseType: this.detectResponseFormat(response),
      topLevelKeys: [],
      nestedStructure: {},
      sampleContent: '',
      hasCommonFields: {
        content: false,
        data: false,
        choices: false,
        message: false,
        text: false,
        output: false,
        result: false,
        id: false,
        structures: false,
        entities: false,
      },
      metadata: {
        isNull: response === null,
        isUndefined: response === undefined,
        isString: typeof response === 'string',
        isObject: typeof response === 'object' && response !== null,
        isArray: Array.isArray(response),
        ...context,
      },
    };

    try {
      // Get all top-level keys
      if (response && typeof response === 'object') {
        inspection.topLevelKeys = this.getAllKeys(response, 1);

        // Check for common fields
        inspection.hasCommonFields.content = 'content' in response;
        inspection.hasCommonFields.data = 'data' in response;
        inspection.hasCommonFields.choices = 'choices' in response;
        inspection.hasCommonFields.message = 'message' in response;
        inspection.hasCommonFields.text = 'text' in response;
        inspection.hasCommonFields.output = 'output' in response;
        inspection.hasCommonFields.result = 'result' in response;
        inspection.hasCommonFields.id = 'id' in response;
        inspection.hasCommonFields.structures = 'structures' in response;
        inspection.hasCommonFields.entities = 'entities' in response;

        // Get nested structure
        inspection.nestedStructure = this.getNestedStructure(
          response,
          this.options.maxDepth
        );
      }

      // Get sample content
      inspection.sampleContent = this.getSampleResponse(
        response,
        this.options.maxSampleLength
      );

      // Log the inspection results
      this.logStructureDetails(inspection);

      return inspection;
    } catch (error) {
      logger.error('Error during response inspection', {
        provider,
        error: error.message,
        stack: error.stack,
      });

      return {
        ...inspection,
        error: error.message,
      };
    }
  }

  /**
   * Get all keys at specified depth
   * @param {Object} obj - Object to inspect
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Array} Array of keys
   */
  getAllKeys(obj, maxDepth = 5) {
    if (!obj || typeof obj !== 'object' || maxDepth <= 0) {
      return [];
    }

    try {
      const keys = Object.keys(obj);
      return keys;
    } catch (error) {
      logger.warn('Error getting keys from object', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get nested structure of object up to specified depth
   * @param {Object} obj - Object to inspect
   * @param {number} maxDepth - Maximum depth
   * @param {number} currentDepth - Current depth (internal)
   * @returns {Object} Nested structure representation
   */
  getNestedStructure(obj, maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return '[Max depth reached]';
    }

    if (obj === null) {
      return null;
    }

    if (obj === undefined) {
      return undefined;
    }

    if (typeof obj !== 'object') {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '[]';
      }
      // Show structure of first element
      return [this.getNestedStructure(obj[0], maxDepth, currentDepth + 1)];
    }

    try {
      const structure = {};
      const keys = Object.keys(obj);

      for (const key of keys) {
        try {
          structure[key] = this.getNestedStructure(
            obj[key],
            maxDepth,
            currentDepth + 1
          );
        } catch (error) {
          structure[key] = `[Error: ${error.message}]`;
        }
      }

      return structure;
    } catch (error) {
      return `[Error inspecting object: ${error.message}]`;
    }
  }

  /**
   * Get sample of response for logging
   * @param {*} response - Response to sample
   * @param {number} maxLength - Maximum length
   * @returns {string} Sample string
   */
  getSampleResponse(response, maxLength = 500) {
    try {
      if (response === null) {
        return '[null]';
      }

      if (response === undefined) {
        return '[undefined]';
      }

      if (typeof response === 'string') {
        return response.length > maxLength
          ? response.substring(0, maxLength) + '...[truncated]'
          : response;
      }

      if (typeof response === 'object') {
        const jsonString = JSON.stringify(response, null, 2);
        return jsonString.length > maxLength
          ? jsonString.substring(0, maxLength) + '...[truncated]'
          : jsonString;
      }

      return String(response);
    } catch (error) {
      return `[Error creating sample: ${error.message}]`;
    }
  }

  /**
   * Detect response format type
   * @param {*} response - Response to detect
   * @returns {string} Format type
   */
  detectResponseFormat(response) {
    if (response === null) return 'null';
    if (response === undefined) return 'undefined';
    if (typeof response === 'string') return 'string';
    if (Array.isArray(response)) return 'array';

    if (typeof response === 'object') {
      // Check if it's a direct dream object
      if (response.id && response.structures && response.entities) {
        return 'dream_object';
      }

      // Check if it's wrapped content
      if (response.data || response.content) {
        return 'wrapped_content';
      }

      // Check if it's OpenAI format
      if (response.choices && Array.isArray(response.choices)) {
        return 'openai_format';
      }

      // Check if it's a generic object
      return 'object';
    }

    return 'unknown';
  }

  /**
   * Log structure details
   * @param {Object} inspection - Inspection result
   */
  logStructureDetails(inspection) {
    if (!this.options.enableDetailedLogging) {
      return;
    }

    const logData = {
      provider: inspection.provider,
      responseType: inspection.responseType,
      topLevelKeys: inspection.topLevelKeys,
      hasCommonFields: inspection.hasCommonFields,
      metadata: inspection.metadata,
    };

    // Log basic structure info
    logger[this.options.logLevel]('Response structure inspection', logData);

    // Log nested structure separately for readability
    if (Object.keys(inspection.nestedStructure).length > 0) {
      logger[this.options.logLevel]('Response nested structure', {
        provider: inspection.provider,
        structure: inspection.nestedStructure,
      });
    }

    // Log sample content separately
    if (inspection.sampleContent) {
      logger[this.options.logLevel]('Response sample content', {
        provider: inspection.provider,
        sample: inspection.sampleContent,
      });
    }
  }

  /**
   * Create a summary of inspection for error reporting
   * @param {Object} inspection - Inspection result
   * @returns {Object} Summary object
   */
  createInspectionSummary(inspection) {
    return {
      provider: inspection.provider,
      responseType: inspection.responseType,
      topLevelKeys: inspection.topLevelKeys,
      hasCommonFields: inspection.hasCommonFields,
      sampleLength: inspection.sampleContent?.length || 0,
      timestamp: inspection.timestamp,
    };
  }
}

module.exports = ResponseStructureInspector;
