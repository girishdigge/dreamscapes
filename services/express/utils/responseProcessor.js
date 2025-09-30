// services/express/utils/responseProcessor.js
const { logger } = require('./logger');
const { validateDream } = require('../middleware/validation');

/**
 * Enhanced MCP Gateway response processor
 * Handles parsing, validation, and logging of MCP Gateway responses
 */
class MCPResponseProcessor {
  constructor() {
    this.validationCache = new Map();
  }

  /**
   * Process MCP Gateway response with comprehensive validation and logging
   * @param {Response} response - Fetch response object
   * @param {string} requestId - Unique request identifier
   * @param {number} responseTime - Response time in milliseconds
   * @param {string} originalText - Original dream text for context
   * @returns {Object} Processed response with dreamJson and metadata
   */
  async processResponse(response, requestId, responseTime, originalText) {
    logger.info('Starting MCP Gateway response processing', {
      requestId,
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    // Step 1: Extract response text
    const responseText = await this.extractResponseText(response, requestId);

    // Step 2: Parse JSON response
    const parsedResponse = this.parseJsonResponse(responseText, requestId);

    // Step 3: Validate response structure
    const validatedResponse = this.validateResponseStructure(
      parsedResponse,
      requestId
    );

    // Step 4: Extract and validate dream data
    const dreamData = this.extractDreamData(
      validatedResponse,
      requestId,
      originalText
    );

    // Step 5: Validate dream schema
    const validatedDream = this.validateDreamSchema(dreamData, requestId);

    // Step 6: Create final response object
    return this.createProcessedResponse(
      validatedDream,
      validatedResponse,
      requestId,
      responseTime
    );
  }

  /**
   * Extract response text with error handling
   */
  async extractResponseText(response, requestId) {
    try {
      const responseText = await response.text();

      logger.info('MCP Gateway response text extracted', {
        requestId,
        responseLength: responseText.length,
        responsePreview: this.createResponsePreview(responseText),
        isEmpty: responseText.length === 0,
      });

      if (responseText.length === 0) {
        throw new Error('MCP Gateway returned empty response body');
      }

      return responseText;
    } catch (error) {
      logger.error('Failed to extract MCP Gateway response text', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
      });
      throw new Error(`Failed to read response body: ${error.message}`);
    }
  }

  /**
   * Parse JSON response with detailed error handling
   */
  parseJsonResponse(responseText, requestId) {
    try {
      const parsed = JSON.parse(responseText);

      logger.info('MCP Gateway JSON response parsed successfully', {
        requestId,
        responseType: typeof parsed,
        isObject: typeof parsed === 'object' && parsed !== null,
        hasSuccess: 'success' in parsed,
        hasData: 'data' in parsed,
        hasFallback: 'fallback' in parsed,
        hasError: 'error' in parsed,
        hasMetadata: 'metadata' in parsed,
        topLevelKeys: Object.keys(parsed || {}),
      });

      return parsed;
    } catch (parseError) {
      logger.error('Failed to parse MCP Gateway JSON response', {
        requestId,
        parseError: parseError.message,
        responseTextPreview: this.createResponsePreview(responseText),
        responseLength: responseText.length,
        parseErrorPosition: parseError.message.match(/position (\d+)/)?.[1],
      });

      // Try to identify common JSON issues
      const jsonIssues = this.identifyJsonIssues(responseText);
      if (jsonIssues.length > 0) {
        logger.warn('Identified potential JSON issues', {
          requestId,
          issues: jsonIssues,
        });
      }

      throw new Error(
        `Invalid JSON response from MCP Gateway: ${parseError.message}`
      );
    }
  }

  /**
   * Validate MCP Gateway response structure
   */
  validateResponseStructure(parsedResponse, requestId) {
    logger.info('Validating MCP Gateway response structure', {
      requestId,
      responseType: typeof parsedResponse,
      isNull: parsedResponse === null,
      isArray: Array.isArray(parsedResponse),
    });

    // Check if response is an object
    if (typeof parsedResponse !== 'object' || parsedResponse === null) {
      logger.error('MCP Gateway response is not a valid object', {
        requestId,
        responseType: typeof parsedResponse,
        response: parsedResponse,
      });
      throw new Error(
        'MCP Gateway returned invalid response structure - expected object'
      );
    }

    // Check for required response fields
    const requiredFields = ['success'];
    const missingFields = requiredFields.filter(
      (field) => !(field in parsedResponse)
    );

    if (missingFields.length > 0) {
      logger.error('MCP Gateway response missing required fields', {
        requestId,
        missingFields,
        availableFields: Object.keys(parsedResponse),
        response: parsedResponse,
      });
      throw new Error(
        `MCP Gateway response missing required fields: ${missingFields.join(
          ', '
        )}`
      );
    }

    // Validate success field
    if (typeof parsedResponse.success !== 'boolean') {
      logger.error('MCP Gateway response success field is not boolean', {
        requestId,
        successType: typeof parsedResponse.success,
        successValue: parsedResponse.success,
      });
      throw new Error('MCP Gateway response success field must be boolean');
    }

    // Log response structure analysis
    logger.info('MCP Gateway response structure validated', {
      requestId,
      success: parsedResponse.success,
      hasData: !!parsedResponse.data,
      hasFallback: !!parsedResponse.fallback,
      hasError: !!parsedResponse.error,
      hasMetadata: !!parsedResponse.metadata,
      errorMessage: parsedResponse.error,
      metadataKeys: parsedResponse.metadata
        ? Object.keys(parsedResponse.metadata)
        : [],
    });

    return parsedResponse;
  }

  /**
   * Extract dream data from validated response
   */
  extractDreamData(validatedResponse, requestId, originalText) {
    logger.info('Extracting dream data from MCP Gateway response', {
      requestId,
      success: validatedResponse.success,
      hasData: !!validatedResponse.data,
      hasFallback: !!validatedResponse.fallback,
      hasError: !!validatedResponse.error,
    });

    // Handle unsuccessful responses
    if (!validatedResponse.success) {
      const errorMessage =
        validatedResponse.error || 'Unknown error from MCP Gateway';
      logger.error('MCP Gateway reported unsuccessful response', {
        requestId,
        error: errorMessage,
        hasData: !!validatedResponse.data,
        hasFallback: !!validatedResponse.fallback,
      });
      throw new Error(`MCP Gateway reported failure: ${errorMessage}`);
    }

    // Extract dream data (prefer data over fallback)
    let dreamData = null;
    let dataSource = 'unknown';

    if (validatedResponse.data) {
      dreamData = validatedResponse.data;
      dataSource = 'ai';
      logger.info('Using primary AI-generated dream data', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        dreamTitle: dreamData.title,
      });
    } else if (validatedResponse.fallback) {
      dreamData = validatedResponse.fallback;
      dataSource = 'ai_fallback';
      logger.info('Using fallback AI-generated dream data', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        dreamTitle: dreamData.title,
      });
    } else {
      logger.error('MCP Gateway response contains no dream data', {
        requestId,
        success: validatedResponse.success,
        availableFields: Object.keys(validatedResponse),
        response: validatedResponse,
      });
      throw new Error(
        'MCP Gateway response contains no dream data (no data or fallback field)'
      );
    }

