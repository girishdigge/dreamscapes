// services/mcp-gateway/utils/EnhancedResponseParser.js
// Enhanced response parser with robust handling for different provider response formats

/**
 * Enhanced Response Parser for AI Provider Responses
 * Handles both object and string responses with provider-specific logic
 */
class EnhancedResponseParser {
  constructor(options = {}) {
    this.config = {
      enableLogging: options.enableLogging !== false,
      maxContentLength: options.maxContentLength || 100000,
      fallbackStrategies: options.fallbackStrategies !== false,
      enableEnhancedErrorLogging: options.enableEnhancedErrorLogging !== false,
      ...options,
    };

    // Initialize logging integration if enabled
    this.loggingIntegration = null;
    if (this.config.enableEnhancedErrorLogging) {
      try {
        const LoggingIntegrationLayer = require('./LoggingIntegrationLayer');
        this.loggingIntegration = new LoggingIntegrationLayer({
          enableEnhancedLogging: true,
          enableMonitoringIntegration: true,
          enableStructuredLogging: true,
        });

        // Initialize asynchronously
        this.loggingIntegration.initialize().catch((error) => {
          console.error(
            'Failed to initialize logging integration:',
            error.message
          );
          this.loggingIntegration = null;
        });
      } catch (error) {
        console.error('Failed to create logging integration:', error.message);
        this.loggingIntegration = null;
      }
    }
  }

  /**
   * Main parsing interface - handles any provider response format
   * @param {any} response - Raw response from provider
   * @param {string} providerName - Name of the provider (cerebras, openai, etc.)
   * @param {string} operationType - Type of operation (generateDream, patchDream, etc.)
   * @returns {Object} Normalized response object
   */
  parseProviderResponse(
    response,
    providerName = 'unknown',
    operationType = 'generateDream'
  ) {
    const startTime = Date.now();

    try {
      // Step 1: Normalize response to consistent format
      const normalized = this.normalizeResponse(response, providerName);

      if (!normalized.success) {
        this._log(
          'warn',
          `Response normalization failed for ${providerName}:`,
          normalized.error
        );
        return normalized;
      }

      // Step 2: Extract content based on operation type
      const extracted = this.extractContent(normalized.data, operationType);

      if (!extracted.success) {
        this._log(
          'warn',
          `Content extraction failed for ${providerName}:`,
          extracted.error
        );
        return extracted;
      }

      // Step 3: Validate extracted content
      const validated = this.validateContent(extracted.content, operationType);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        content: validated.content,
        metadata: {
          provider: providerName,
          operationType,
          originalFormat: this._detectResponseFormat(response),
          processingTime,
          extractionMethod: extracted.method,
          validationPassed: validated.success,
          contentLength: validated.content ? validated.content.length : 0,
        },
        error: null,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Enhanced error logging
      if (this.loggingIntegration) {
        this.loggingIntegration.logResponseParsingError(
          error,
          providerName,
          response,
          {
            operationType,
            processingTime,
            originalFormat: this._detectResponseFormat(response),
            parsingAttempts: 1,
            lastAttemptMethod: 'parseProviderResponse',
          }
        );
      } else {
        this._log(
          'error',
          `Response parsing failed for ${providerName}:`,
          error.message
        );
      }

      return {
        success: false,
        content: null,
        metadata: {
          provider: providerName,
          operationType,
          originalFormat: this._detectResponseFormat(response),
          processingTime,
          extractionMethod: 'failed',
          validationPassed: false,
        },
        error: {
          type: 'parsing_error',
          message: error.message,
          recoverable: true,
        },
      };
    }
  }

