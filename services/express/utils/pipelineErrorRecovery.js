/**
 * Pipeline Error Recovery Strategies
 *
 * Provides fallback mechanisms and data recovery strategies for pipeline failures.
 */

const { logger } = require('./logger');
const { createFallbackDream } = require('./fallbackGenerator');

class PipelineErrorRecovery {
  /**
   * Recover from text extraction failure
   * This is typically unrecoverable as we need the response text
   */
  static async recoverFromTextExtraction(error, previousData, context) {
    logger.error('Text extraction failed - unrecoverable', {
      requestId: context.requestId,
      error: error.message,
      errorType: error.constructor.name,
    });

    // Cannot recover from text extraction failure
    throw error;
  }

  /**
   * Recover from JSON parsing failure
   * Attempt to clean and re-parse the JSON
   */
  static async recoverFromJsonParsing(error, previousData, context) {
    logger.warn('JSON parsing failed, attempting recovery', {
      requestId: context.requestId,
      error: error.message,
    });

    // If we have the raw text, try to clean it
    if (typeof previousData === 'string') {
      try {
        // Attempt to fix common JSON issues
        let cleanedJson = previousData
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .replace(/'/g, '"') // Replace single quotes with double quotes
          .replace(/\n/g, '\\n') // Escape newlines
          .replace(/\r/g, '\\r'); // Escape carriage returns

        const parsed = JSON.parse(cleanedJson);

        logger.info('JSON parsing recovery successful', {
          requestId: context.requestId,
          originalLength: previousData.length,
          cleanedLength: cleanedJson.length,
        });

        return parsed;
      } catch (recoveryError) {
        logger.error('JSON parsing recovery failed', {
          requestId: context.requestId,
          error: recoveryError.message,
        });
      }
    }

    // Cannot recover - throw original error
    throw error;
  }

  /**
   * Recover from structure validation failure
   * Attempt to fix the response structure
   */
  static async recoverFromStructureValidation(error, previousData, context) {
    logger.warn('Structure validation failed, attempting recovery', {
      requestId: context.requestId,
      error: error.message,
    });

    // If we have parsed data, try to fix the structure
    if (previousData && typeof previousData === 'object') {
      try {
        // Ensure success field exists
        if (!('success' in previousData)) {
          previousData.success = true;
          logger.info('Added missing success field', {
            requestId: context.requestId,
          });
        }

        // If we have data or fallback, consider it valid
        if (previousData.data || previousData.fallback) {
          logger.info('Structure validation recovery successful', {
            requestId: context.requestId,
            hasData: !!previousData.data,
            hasFallback: !!previousData.fallback,
          });
          return previousData;
        }
      } catch (recoveryError) {
        logger.error('Structure validation recovery failed', {
          requestId: context.requestId,
          error: recoveryError.message,
        });
      }
    }

    // Cannot recover - throw original error
    throw error;
  }

  /**
   * Recover from dream extraction failure
   * Generate a fallback dream
   */
  static async recoverFromDreamExtraction(error, previousData, context) {
    logger.warn('Dream extraction failed, generating fallback', {
      requestId: context.requestId,
      error: error.message,
    });

    try {
      // Create a fallback dream using the original text
      const fallbackDream = createFallbackDream(
        context.originalText || 'Emergency dream scene',
        'ethereal',
        { requestId: context.requestId }
      );

      logger.info('Dream extraction recovery successful - fallback generated', {
        requestId: context.requestId,
        fallbackId: fallbackDream.id,
        fallbackTitle: fallbackDream.title,
      });

      return {
        dreamData: fallbackDream,
        dataSource: 'fallback_generator_recovery',
      };
    } catch (recoveryError) {
      logger.error('Dream extraction recovery failed', {
        requestId: context.requestId,
        error: recoveryError.message,
      });
      throw error;
    }
  }

  /**
   * Recover from schema validation failure
   * Attempt to repair the dream data or use fallback
   */
  static async recoverFromSchemaValidation(error, previousData, context) {
    logger.warn('Schema validation failed, attempting recovery', {
      requestId: context.requestId,
      error: error.message,
      hasPreviousData: !!previousData,
    });

    try {
      // If we have previous data with dreamData, try to use it
      if (previousData && previousData.dreamData) {
        logger.info('Using previous dream data for recovery', {
          requestId: context.requestId,
          dreamId: previousData.dreamData.id,
        });

        // Return the previous data with a note about validation issues
        return {
          ...previousData,
          validation: {
            valid: false,
            errors: [error.message],
            recovered: true,
          },
        };
      }

      // Otherwise, generate a fallback dream
      const fallbackDream = createFallbackDream(
        context.originalText || 'Emergency dream scene',
        'ethereal',
        { requestId: context.requestId }
      );

      logger.info(
        'Schema validation recovery successful - fallback generated',
        {
          requestId: context.requestId,
          fallbackId: fallbackDream.id,
        }
      );

      return {
        dreamData: fallbackDream,
        dataSource: 'fallback_generator_recovery',
        validation: { valid: true, errors: [], recovered: true },
      };
    } catch (recoveryError) {
      logger.error('Schema validation recovery failed', {
        requestId: context.requestId,
        error: recoveryError.message,
      });
      throw error;
    }
  }

  /**
   * Recover from any pipeline stage failure
   * Generic recovery strategy
   */
  static async recoverFromGenericFailure(
    stageName,
    error,
    previousData,
    context
  ) {
    logger.warn(`Generic recovery for stage: ${stageName}`, {
      requestId: context.requestId,
      error: error.message,
      hasPreviousData: !!previousData,
    });

    // Try to use previous data if available
    if (previousData) {
      logger.info(`Using previous data for ${stageName} recovery`, {
        requestId: context.requestId,
      });
      return previousData;
    }

    // If no previous data, generate fallback
    if (context.originalText) {
      const fallbackDream = createFallbackDream(
        context.originalText,
        'ethereal',
        { requestId: context.requestId }
      );

      logger.info(`Generated fallback for ${stageName} recovery`, {
        requestId: context.requestId,
        fallbackId: fallbackDream.id,
      });

      return {
        dreamData: fallbackDream,
        dataSource: 'fallback_generator_recovery',
      };
    }

    // Cannot recover
    throw error;
  }

  /**
   * Determine if an error is recoverable
   */
  static isRecoverable(error, stageName) {
    // Network errors are typically not recoverable
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return false;
    }

    // Text extraction failures are not recoverable
    if (stageName === 'text_extraction') {
      return false;
    }

    // Most other errors can be recovered from
    return true;
  }

  /**
   * Get recovery strategy for a specific stage
   */
  static getRecoveryStrategy(stageName) {
    const strategies = {
      text_extraction: this.recoverFromTextExtraction,
      json_parsing: this.recoverFromJsonParsing,
      structure_validation: this.recoverFromStructureValidation,
      dream_extraction: this.recoverFromDreamExtraction,
      schema_validation: this.recoverFromSchemaValidation,
    };

    return (
      strategies[stageName] ||
      this.recoverFromGenericFailure.bind(null, stageName)
    );
  }

  /**
   * Log recovery attempt
   */
  static logRecoveryAttempt(stageName, error, context) {
    logger.info('Attempting error recovery', {
      requestId: context.requestId,
      stage: stageName,
      error: error.message,
      errorType: error.constructor.name,
      isRecoverable: this.isRecoverable(error, stageName),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log recovery result
   */
  static logRecoveryResult(stageName, success, context, details = {}) {
    if (success) {
      logger.info('Error recovery successful', {
        requestId: context.requestId,
        stage: stageName,
        ...details,
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.error('Error recovery failed', {
        requestId: context.requestId,
        stage: stageName,
        ...details,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = PipelineErrorRecovery;
