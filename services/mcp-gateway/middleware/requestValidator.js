/**
 * Request Validator Middleware
 *
 * Validates incoming requests before processing to ensure they contain
 * all required fields and are in the correct format.
 * Now uses UnifiedValidator for consistent validation across services.
 */

const { logger } = require('../utils/logger');
const { UnifiedValidator, validationMonitor } = require('../../../shared');

class RequestValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      logValidation: options.logValidation !== false,
      ...options,
    };

    // Initialize unified validator for dream object validation
    this.unifiedValidator = new UnifiedValidator({
      strictMode: this.options.strictMode,
      logErrors: this.options.logValidation,
    });
  }

  /**
   * Validate dream parse request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  validateParseRequest(req, res, next) {
    const startTime = Date.now();
    const errors = [];

    // Extract request data
    const { text, style, options = {} } = req.body;

    // Validate text field
    if (!text) {
      errors.push({
        field: 'text',
        error: 'MISSING_REQUIRED_FIELD',
        message: 'Text field is required',
      });
    } else if (typeof text !== 'string') {
      errors.push({
        field: 'text',
        error: 'INVALID_TYPE',
        message: 'Text must be a string',
        expected: 'string',
        received: typeof text,
      });
    } else if (text.trim().length === 0) {
      errors.push({
        field: 'text',
        error: 'EMPTY_VALUE',
        message: 'Text cannot be empty',
      });
    } else if (text.length > 10000) {
      errors.push({
        field: 'text',
        error: 'VALUE_TOO_LONG',
        message: 'Text exceeds maximum length of 10000 characters',
        expected: '<= 10000',
        received: text.length,
      });
    }

    // Validate style field (optional but must be valid if provided)
    if (style !== undefined) {
      const validStyles = [
        'ethereal',
        'cyberpunk',
        'surreal',
        'fantasy',
        'nightmare',
        'nature',
        'abstract',
      ];

      if (typeof style !== 'string') {
        errors.push({
          field: 'style',
          error: 'INVALID_TYPE',
          message: 'Style must be a string',
          expected: 'string',
          received: typeof style,
        });
      } else if (!validStyles.includes(style.toLowerCase())) {
        errors.push({
          field: 'style',
          error: 'INVALID_ENUM_VALUE',
          message: `Style must be one of: ${validStyles.join(', ')}`,
          expected: validStyles,
          received: style,
        });
      }
    }

    // Validate options field (optional but must be object if provided)
    if (options !== undefined && typeof options !== 'object') {
      errors.push({
        field: 'options',
        error: 'INVALID_TYPE',
        message: 'Options must be an object',
        expected: 'object',
        received: typeof options,
      });
    }

    // Validate specific option fields if provided
    if (typeof options === 'object') {
      if (options.temperature !== undefined) {
        if (typeof options.temperature !== 'number') {
          errors.push({
            field: 'options.temperature',
            error: 'INVALID_TYPE',
            message: 'Temperature must be a number',
            expected: 'number',
            received: typeof options.temperature,
          });
        } else if (options.temperature < 0 || options.temperature > 2) {
          errors.push({
            field: 'options.temperature',
            error: 'VALUE_OUT_OF_RANGE',
            message: 'Temperature must be between 0 and 2',
            expected: '0-2',
            received: options.temperature,
          });
        }
      }

      if (options.maxTokens !== undefined) {
        if (typeof options.maxTokens !== 'number') {
          errors.push({
            field: 'options.maxTokens',
            error: 'INVALID_TYPE',
            message: 'MaxTokens must be a number',
            expected: 'number',
            received: typeof options.maxTokens,
          });
        } else if (options.maxTokens < 100 || options.maxTokens > 100000) {
          errors.push({
            field: 'options.maxTokens',
            error: 'VALUE_OUT_OF_RANGE',
            message: 'MaxTokens must be between 100 and 100000',
            expected: '100-100000',
            received: options.maxTokens,
          });
        }
      }

      if (options.timeout !== undefined) {
        if (typeof options.timeout !== 'number') {
          errors.push({
            field: 'options.timeout',
            error: 'INVALID_TYPE',
            message: 'Timeout must be a number',
            expected: 'number',
            received: typeof options.timeout,
          });
        } else if (options.timeout < 1000 || options.timeout > 120000) {
          errors.push({
            field: 'options.timeout',
            error: 'VALUE_OUT_OF_RANGE',
            message: 'Timeout must be between 1000 and 120000 milliseconds',
            expected: '1000-120000',
            received: options.timeout,
          });
        }
      }
    }

    const validationTime = Date.now() - startTime;

    // Log validation results
    if (this.options.logValidation) {
      if (errors.length > 0) {
        logger.warn('Request validation failed', {
          endpoint: '/parse',
          errorCount: errors.length,
          errors: errors.map((e) => ({
            field: e.field,
            error: e.error,
            message: e.message,
          })),
          validationTime,
        });
      } else {
        logger.debug('Request validation passed', {
          endpoint: '/parse',
          textLength: text?.length || 0,
          style: style || 'default',
          validationTime,
        });
      }
    }

    // If validation failed, return error response
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Request validation failed',
        validationErrors: errors,
        errorCount: errors.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Attach validation metadata to request for downstream use
    req.validationMetadata = {
      validated: true,
      validationTime,
      timestamp: new Date().toISOString(),
    };

    // Validation passed, proceed to next middleware
    next();
  }

  /**
   * Validate provider-specific request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  validateProviderRequest(req, res, next) {
    const errors = [];
    const { provider, operation, data } = req.body;

    // Validate provider field
    if (!provider) {
      errors.push({
        field: 'provider',
        error: 'MISSING_REQUIRED_FIELD',
        message: 'Provider field is required',
      });
    } else if (typeof provider !== 'string') {
      errors.push({
        field: 'provider',
        error: 'INVALID_TYPE',
        message: 'Provider must be a string',
        expected: 'string',
        received: typeof provider,
      });
    }

    // Validate operation field
    if (!operation) {
      errors.push({
        field: 'operation',
        error: 'MISSING_REQUIRED_FIELD',
        message: 'Operation field is required',
      });
    } else if (typeof operation !== 'string') {
      errors.push({
        field: 'operation',
        error: 'INVALID_TYPE',
        message: 'Operation must be a string',
        expected: 'string',
        received: typeof operation,
      });
    }

    // Validate data field
    if (!data) {
      errors.push({
        field: 'data',
        error: 'MISSING_REQUIRED_FIELD',
        message: 'Data field is required',
      });
    } else if (typeof data !== 'object') {
      errors.push({
        field: 'data',
        error: 'INVALID_TYPE',
        message: 'Data must be an object',
        expected: 'object',
        received: typeof data,
      });
    }

    // Log validation results
    if (this.options.logValidation) {
      if (errors.length > 0) {
        logger.warn('Provider request validation failed', {
          provider,
          operation,
          errorCount: errors.length,
          errors,
        });
      } else {
        logger.debug('Provider request validation passed', {
          provider,
          operation,
        });
      }
    }

    // If validation failed, return error response
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Provider request validation failed',
        validationErrors: errors,
        errorCount: errors.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Validation passed, proceed to next middleware
    next();
  }

  /**
   * Create middleware function for parse request validation
   */
  parseRequestMiddleware() {
    return this.validateParseRequest.bind(this);
  }

  /**
   * Create middleware function for provider request validation
   */
  providerRequestMiddleware() {
    return this.validateProviderRequest.bind(this);
  }

  /**
   * Validate dream response using unified validator
   * @param {Object} dreamData - Dream object to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateDreamResponse(dreamData, options = {}) {
    const startTime = Date.now();

    try {
      // Use unified validator for comprehensive validation
      const validationResult = this.unifiedValidator.validateDreamObject(
        dreamData,
        options
      );

      const validationTime = Date.now() - startTime;

      // Record validation in monitor
      validationMonitor.recordValidation('mcp-gateway', validationResult, {
        provider: options.provider || 'unknown',
        dreamId: dreamData?.id,
        operation: options.operation || 'dream_response_validation',
        ...options.context,
      });

      // Log validation results
      if (this.options.logValidation) {
        if (!validationResult.valid) {
          logger.warn('Dream response validation failed', {
            errorCount: validationResult.errorCount,
            errors: validationResult.errors.slice(0, 5).map((e) => ({
              field: e.field,
              error: e.error,
              message: e.message,
            })),
            validationTime,
          });
        } else {
          logger.debug('Dream response validation passed', {
            validationTime,
            dreamId: dreamData?.id,
          });
        }
      }

      return {
        valid: validationResult.valid,
        errors: validationResult.errors,
        errorCount: validationResult.errorCount,
        validationTime,
        categorized: validationResult.categorized,
      };
    } catch (error) {
      logger.error('Dream response validation error', {
        error: error.message,
        stack: error.stack,
      });

      const errorResult = {
        valid: false,
        errors: [
          {
            field: 'validation_system',
            error: 'VALIDATION_ERROR',
            message: `Validation failed: ${error.message}`,
            severity: 'critical',
          },
        ],
        errorCount: 1,
        validationTime: Date.now() - startTime,
      };

      // Record error in monitor
      validationMonitor.recordValidation('mcp-gateway', errorResult, {
        provider: options.provider || 'unknown',
        dreamId: dreamData?.id,
        operation: options.operation || 'dream_response_validation',
        error: error.message,
      });

      return errorResult;
    }
  }

  /**
   * Validate dream response for rendering
   * @param {Object} dreamData - Dream object to validate
   * @returns {Object} Renderability check result
   */
  validateDreamForRendering(dreamData) {
    const startTime = Date.now();

    try {
      // Use unified validator's renderability check
      const renderCheck = this.unifiedValidator.isRenderable(dreamData);

      const validationTime = Date.now() - startTime;

      // Log validation results
      if (this.options.logValidation) {
        if (!renderCheck.renderable) {
          logger.warn('Dream is not renderable', {
            errorCount: renderCheck.errorCount,
            errors: renderCheck.errors.slice(0, 5),
            validationTime,
          });
        } else {
          logger.debug('Dream is renderable', {
            validationTime,
            dreamId: dreamData?.id,
          });
        }
      }

      return {
        renderable: renderCheck.renderable,
        errors: renderCheck.errors,
        errorCount: renderCheck.errorCount,
        validationTime,
      };
    } catch (error) {
      logger.error('Renderability validation error', {
        error: error.message,
        stack: error.stack,
      });

      return {
        renderable: false,
        errors: [
          {
            field: 'validation_system',
            message: `Renderability check failed: ${error.message}`,
            severity: 'critical',
          },
        ],
        errorCount: 1,
        validationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      strictMode: this.options.strictMode,
      logValidation: this.options.logValidation,
      unifiedValidatorEnabled: true,
    };
  }
}

module.exports = RequestValidator;