    // Validate dream data is an object
    if (typeof dreamData !== 'object' || dreamData === null) {
      logger.error('Dream data is not a valid object', {
        requestId,
        dataSource,
        dreamDataType: typeof dreamData,
        dreamData,
      });
      throw new Error(
        `Dream data is not a valid object - got ${typeof dreamData}`
      );
    }

    // Log dream data structure
    logger.info('Dream data extracted successfully', {
      requestId,
      dataSource,
      dreamId: dreamData.id,
      dreamTitle: dreamData.title,
      dreamStyle: dreamData.style,
      hasStructures: Array.isArray(dreamData.structures),
      structureCount: dreamData.structures?.length || 0,
      hasEntities: Array.isArray(dreamData.entities),
      entityCount: dreamData.entities?.length || 0,
      hasCinematography: !!dreamData.cinematography,
      shotCount: dreamData.cinematography?.shots?.length || 0,
      hasEnvironment: !!dreamData.environment,
      environmentPreset: dreamData.environment?.preset,
    });

    return { dreamData, dataSource };
  }

  /**
   * Validate dream data against schema
   */
  validateDreamSchema(dreamDataResult, requestId) {
    const { dreamData, dataSource } = dreamDataResult;

    logger.info('Starting dream schema validation', {
      requestId,
      dataSource,
      dreamId: dreamData.id,
      validationCacheSize: this.validationCache.size,
    });

    // Create cache key for validation results
    const cacheKey = this.createValidationCacheKey(dreamData);

    // Check validation cache
    if (this.validationCache.has(cacheKey)) {
      const cachedResult = this.validationCache.get(cacheKey);
      logger.info('Using cached validation result', {
        requestId,
        cacheKey: cacheKey.substring(0, 16) + '...',
        cachedValid: cachedResult.valid,
        cachedErrorCount: cachedResult.errors?.length || 0,
      });
      return { ...dreamDataResult, validation: cachedResult };
    }

    // Perform validation
    const validation = validateDream(dreamData);

    // Cache validation result
    this.validationCache.set(cacheKey, validation);

    // Clean cache if it gets too large
    if (this.validationCache.size > 100) {
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }

    // Log validation results
    if (validation.valid) {
      logger.info('Dream schema validation passed', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        validationCached: false,
      });
    } else {
      logger.warn('Dream schema validation failed', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        errorCount: validation.errors?.length || 0,
        errors: validation.errors?.slice(0, 5), // Log first 5 errors
        validationType: validation.type || 'schema',
        validationDetails: validation.details
          ? validation.details.slice(0, 3)
          : undefined,
      });

      // Log detailed validation errors for debugging
      if (validation.errors && validation.errors.length > 0) {
        validation.errors.forEach((error, index) => {
          logger.debug('Dream validation error detail', {
            requestId,
            errorIndex: index,
            error,
            dreamId: dreamData.id,
          });
        });
      }
    }

    return { ...dreamDataResult, validation };
  }

  /**
   * Create final processed response object
   */
  createProcessedResponse(
    validatedDreamResult,
    originalResponse,
    requestId,
    responseTime
  ) {
    const { dreamData, dataSource, validation } = validatedDreamResult;

    // Extract metadata from original response
    const responseMetadata = originalResponse.metadata || {};

    // Create comprehensive metadata
    const metadata = {
      requestId,
      source: responseMetadata.source || dataSource,
      processingTimeMs: responseMetadata.processingTimeMs,
      responseTime,
      generatedAt: responseMetadata.generatedAt || new Date().toISOString(),
      validation: {
        valid: validation.valid,
        errorCount: validation.errors?.length || 0,
        validationType: validation.type,
      },
      originalResponseFields: Object.keys(originalResponse),
    };

    // Log final processing result
    logger.info('MCP Gateway response processing completed', {
      requestId,
      success: true,
      dreamId: dreamData.id,
      source: metadata.source,
      validationPassed: validation.valid,
      totalResponseTime: `${responseTime}ms`,
      processingSteps: [
        'text_extraction',
        'json_parsing',
        'structure_validation',
        'dream_data_extraction',
        'schema_validation',
        'response_creation',
      ],
    });

    return {
      dreamJson: dreamData,
      source: metadata.source,
      responseTime,
      requestId,
      metadata,
      validation,
      success: true,
    };
  }

  /**
   * Create a preview of response text for logging
   */
  createResponsePreview(responseText, maxLength = 300) {
    if (!responseText || responseText.length === 0) {
      return '[empty]';
    }

    if (responseText.length <= maxLength) {
      return responseText;
    }

    return (
      responseText.substring(0, maxLength) +
      `... [truncated, total length: ${responseText.length}]`
    );
  }

  /**
   * Identify common JSON parsing issues
   */
  identifyJsonIssues(responseText) {
    const issues = [];

    // Check for common issues
    if (responseText.includes('undefined')) {
      issues.push('Contains undefined values');
    }

    if (responseText.includes('NaN')) {
      issues.push('Contains NaN values');
    }

    if (responseText.match(/,\s*[}\]]/)) {
      issues.push('Trailing commas detected');
    }

    if (responseText.match(/[^\\]'/)) {
      issues.push('Unescaped single quotes detected');
    }

    if (responseText.match(/\n|\r/)) {
      issues.push('Contains unescaped newlines');
    }

    const openBraces = (responseText.match(/{/g) || []).length;
    const closeBraces = (responseText.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(
        `Mismatched braces: ${openBraces} open, ${closeBraces} close`
      );
    }

    const openBrackets = (responseText.match(/\[/g) || []).length;
    const closeBrackets = (responseText.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(
        `Mismatched brackets: ${openBrackets} open, ${closeBrackets} close`
      );
    }

    return issues;
  }

  /**
   * Create cache key for validation results
   */
  createValidationCacheKey(dreamData) {
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
   * Process error response from MCP Gateway
   */
  processErrorResponse(error, requestId, responseTime, originalText) {
    logger.error('Processing MCP Gateway error response', {
      requestId,
      error: error.message,
      errorType: error.constructor.name,
      responseTime: `${responseTime}ms`,
      originalTextLength: originalText?.length || 0,
      stack: error.stack,
    });

    // Enhance error with processing context
    const enhancedError = new Error(error.message);
    enhancedError.requestId = requestId;
    enhancedError.responseTime = responseTime;
    enhancedError.processingStage = this.identifyProcessingStage(error);
    enhancedError.originalError = error;
    enhancedError.category = this.categorizeError(error);
    enhancedError.retryable = this.isRetryableError(error);

    logger.error('Enhanced error details', {
      requestId,
      processingStage: enhancedError.processingStage,
      category: enhancedError.category,
      retryable: enhancedError.retryable,
      responseTime: `${responseTime}ms`,
    });

    throw enhancedError;
  }

  /**
   * Identify which processing stage failed
   */
  identifyProcessingStage(error) {
    const message = error.message.toLowerCase();

    if (message.includes('read response body') || message.includes('extract')) {
      return 'text_extraction';
    }

    if (message.includes('json') || message.includes('parse')) {
      return 'json_parsing';
    }

    if (message.includes('structure') || message.includes('required fields')) {
      return 'structure_validation';
    }

    if (message.includes('dream data') || message.includes('no data')) {
      return 'dream_data_extraction';
    }

    if (message.includes('schema') || message.includes('validation')) {
      return 'schema_validation';
    }

    return 'unknown';
  }

  /**
   * Categorize error for handling decisions
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('abort')) {
      return 'timeout';
    }

    if (message.includes('json') || message.includes('parse')) {
      return 'parsing';
    }

    if (message.includes('validation') || message.includes('schema')) {
      return 'validation';
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }

    return 'processing';
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    const category = this.categorizeError(error);
    const retryableCategories = ['timeout', 'network'];
    return retryableCategories.includes(category);
  }

  /**
   * Clear validation cache
   */
  clearValidationCache() {
    const cacheSize = this.validationCache.size;
    this.validationCache.clear();
    logger.info('Validation cache cleared', {
      previousSize: cacheSize,
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      maxSize: 100,
    };
  }
}

// Create singleton instance
const responseProcessor = new MCPResponseProcessor();

module.exports = {
  MCPResponseProcessor,
  responseProcessor,
};