  /**
   * Normalize response from any provider to consistent format
   * @param {any} response - Raw response
   * @param {string} providerName - Provider name
   * @returns {Object} Normalized response
   */
  normalizeResponse(response, providerName) {
    try {
      // Handle null/undefined responses
      if (response === null || response === undefined) {
        return {
          success: false,
          data: null,
          error: 'Response is null or undefined',
        };
      }

      // Handle string responses (already normalized)
      if (typeof response === 'string') {
        return {
          success: true,
          data: response,
          format: 'string',
        };
      }

      // Handle object responses - use provider-specific logic
      if (typeof response === 'object') {
        const providerHandler = this._getProviderHandler(providerName);
        return providerHandler(response);
      }

      // Handle other types (numbers, booleans, etc.)
      return {
        success: true,
        data: String(response),
        format: typeof response,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Normalization failed: ${error.message}`,
      };
    }
  }

  /**
   * Get provider-specific response handler
   * @param {string} providerName - Provider name
   * @returns {Function} Handler function
   * @private
   */
  _getProviderHandler(providerName) {
    const handlers = {
      cerebras: this.parseCerebrasResponse.bind(this),
      openai: this.parseOpenAIResponse.bind(this),
      default: this.parseGenericResponse.bind(this),
    };

    return handlers[providerName.toLowerCase()] || handlers.default;
  }

  /**
   * Parse Cerebras-specific response format
   * @param {Object} response - Cerebras response object
   * @returns {Object} Normalized response
   */
  parseCerebrasResponse(response) {
    try {
      // Handle streaming response format
      if (response.content && typeof response.content === 'string') {
        return {
          success: true,
          data: response.content,
          format: 'cerebras_streaming',
        };
      }

      // Handle standard chat completion format
      if (
        response.choices &&
        Array.isArray(response.choices) &&
        response.choices.length > 0
      ) {
        const choice = response.choices[0];

        // Chat completion format
        if (choice.message && choice.message.content) {
          return {
            success: true,
            data: choice.message.content,
            format: 'cerebras_chat',
          };
        }

        // Delta format (streaming)
        if (choice.delta && choice.delta.content) {
          return {
            success: true,
            data: choice.delta.content,
            format: 'cerebras_delta',
          };
        }

        // Legacy text format
        if (choice.text) {
          return {
            success: true,
            data: choice.text,
            format: 'cerebras_legacy',
          };
        }
      }

      // Try generic object parsing as fallback
      return this.parseGenericResponse(response);
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Cerebras parsing failed: ${error.message}`,
      };
    }
  }

