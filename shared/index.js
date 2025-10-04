/**
 * Shared module exports
 *
 * Provides unified access to schemas, validators, repair, monitoring, and utilities across all services
 */

const DreamSchema = require('./schemas/DreamSchema');
const UnifiedValidator = require('./validators/UnifiedValidator');
const {
  ValidationMonitor,
  validationMonitor,
} = require('./validators/ValidationMonitor');
const EnhancedContentRepair = require('./repair/EnhancedContentRepair');
const EnumMapper = require('./validators/EnumMapper');
const ParameterValidator = require('./validators/ParameterValidator');
const utils = require('./utils');

module.exports = {
  // Core validation
  DreamSchema,
  UnifiedValidator,
  ValidationMonitor,
  validationMonitor,
  EnhancedContentRepair,
  EnumMapper,
  ParameterValidator,

  // Utility functions
  utils,

  // Direct exports for convenience
  ResponseParser: utils.ResponseParser,
  ValidationHelpers: utils.ValidationHelpers,
};
