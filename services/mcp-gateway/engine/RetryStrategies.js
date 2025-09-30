// engine/RetryStrategies.js
// Intelligent retry strategies for validation error recovery

const _ = require('lodash');
const winston = require('winston');

// Import dependencies
const validationConfig = require('../config/validation');
const BaseTemplates = require('../templates/BaseTemplates');

class RetryStrategies {
  constructor(options = {}) {
    this.config = _.merge({}, validationConfig, options);
    this.baseTemplates = new BaseTemplates();

    this.metrics = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      retriesByStrategy: {},
      retriesByErrorType: {},
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/retry-strategies.log' }),
      ],
    });

    // Initialize retry strategies
    this.strategies = this.initializeStrategies();
  }

  /**
   * Initialize retry strategies for different error types
   */
  initializeStrategies() {
    return {
      // Schema validation errors
      schema_validation: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        strategy: this.handleSchemaValidationError.bind(this),
      },

      // Content quality errors
      content_quality: {
        maxRetries: 2,
        backoffMultiplier: 2.0,
        strategy: this.handleContentQualityError.bind(this),
      },

      // Missing field errors
      missing_field: {
        maxRetries: 1,
        backoffMultiplier: 1.0,
        strategy: this.handleMissingFieldError.bind(this),
      },

      // Invalid value errors
      invalid_value: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        strategy: this.handleInvalidValueError.bind(this),
      },

      // Structure errors
      structure_error: {
        maxRetries: 3,
        backoffMultiplier: 2.0,
        strategy: this.handleStructureError.bind(this),
      },

      // Type mismatch errors
      type_mismatch: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        strategy: this.handleTypeMismatchError.bind(this),
      },

      // Range errors
      range_error: {
        maxRetries: 1,
        backoffMultiplier: 1.0,
        strategy: this.handleRangeError.bind(this),
      },

      // Format errors
      format_error: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        strategy: this.handleFormatError.bind(this),
      },

      // Consistency errors
      consistency_error: {
        maxRetries: 2,
        backoffMultiplier: 2.0,
        strategy: this.handleConsistencyError.bind(this),
      },

      // Completeness errors
      completeness_error: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        strategy: this.handleCompletenessError.bind(this),
      },
    };
  }

  /**
   * Execute retry strategy for validation errors
   * @param {Array} errors - Validation errors to handle
   * @param {Object} originalContent - Original content that failed validation
   * @param {Object} context - Context information (prompt, provider, etc.)
   * @param {Object} options - Retry options
   * @returns {Object} Retry strategy result
   */
  async executeRetryStrategy(
    errors,
    originalContent,
    context = {},
    options = {}
  ) {
    this.metrics.totalRetries++;

    const startTime = Date.now();
    const result = {
      success: false,
      strategy: null,
      retryPrompt: null,
      retryOptions: {},
      errors: [...errors],
      processingTime: 0,
      recommendations: [],
    };

    try {
      // Group errors by type to determine primary strategy
      const errorsByType = this.groupErrorsByType(errors);
      const primaryErrorType = this.determinePrimaryErrorType(errorsByType);

      if (!primaryErrorType || !this.strategies[primaryErrorType]) {
        throw new Error(
          `No retry strategy available for error type: ${primaryErrorType}`
        );
      }

      const strategy = this.strategies[primaryErrorType];
      result.strategy = primaryErrorType;

      this.logger.info('Executing retry strategy', {
        strategy: primaryErrorType,
        errorCount: errors.length,
        context: {
          provider: context.provider,
          model: context.model,
        },
      });

      // Execute the specific strategy
      const strategyResult = await strategy.strategy(
        errors,
        originalContent,
        context,
        options
      );

      result.success = strategyResult.success;
      result.retryPrompt = strategyResult.retryPrompt;
      result.retryOptions = strategyResult.retryOptions || {};
      result.recommendations = strategyResult.recommendations || [];

      // Track strategy usage
      this.metrics.retriesByStrategy[primaryErrorType] =
        (this.metrics.retriesByStrategy[primaryErrorType] || 0) + 1;

      // Track by individual error types
      for (const errorType of Object.keys(errorsByType)) {
        this.metrics.retriesByErrorType[errorType] =
          (this.metrics.retriesByErrorType[errorType] || 0) + 1;
      }

      if (result.success) {
        this.metrics.successfulRetries++;
      } else {
        this.metrics.failedRetries++;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Retry strategy completed', {
        strategy: primaryErrorType,
        success: result.success,
        hasRetryPrompt: !!result.retryPrompt,
        recommendationCount: result.recommendations.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      this.metrics.failedRetries++;
      result.processingTime = Date.now() - startTime;

      this.logger.error('Retry strategy execution failed', {
        error: error.message,
        stack: error.stack,
        strategy: result.strategy,
      });

      throw new Error(`Retry strategy failed: ${error.message}`);
    }
  }

  /**
   * Handle schema validation errors
   */
  async handleSchemaValidationError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      // Analyze schema validation errors
      const schemaErrors = errors.filter((e) => e.type === 'schema_validation');
      const missingFields = schemaErrors.filter((e) =>
        e.message?.includes('required')
      );
      const typeErrors = schemaErrors.filter((e) =>
        e.message?.includes('type')
      );

      // Build corrective prompt
      const template = this.baseTemplates.getTemplate('content_repair');
      if (template) {
        const errorSummary = this.summarizeErrors(schemaErrors);
        const schemaInfo = this.getSchemaInfo(
          context.expectedSchema || 'dreamResponse'
        );

        result.retryPrompt = template.template
          .replace('{content}', JSON.stringify(originalContent, null, 2))
          .replace('{issues}', errorSummary)
          .replace('{schema}', schemaInfo);

        result.retryOptions = {
          temperature: Math.max(0.3, (context.temperature || 0.7) - 0.2),
          maxTokens: Math.min(32768, (context.maxTokens || 4096) * 1.5),
          systemPrompt:
            'Focus on creating valid JSON structure that matches the required schema exactly.',
        };

        result.success = true;
      }

      // Add specific recommendations
      if (missingFields.length > 0) {
        result.recommendations.push({
          type: 'missing_fields',
          message: `Ensure all required fields are present: ${missingFields
            .map((e) => e.field)
            .join(', ')}`,
          priority: 'high',
        });
      }

      if (typeErrors.length > 0) {
        result.recommendations.push({
          type: 'type_errors',
          message: 'Check data types for all fields match the expected schema',
          priority: 'high',
        });
      }

      return result;
    } catch (error) {
      throw new Error(
        `Schema validation retry strategy failed: ${error.message}`
      );
    }
  }

  /**
   * Handle content quality errors
   */
  async handleContentQualityError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const qualityErrors = errors.filter((e) => e.type === 'content_quality');

      // Build enhancement prompt
      let enhancementPrompt = `The previous response had quality issues. Please improve the content by:\n\n`;

      for (const error of qualityErrors) {
        if (error.field?.includes('description')) {
          enhancementPrompt += `- Make descriptions more detailed and vivid (minimum 50 characters)\n`;
        }
        if (error.field?.includes('title')) {
          enhancementPrompt += `- Create a more engaging and relevant title\n`;
        }
        if (error.field?.includes('scenes')) {
          enhancementPrompt += `- Ensure all scenes have detailed descriptions and proper object arrays\n`;
        }
      }

      enhancementPrompt += `\nOriginal content to improve:\n${JSON.stringify(
        originalContent,
        null,
        2
      )}`;

      result.retryPrompt = enhancementPrompt;
      result.retryOptions = {
        temperature: Math.min(0.9, (context.temperature || 0.7) + 0.1),
        maxTokens: context.maxTokens || 4096,
        systemPrompt:
          'Focus on creating rich, detailed, and engaging content that meets high quality standards.',
      };

      result.recommendations.push({
        type: 'content_enhancement',
        message: 'Increase creativity and detail in descriptions',
        priority: 'medium',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(
        `Content quality retry strategy failed: ${error.message}`
      );
    }
  }

  /**
   * Handle missing field errors
   */
  async handleMissingFieldError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const missingFieldErrors = errors.filter(
        (e) => e.type === 'missing_field'
      );
      const missingFields = missingFieldErrors
        .map((e) => e.field)
        .filter(Boolean);

      if (missingFields.length === 0) {
        return result;
      }

      let retryPrompt = `The previous response was missing required fields. Please provide a complete response that includes:\n\n`;

      for (const field of missingFields) {
        retryPrompt += `- ${field}: ${this.getFieldDescription(field)}\n`;
      }

      retryPrompt += `\nEnsure the response includes all required fields in the correct format.`;

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: Math.max(0.3, (context.temperature || 0.7) - 0.1),
        systemPrompt:
          'Ensure all required fields are included in the response.',
      };

      result.recommendations.push({
        type: 'missing_fields',
        message: `Include missing fields: ${missingFields.join(', ')}`,
        priority: 'high',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(`Missing field retry strategy failed: ${error.message}`);
    }
  }

  /**
   * Handle invalid value errors
   */
  async handleInvalidValueError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const invalidValueErrors = errors.filter(
        (e) => e.type === 'invalid_value'
      );

      let retryPrompt = `The previous response contained invalid values. Please correct:\n\n`;

      for (const error of invalidValueErrors) {
        retryPrompt += `- ${error.field}: ${error.message}\n`;
      }

      retryPrompt += `\nEnsure all values are within valid ranges and use correct enums.`;

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: Math.max(0.2, (context.temperature || 0.7) - 0.2),
        systemPrompt: 'Use only valid values and stay within specified ranges.',
      };

      result.recommendations.push({
        type: 'value_validation',
        message: 'Check all values against valid ranges and enum options',
        priority: 'high',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(`Invalid value retry strategy failed: ${error.message}`);
    }
  }

  /**
   * Handle structure errors
   */
  async handleStructureError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const structureErrors = errors.filter(
        (e) => e.type === 'structure_error'
      );

      const template = this.baseTemplates.getTemplate('content_repair');
      if (template) {
        const errorSummary = this.summarizeErrors(structureErrors);
        const schemaInfo = this.getSchemaInfo(
          context.expectedSchema || 'dreamResponse'
        );

        result.retryPrompt = template.template
          .replace('{content}', JSON.stringify(originalContent, null, 2))
          .replace('{issues}', `Structure errors: ${errorSummary}`)
          .replace('{schema}', schemaInfo);

        result.retryOptions = {
          temperature: 0.3,
          systemPrompt: 'Focus on correct JSON structure and object hierarchy.',
        };

        result.success = true;
      }

      result.recommendations.push({
        type: 'structure_fix',
        message: 'Ensure proper JSON structure and object nesting',
        priority: 'high',
      });

      return result;
    } catch (error) {
      throw new Error(
        `Structure error retry strategy failed: ${error.message}`
      );
    }
  }

  /**
   * Handle type mismatch errors
   */
  async handleTypeMismatchError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const typeMismatchErrors = errors.filter(
        (e) => e.type === 'type_mismatch'
      );

      let retryPrompt = `The previous response had incorrect data types. Please fix:\n\n`;

      for (const error of typeMismatchErrors) {
        retryPrompt += `- ${error.field}: ${error.message}\n`;
      }

      retryPrompt += `\nEnsure all fields use the correct data types (string, number, array, object, boolean).`;

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: 0.3,
        systemPrompt: 'Pay careful attention to data types for all fields.',
      };

      result.recommendations.push({
        type: 'type_correction',
        message: 'Verify data types match schema requirements',
        priority: 'high',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(`Type mismatch retry strategy failed: ${error.message}`);
    }
  }

  /**
   * Handle range errors
   */
  async handleRangeError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const rangeErrors = errors.filter((e) => e.type === 'range_error');

      let retryPrompt = `The previous response had values outside valid ranges. Please correct:\n\n`;

      for (const error of rangeErrors) {
        retryPrompt += `- ${error.field}: ${error.message}\n`;
      }

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: Math.max(0.2, (context.temperature || 0.7) - 0.3),
        systemPrompt: 'Ensure all numeric values are within specified ranges.',
      };

      result.recommendations.push({
        type: 'range_correction',
        message: 'Keep all values within valid ranges',
        priority: 'medium',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(`Range error retry strategy failed: ${error.message}`);
    }
  }

  /**
   * Handle format errors
   */
  async handleFormatError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const formatErrors = errors.filter((e) => e.type === 'format_error');

      let retryPrompt = `The previous response had formatting issues. Please fix:\n\n`;

      for (const error of formatErrors) {
        retryPrompt += `- ${error.field}: ${error.message}\n`;
      }

      retryPrompt += `\nEnsure proper formatting for all fields (dates, colors, patterns, etc.).`;

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: 0.4,
        systemPrompt: 'Use correct formatting for all field types.',
      };

      result.recommendations.push({
        type: 'format_correction',
        message: 'Apply correct formatting to all fields',
        priority: 'medium',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(`Format error retry strategy failed: ${error.message}`);
    }
  }

  /**
   * Handle consistency errors
   */
  async handleConsistencyError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const consistencyErrors = errors.filter(
        (e) => e.type === 'consistency_error'
      );

      let retryPrompt = `The previous response had consistency issues. Please ensure:\n\n`;

      for (const error of consistencyErrors) {
        retryPrompt += `- ${error.message}\n`;
      }

      retryPrompt += `\nMake sure all related fields are consistent with each other.`;

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: Math.min(0.8, (context.temperature || 0.7) + 0.1),
        systemPrompt: 'Ensure consistency between related fields and values.',
      };

      result.recommendations.push({
        type: 'consistency_check',
        message: 'Verify consistency between related fields',
        priority: 'medium',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(
        `Consistency error retry strategy failed: ${error.message}`
      );
    }
  }

  /**
   * Handle completeness errors
   */
  async handleCompletenessError(errors, originalContent, context, options) {
    const result = {
      success: false,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
    };

    try {
      const completenessErrors = errors.filter(
        (e) => e.type === 'completeness_error'
      );

      let retryPrompt = `The previous response was incomplete. Please provide:\n\n`;

      for (const error of completenessErrors) {
        retryPrompt += `- ${error.message}\n`;
      }

      retryPrompt += `\nEnsure the response is complete and includes all necessary information.`;

      result.retryPrompt = retryPrompt;
      result.retryOptions = {
        temperature: Math.min(0.9, (context.temperature || 0.7) + 0.2),
        maxTokens: Math.min(32768, (context.maxTokens || 4096) * 1.5),
        systemPrompt: 'Provide complete and comprehensive responses.',
      };

      result.recommendations.push({
        type: 'completeness_enhancement',
        message: 'Provide more complete and detailed information',
        priority: 'medium',
      });

      result.success = true;
      return result;
    } catch (error) {
      throw new Error(
        `Completeness error retry strategy failed: ${error.message}`
      );
    }
  }

  /**
   * Group errors by type for strategy selection
   */
  groupErrorsByType(errors) {
    const grouped = {};
    for (const error of errors) {
      const type = error.type || 'unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(error);
    }
    return grouped;
  }

  /**
   * Determine primary error type for strategy selection
   */
  determinePrimaryErrorType(errorsByType) {
    // Priority order for error types
    const priorityOrder = [
      'structure_error',
      'schema_validation',
      'missing_field',
      'type_mismatch',
      'invalid_value',
      'format_error',
      'range_error',
      'consistency_error',
      'content_quality',
      'completeness_error',
    ];

    for (const type of priorityOrder) {
      if (errorsByType[type] && errorsByType[type].length > 0) {
        return type;
      }
    }

    // Return the type with the most errors if no priority match
    const sortedTypes = Object.keys(errorsByType).sort(
      (a, b) => errorsByType[b].length - errorsByType[a].length
    );

    return sortedTypes[0] || null;
  }

  /**
   * Summarize errors for prompt inclusion
   */
  summarizeErrors(errors) {
    return errors
      .map(
        (error) =>
          `${error.field || 'unknown'}: ${error.message || 'validation failed'}`
      )
      .join('\n');
  }

  /**
   * Get schema information for prompts
   */
  getSchemaInfo(schemaType) {
    const schemaDescriptions = {
      dreamResponse:
        'Dream response with success, data (id, title, description, scenes), and metadata',
      sceneData:
        '3D scene with id, title, style, structures, entities, and cinematography',
      videoParameters:
        'Video parameters with resolution, fps, duration, and quality',
    };

    return schemaDescriptions[schemaType] || 'Standard JSON structure';
  }

  /**
   * Get field description for missing field prompts
   */
  getFieldDescription(field) {
    const descriptions = {
      id: 'unique identifier string',
      title: 'descriptive title (5-200 characters)',
      description: 'detailed description (20-2000 characters)',
      scenes: 'array of scene objects with id, description, and objects',
      success: 'boolean indicating operation success',
      metadata:
        'object with source, model, processingTime, quality, tokens, confidence',
      cinematography: 'object with shots array and duration',
      confidence: 'number between 0 and 1',
      quality: 'string: draft, standard, high, or cinematic',
    };

    return descriptions[field] || 'required field';
  }

  /**
   * Get retry metrics
   */
  getRetryMetrics() {
    const totalRetries = this.metrics.totalRetries;
    const successRate =
      totalRetries > 0
        ? (this.metrics.successfulRetries / totalRetries) * 100
        : 0;

    return {
      totalRetries: this.metrics.totalRetries,
      successfulRetries: this.metrics.successfulRetries,
      failedRetries: this.metrics.failedRetries,
      successRate: successRate,
      retriesByStrategy: { ...this.metrics.retriesByStrategy },
      retriesByErrorType: { ...this.metrics.retriesByErrorType },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Reset retry metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      retriesByStrategy: {},
      retriesByErrorType: {},
    };
  }
}

module.exports = RetryStrategies;
