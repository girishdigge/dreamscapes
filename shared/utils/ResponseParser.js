// shared/utils/ResponseParser.js
/**
 * Shared Response Parser Utilities
 * Common functions for parsing and extracting content from AI provider responses
 */

/**
 * Extract JSON string from text using balanced brace matching
 * @param {string} text - Input text containing JSON
 * @returns {string|null} Extracted JSON string or null
 */
function extractJsonString(text) {
  if (!text || typeof text !== 'string') return null;

  // Try to find the first { ... } block with balanced braces
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  // Attempt to find balanced closing brace
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        return candidate;
      }
    }
  }

  // Fallback: regex try to match {...}
  const regexMatch = text.match(/(\{[\s\S]*\})/);
  return regexMatch ? regexMatch[1] : null;
}

/**
 * Clean JSON string by removing common issues
 * @param {string} jsonStr - JSON string to clean
 * @returns {string|null} Cleaned JSON string or null
 */
function cleanJsonString(jsonStr) {
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
 * Normalize raw response from any provider to consistent format
 * @param {any} raw - Raw response from provider
 * @param {string} providerName - Provider name for context
 * @returns {string|null} Normalized string content or null
 */
function normalizeRawResponse(raw, providerName = 'unknown') {
  if (!raw) return null;

  // If OpenAI / Cerebras style: { choices: [{ message: { content } }] }
  if (typeof raw === 'object') {
    // OpenAI/Cerebras chat completion style
    if (raw.choices && Array.isArray(raw.choices) && raw.choices.length > 0) {
      const choice = raw.choices[0];
      // Chat-style
      if (choice.message && choice.message.content) {
        return choice.message.content;
      }
      // Legacy completion style
      if (choice.text) return choice.text;
      // Delta format (streaming)
      if (choice.delta && choice.delta.content) {
        return choice.delta.content;
      }
    }

    // Try common content fields
    const contentFields = [
      'content',
      'text',
      'output',
      'data',
      'message',
      'result',
      'generated_text',
      'output_text',
    ];

    for (const field of contentFields) {
      if (raw[field] && typeof raw[field] === 'string') {
        return raw[field];
      }
    }

    // If it's already a JSON scene (object) — return as stringified
    try {
      return JSON.stringify(raw);
    } catch (e) {
      // ignore
    }
  }

  // If string, return directly
  if (typeof raw === 'string') {
    return raw;
  }

  return null;
}

/**
 * Parse dream response from raw provider output
 * @param {any} raw - Raw response from provider
 * @param {string} source - Provider name
 * @returns {Object|null} Parsed dream object or null
 */
function parseDreamResponse(raw, source = 'unknown') {
  try {
    const normalized = normalizeRawResponse(raw, source);

    if (!normalized) return null;

    // If normalized is already a JSON string representing full object
    // Attempt JSON.parse directly
    try {
      const maybeObj = JSON.parse(normalized);
      // If it's the full dream object, return it
      if (
        maybeObj &&
        (maybeObj.structures || maybeObj.entities || maybeObj.cinematography)
      ) {
        return maybeObj;
      }
      // If not a scene object, continue extracting
    } catch (err) {
      // not direct JSON, try extracting JSON block
    }

    // Try to extract a JSON substring and parse
    const jsonStr = extractJsonString(normalized);
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
      } catch (parseErr) {
        // attempt tiny fixes (replace trailing commas)
        const tidy = cleanJsonString(jsonStr);
        if (tidy) {
          try {
            return JSON.parse(tidy);
          } catch (err2) {
            // give up
          }
        }
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Extract all string fields from an object recursively
 * @param {Object} obj - Object to extract from
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Array<string>} Array of string values
 */
function extractAllStringFields(obj, maxDepth = 3) {
  const strings = [];

  if (maxDepth <= 0 || !obj || typeof obj !== 'object') return strings;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      strings.push(value);
    } else if (typeof value === 'object' && value !== null) {
      strings.push(...extractAllStringFields(value, maxDepth - 1));
    }
  }

  return strings;
}

/**
 * Detect response format for metadata
 * @param {any} response - Response to analyze
 * @returns {string} Format description
 */
function detectResponseFormat(response) {
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
 * Create a preview of response text for logging
 * @param {string} responseText - Response text to preview
 * @param {number} maxLength - Maximum preview length
 * @returns {string} Preview string
 */
function createResponsePreview(responseText, maxLength = 300) {
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
 * @param {string} responseText - Response text to analyze
 * @returns {Array<string>} Array of identified issues
 */
function identifyJsonIssues(responseText) {
  const issues = [];

  if (!responseText || typeof responseText !== 'string') {
    return issues;
  }

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
    issues.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
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

module.exports = {
  extractJsonString,
  cleanJsonString,
  normalizeRawResponse,
  parseDreamResponse,
  extractAllStringFields,
  detectResponseFormat,
  createResponsePreview,
  identifyJsonIssues,
};
