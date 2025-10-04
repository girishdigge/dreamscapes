// shared/utils/index.js
/**
 * Shared Utilities Index
 * Exports all shared utility functions for validation and response processing
 */

const ResponseParser = require('./ResponseParser');
const ValidationHelpers = require('./ValidationHelpers');

module.exports = {
  // Response Parser utilities
  ...ResponseParser,
  ResponseParser,

  // Validation Helper utilities
  ...ValidationHelpers,
  ValidationHelpers,
};