  /**
   * Parse OpenAI-specific response format
   * @param {Object} response - OpenAI response object
   * @returns {Object} Normalized response
   */
  parseOpenAIResponse(response) {
    try {
      // Handle chat completion format
      if (
        response.choices &&
        Array.isArray(response.choices) &&
        response.choices.length > 0
      ) {
        const choice = response.choices[0];

        // Standard chat completion
        if (choice.message && choice.message.content) {
          return {
            success: true,
            data: choice.message.content,
            format: 'openai_chat',
          };
        }

        // Legacy completion format
        if (choice.text) {
          return {
            success: true,
            data: choice.text,
            format: 'openai_completion',
          };
        }
      }

      // Handle direct data field
      if (response.data && typeof response.data === 'string') {
        return {
          success: true,
          data: response.data,
          format: 'openai_data',
        };
      }

      // Try generic object parsing as fallback
      return this.parseGenericResponse(response);
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `OpenAI parsing failed: ${error.message}`,
      };
    }
  }

  /**
   * Parse generic response format (fallback for unknown providers)
   * @param {Object} response - Generic response object
   * @returns {Object} Normalized response
   */
  parseGenericResponse(response) {
    try {
      // Try common content fields
      const contentFields = [
        'content',
        'text',
        'output',
        'result',
        'data',
        'message',
        'response',
        'generated_text',
      ];

      for (const field of contentFields) {
        if (response[field] && typeof response[field] === 'string') {
          return {
            success: true,
            data: response[field],
            format: `generic_${field}`,
          };
        }
      }

      // Try nested content extraction
      if (
        response.choices &&
        Array.isArray(response.choices) &&
        response.choices.length > 0
      ) {
        const choice = response.choices[0];
        for (const field of contentFields) {
          if (choice[field] && typeof choice[field] === 'string') {
            return {
              success: true,
              data: choice[field],
              format: `generic_choices_${field}`,
            };
          }
        }
      }

      // If response looks like a complete JSON object, stringify it
      if (this._looksLikeCompleteObject(response)) {
        return {
          success: true,
          data: JSON.stringify(response),
          format: 'generic_object',
        };
      }

      return {
        success: false,
        data: null,
        error: 'No recognizable content field found in response',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Generic parsing failed: ${error.message}`,
      };
    }
  }

  /**
   * Extract content based on operation type
   * @param {string} data - Normalized string data
   * @param {string} operationType - Operation type
   * @returns {Object} Extracted content
   */
  extractContent(data, operationType) {
    if (!data || typeof data !== 'string') {
      return {
        success: false,
        content: null,
        method: 'failed',
        error: 'No valid string data to extract from',
      };
    }

    // Truncate if too long
    if (data.length > this.config.maxContentLength) {
      this._log(
        'warn',
        `Content truncated from ${data.length} to ${this.config.maxContentLength} characters`
      );
      data = data.substring(0, this.config.maxContentLength);
    }

    try {
      switch (operationType) {
        case 'generateDream':
        case 'patchDream':
        case 'enrichStyle':
          return this._extractJsonContent(data);

        default:
          return {
            success: true,
            content: data,
            method: 'direct',
          };
      }
    } catch (error) {
      return {
        success: false,
        content: null,
        method: 'failed',
        error: `Content extraction failed: ${error.message}`,
      };
    }
  }

  /**
   * Extract JSON content from string data
   * @param {string} data - String data
   * @returns {Object} Extraction result
   * @private
   */
  _extractJsonContent(data) {
    // Strategy 1: Try direct JSON parsing
    try {
      const parsed = JSON.parse(data);
      if (this._looksLikeCompleteObject(parsed)) {
        return {
          success: true,
          content: data,
          method: 'direct_json',
        };
      }
    } catch (error) {
      // Continue to next strategy
    }

    // Strategy 2: Extract JSON block from text
    const jsonBlock = this._extractJsonBlock(data);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock);
        if (this._looksLikeCompleteObject(parsed)) {
          return {
            success: true,
            content: jsonBlock,
            method: 'json_block',
          };
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    // Strategy 3: Try to clean and parse
    const cleaned = this._cleanJsonString(data);
    if (cleaned) {
      try {
        const parsed = JSON.parse(cleaned);
        if (this._looksLikeCompleteObject(parsed)) {
          return {
            success: true,
            content: cleaned,
            method: 'cleaned_json',
          };
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    // Strategy 4: Return as-is if fallback strategies enabled
    if (this.config.fallbackStrategies) {
      return {
        success: true,
        content: data,
        method: 'fallback_raw',
      };
    }

    return {
      success: false,
      content: null,
      method: 'failed',
      error: 'Could not extract valid JSON content',
    };
  }

  /**
   * Extract JSON block from text using balanced brace matching
   * @param {string} text - Input text
   * @returns {string|null} Extracted JSON block
   * @private
   */
  _extractJsonBlock(text) {
    if (!text || typeof text !== 'string') return null;

    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) return null;

    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (start === -1) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.slice(start, i + 1);
        }
      }
    }

    // Fallback: regex match
    const regexMatch = text.match(/(\{[\s\S]*\})/);
    return regexMatch ? regexMatch[1] : null;
  }

  /**
   * Clean JSON string by removing common issues
   * @param {string} jsonStr - JSON string to clean
   * @returns {string|null} Cleaned JSON string
   * @private
   */
  _cleanJsonString(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') return null;

    try {
      // Remove trailing commas
      let cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1');

      // Fix common quote issues
      cleaned = cleaned.replace(/'/g, '"');

      // Remove comments
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      cleaned = cleaned.replace(/\/\/.*$/gm, '');

      return cleaned;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate extracted content
   * @param {string} content - Content to validate
   * @param {string} operationType - Operation type
   * @returns {Object} Validation result
   */
  validateContent(content, operationType) {
    if (!content) {
      return {
        success: false,
        content: null,
        error: 'Content is empty',
      };
    }

    // Basic validation - ensure content is not empty
    if (typeof content === 'string' && content.trim().length === 0) {
      return {
        success: false,
        content: null,
        error: 'Content is empty after trimming',
      };
    }

    // For JSON operations, try to validate JSON structure
    if (
      ['generateDream', 'patchDream', 'enrichStyle'].includes(operationType)
    ) {
      try {
        const parsed = JSON.parse(content);
        // Basic structure validation could be added here
        return {
          success: true,
          content: content,
        };
      } catch (error) {
        // If JSON parsing fails but we have content, still return it
        // The downstream parser can handle non-JSON content
        return {
          success: true,
          content: content,
          warning: `JSON validation failed: ${error.message}`,
        };
      }
    }

    return {
      success: true,
      content: content,
    };
  }

  /**
   * Attempt content recovery from failed parsing
   * @param {any} response - Original response
   * @param {Error} error - Parsing error
   * @returns {Object} Recovery result
   */
  attemptContentRecovery(response, error) {
    try {
      // Log recovery attempt
      if (this.loggingIntegration) {
        this.loggingIntegration.logError(
          'info',
          'Attempting content recovery',
          error,
          {
            responseType: typeof response,
            recoveryMethod: 'attemptContentRecovery',
          }
        );
      }

      // Try to extract any string content from the response
      if (typeof response === 'object' && response !== null) {
        const stringFields = this._extractAllStringFields(response);
        if (stringFields.length > 0) {
          // Return the longest string field as potential content
          const longestField = stringFields.reduce((a, b) =>
            a.length > b.length ? a : b
          );

          // Log successful recovery
          if (this.loggingIntegration) {
            this.loggingIntegration.logError(
              'info',
              'Content recovery successful',
              null,
              {
                recoveryMethod: 'longest_string',
                recoveredLength: longestField.length,
                totalStringFields: stringFields.length,
              }
            );
          }

          return {
            success: true,
            content: longestField,
            method: 'recovery_longest_string',
            warning: `Recovered from parsing error: ${error.message}`,
          };
        }
      }

      // If response is already a string, return it
      if (typeof response === 'string') {
        // Log successful recovery
        if (this.loggingIntegration) {
          this.loggingIntegration.logError(
            'info',
            'Content recovery successful',
            null,
            {
              recoveryMethod: 'direct_string',
              recoveredLength: response.length,
            }
          );
        }

        return {
          success: true,
          content: response,
          method: 'recovery_direct_string',
          warning: `Recovered from parsing error: ${error.message}`,
        };
      }

      // Log recovery failure
      if (this.loggingIntegration) {
        this.loggingIntegration.logError(
          'warn',
          'Content recovery failed',
          error,
          {
            responseType: typeof response,
            responseIsNull: response === null,
            responseIsUndefined: response === undefined,
          }
        );
      }

      return {
        success: false,
        content: null,
        method: 'recovery_failed',
        error: `Recovery failed: ${error.message}`,
      };
    } catch (recoveryError) {
      // Log recovery exception
      if (this.loggingIntegration) {
        this.loggingIntegration.logError(
          'error',
          'Content recovery exception',
          recoveryError,
          {
            originalError: error.message,
            responseType: typeof response,
          }
        );
      }

      return {
        success: false,
        content: null,
        method: 'recovery_failed',
        error: `Recovery failed: ${recoveryError.message}`,
      };
    }
  }

  /**
   * Extract all string fields from an object recursively
   * @param {Object} obj - Object to extract from
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Array<string>} Array of string values
   * @private
   */
  _extractAllStringFields(obj, maxDepth = 3) {
    const strings = [];

    if (maxDepth <= 0) return strings;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        strings.push(value);
      } else if (typeof value === 'object' && value !== null) {
        strings.push(...this._extractAllStringFields(value, maxDepth - 1));
      }
    }

    return strings;
  }

  /**
   * Detect response format for metadata
   * @param {any} response - Response to analyze
   * @returns {string} Format description
   * @private
   */
  _detectResponseFormat(response) {
    if (response === null || response === undefined) return 'null';
    if (typeof response === 'string') return 'string';
    if (typeof response === 'number') return 'number';
    if (typeof response === 'boolean') return 'boolean';

    if (typeof response === 'object') {
      if (Array.isArray(response)) return 'array';
      if (response.choices) return 'api_response';
      if (response.content) return 'content_object';
      return 'object';
    }

    return 'unknown';
  }

  /**
   * Check if object looks like a complete response object
   * @param {any} obj - Object to check
   * @returns {boolean} True if looks complete
   * @private
   */
  _looksLikeCompleteObject(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Check for common dream object fields
    const dreamFields = [
      'structures',
      'entities',
      'cinematography',
      'id',
      'title',
    ];
    const hasdreamFields = dreamFields.some((field) =>
      obj.hasOwnProperty(field)
    );

    if (hasdreamFields) return true;

    // Check for reasonable object size
    const keys = Object.keys(obj);
    return keys.length > 0 && keys.length < 100; // Reasonable object size
  }

  /**
   * Log messages if logging is enabled
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Additional data
   * @private
   */
  _log(level, message, data = null) {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [EnhancedResponseParser] [${level.toUpperCase()}] ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }
}

module.exports = EnhancedResponseParser;
