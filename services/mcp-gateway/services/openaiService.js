// services/mcp-gateway/services/openaiService.js
// Wrapper around OpenAI's Chat Completions API with config-driven defaults

const axios = require('axios');
const config = require('../config/openai');

async function callOpenAI(prompt, options = {}) {
  try {
    const response = await axios.post(
      config.apiUrl,
      {
        model: options.model || config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? config.defaults.temperature,
        max_tokens: options.maxTokens ?? config.defaults.maxTokens,
        n: options.n ?? config.defaults.n,
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: options.timeoutMs ?? config.defaults.timeoutMs,
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}

async function testConnection() {
  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );
    return true;
  } catch (error) {
    throw new Error(`OpenAI connection test failed: ${error.message}`);
  }
}

async function generateDream(prompt, options = {}) {
  try {
    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    const response = await callOpenAI(prompt, options);

    // Use robust processing pipeline for enhanced response handling
    return await _processResponseWithPipeline(
      response,
      'generateDream',
      options
    );
  } catch (error) {
    throw new Error(`OpenAI dream generation failed: ${error.message}`);
  }
}

async function patchDream(prompt, baseJson, options = {}) {
  try {
    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    const response = await callOpenAI(prompt, options);
    return await _processResponseWithPipeline(response, 'patchDream', {
      ...options,
      baseJson,
    });
  } catch (error) {
    throw new Error(`OpenAI patch dream failed: ${error.message}`);
  }
}

async function enrichStyle(prompt, baseJson, options = {}) {
  try {
    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    const response = await callOpenAI(prompt, options);
    return await _processResponseWithPipeline(response, 'enrichStyle', {
      ...options,
      baseJson,
    });
  } catch (error) {
    throw new Error(`OpenAI enrich style failed: ${error.message}`);
  }
}

/**
 * Process response using robust processing pipeline
 * @param {any} response - Raw response from OpenAI API
 * @param {string} operationType - Type of operation for context
 * @param {Object} options - Processing options
 * @returns {string} Processed content string
 * @private
 */
async function _processResponseWithPipeline(
  response,
  operationType = 'unknown',
  options = {}
) {
  try {
    // Import processing pipeline
    const { processingPipeline } = require('../utils/responseParser');

    const result = await processingPipeline.processResponse(
      response,
      'openai',
      operationType,
      {
        timestamp: Date.now(),
        options,
        serviceVersion: '1.0.0',
      }
    );

    if (result.success && result.content) {
      return result.content;
    }

    // Fallback to legacy extraction if pipeline fails
    console.warn(
      `Processing pipeline failed for OpenAI ${operationType}, falling back to legacy extraction`
    );
    return _extractContentFromResponse(response, operationType);
  } catch (error) {
    // Fallback to legacy extraction on any error
    console.warn(
      `Pipeline processing error for OpenAI ${operationType}:`,
      error.message
    );
    return _extractContentFromResponse(response, operationType);
  }
}

/**
 * Extract content consistently from OpenAI response formats (legacy fallback)
 * @param {any} response - Raw response from OpenAI API
 * @param {string} operationType - Type of operation for context
 * @returns {string} Extracted content string
 * @private
 */
function _extractContentFromResponse(response, operationType = 'unknown') {
  try {
    // Handle null/undefined responses
    if (!response) {
      throw new Error('Response is null or undefined');
    }

    // If response is already a string, return it
    if (typeof response === 'string') {
      return _validateContent(response, operationType);
    }

    // Handle OpenAI chat completion format
    if (
      response.choices &&
      Array.isArray(response.choices) &&
      response.choices.length > 0
    ) {
      const choice = response.choices[0];

      // Standard chat completion
      if (choice.message && choice.message.content) {
        return _validateContent(choice.message.content, operationType);
      }

      // Legacy completion format
      if (choice.text) {
        return _validateContent(choice.text, operationType);
      }
    }

    // Handle direct data field
    if (response.data && typeof response.data === 'string') {
      return _validateContent(response.data, operationType);
    }

    // Handle other common response formats
    if (response.content && typeof response.content === 'string') {
      return _validateContent(response.content, operationType);
    }

    if (response.text && typeof response.text === 'string') {
      return _validateContent(response.text, operationType);
    }

    if (response.output && typeof response.output === 'string') {
      return _validateContent(response.output, operationType);
    }

    // If response is an object that looks like a complete result, stringify it
    if (typeof response === 'object' && _looksLikeCompleteObject(response)) {
      return _validateContent(JSON.stringify(response), operationType);
    }

    throw new Error(
      `Unable to extract content from response format: ${typeof response}`
    );
  } catch (error) {
    throw new Error(`Content extraction failed: ${error.message}`);
  }
}

/**
 * Validate extracted content
 * @param {string} content - Content to validate
 * @param {string} operationType - Operation type for context
 * @returns {string} Validated content
 * @private
 */
function _validateContent(content, operationType) {
  if (!content || typeof content !== 'string') {
    throw new Error('Content is not a valid string');
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Content is empty after trimming');
  }

  // For JSON operations, validate JSON structure
  if (['generateDream', 'patchDream', 'enrichStyle'].includes(operationType)) {
    try {
      JSON.parse(trimmed);
    } catch (jsonError) {
      // Log warning but don't fail - downstream parser can handle non-JSON
      console.warn(
        `OpenAI content validation: JSON parsing failed for ${operationType}:`,
        jsonError.message
      );
    }
  }

  return trimmed;
}

/**
 * Check if object looks like a complete response object
 * @param {any} obj - Object to check
 * @returns {boolean} True if looks complete
 * @private
 */
function _looksLikeCompleteObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }

  // Check for common dream object fields
  const dreamFields = [
    'structures',
    'entities',
    'cinematography',
    'id',
    'title',
    'description',
  ];
  const hasDreamFields = dreamFields.some((field) => obj.hasOwnProperty(field));

  if (hasDreamFields) return true;

  // Check for reasonable object size (not empty, not too large)
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.length < 100;
}

module.exports = {
  callOpenAI,
  testConnection,
  generateDream,
  patchDream,
  enrichStyle,
};
