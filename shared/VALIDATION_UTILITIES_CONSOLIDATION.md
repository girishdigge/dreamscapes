# Validation Utilities Consolidation

## Overview

This document describes the consolidation of validation utilities from individual services into the shared module, ensuring consistent validation logic across all services.

## Changes Made

### 1. New Shared Utilities Created

#### `shared/utils/ResponseParser.js`

Common functions for parsing and extracting content from AI provider responses:

- `extractJsonString(text)` - Extract JSON from text using balanced brace matching
- `cleanJsonString(jsonStr)` - Clean JSON string by removing common issues
- `normalizeRawResponse(raw, providerName)` - Normalize provider responses to consistent format
- `parseDreamResponse(raw, source)` - Parse dream response from raw provider output
- `extractAllStringFields(obj, maxDepth)` - Extract all string fields recursively
- `detectResponseFormat(response)` - Detect response format for metadata
- `createResponsePreview(responseText, maxLength)` - Create preview for logging
- `identifyJsonIssues(responseText)` - Identify common JSON parsing issues

#### `shared/utils/ValidationHelpers.js`

Common functions for validation formatting, error handling, and data sanitization:

- `formatValidationError(error)` - Format single validation error
- `formatValidationErrors(errors)` - Format multiple validation errors
- `sanitizeText(text, maxLength)` - Sanitize text input
- `sanitizeId(id, maxLength)` - Sanitize ID field
- `createValidationCacheKey(dreamData)` - Create cache key for validation results
- `ensureRequiredFields(dreamData, originalText)` - Ensure required fields exist
- `generateDreamStats(dreamData)` - Generate dream statistics
- `calculateComplexityScore(dreamData)` - Calculate complexity score
- `getComplexityRating(score)` - Get complexity rating from score
- `isValidUUID(value)` - Check if value is valid UUID
- `isValidISODate(value)` - Check if value is valid ISO date
- `isValidHexColor(value)` - Check if value is valid hex color
- `validateCoordinates(coords)` - Validate 3D coordinates array
- `validateRange(value, min, max)` - Validate numeric range

### 2. Updated Shared Module Exports

Updated `shared/index.js` to export utility functions:

```javascript
module.exports = {
  // Core validation
  DreamSchema,
  UnifiedValidator,
  ValidationMonitor,
  validationMonitor,
  EnhancedContentRepair,

  // Utility functions
  utils,

  // Direct exports for convenience
  ResponseParser: utils.ResponseParser,
  ValidationHelpers: utils.ValidationHelpers,
};
```

### 3. Services Updated to Use Shared Utilities

#### Express Service

**`services/express/middleware/validation.js`**

- Updated to import `utils` from shared module
- Replaced `sanitizeText()` with `utils.sanitizeText()`
- Replaced `sanitizeDreamId()` with `utils.sanitizeId()`
- Replaced `formatValidationError()` with `utils.formatValidationErrors()`

**`services/express/utils/dreamValidator.js`**

- Updated to import `utils` from shared module
- Replaced `generateDreamStats()` with `utils.generateDreamStats()`
- Replaced `calculateComplexityScore()` with `utils.calculateComplexityScore()`
- Replaced `getComplexityRating()` with `utils.getComplexityRating()`
- Replaced `formatValidationError()` with `utils.formatValidationError()`

**`services/express/utils/responseProcessor.js`**

- Updated to import `utils` from shared module
- Replaced `createResponsePreview()` with `utils.createResponsePreview()`
- Replaced `identifyJsonIssues()` with `utils.identifyJsonIssues()`
- Replaced `ensureRequiredFields()` with `utils.ensureRequiredFields()`
- Replaced `createValidationCacheKey()` with `utils.createValidationCacheKey()`

#### MCP Gateway Service

**`services/mcp-gateway/utils/responseParser.js`**

- Updated to import `utils` from shared module
- Replaced `_extractJsonString()` with `utils.extractJsonString()`
- Updated `_normalizeRawResponse()` to use `utils.normalizeRawResponse()` as fallback
- Updated `parseDreamResponse()` to use shared utilities for JSON extraction and cleaning

### 4. Documentation Updates

Updated `shared/README.md` with:

- New "Utility Functions" section documenting ResponseParser utilities
- New "Validation Helper Utilities" section documenting ValidationHelpers
- Usage examples for all utility functions
- Updated "Module Structure" section showing new `utils/` directory
- Updated "Contributing" section with guidelines for adding utility functions

## Benefits

### 1. Single Source of Truth

- All validation utilities are now in one place
- Changes to validation logic only need to be made once
- Consistent behavior across all services

### 2. Reduced Code Duplication

- Removed duplicate implementations of:
  - JSON extraction and parsing
  - Response normalization
  - Validation error formatting
  - Text sanitization
  - Dream statistics generation
  - Complexity scoring

### 3. Easier Maintenance

- Bug fixes in utilities automatically apply to all services
- New features can be added to shared utilities once
- Testing can be centralized in shared module

### 4. Better Testability

- Utilities can be tested independently
- Services can mock shared utilities for testing
- Consistent test coverage across services

### 5. Improved Consistency

- All services use the same validation logic
- Error messages are formatted consistently
- Response parsing follows the same patterns

## Usage Examples

### Using Response Parser Utilities

```javascript
const { utils } = require('@dreamscapes/shared');

// Extract JSON from text
const jsonStr = utils.extractJsonString(responseText);

// Clean JSON string
const cleaned = utils.cleanJsonString(dirtyJson);

// Normalize provider response
const normalized = utils.normalizeRawResponse(rawResponse, 'cerebras');

// Parse dream response
const dream = utils.parseDreamResponse(rawResponse, 'openai');
```

### Using Validation Helper Utilities

```javascript
const { utils } = require('@dreamscapes/shared');

// Format validation errors
const formatted = utils.formatValidationError(error);
const response = utils.formatValidationErrors(errors);

// Sanitize inputs
const cleanText = utils.sanitizeText(userInput, 2000);
const cleanId = utils.sanitizeId(userId, 50);

// Ensure required fields
const result = utils.ensureRequiredFields(dreamData, originalText);

// Generate dream statistics
const stats = utils.generateDreamStats(dreamData);
```

## Migration Guide

### For New Services

When creating a new service that needs validation utilities:

1. Install the shared module:

   ```bash
   npm install ../../shared
   ```

2. Import utilities:

   ```javascript
   const { utils } = require('@dreamscapes/shared');
   ```

3. Use shared utilities instead of implementing your own:

   ```javascript
   // Instead of implementing your own
   function sanitizeText(text) { ... }

   // Use shared utility
   const cleanText = utils.sanitizeText(text);
   ```

### For Existing Services

When updating existing services to use shared utilities:

1. Import shared utilities:

   ```javascript
   const { utils } = require('@dreamscapes/shared');
   ```

2. Replace local implementations with shared utilities:

   ```javascript
   // Before
   function formatValidationError(error) {
     // local implementation
   }

   // After
   function formatValidationError(error) {
     return utils.formatValidationError(error);
   }
   ```

3. Remove duplicate code once all references are updated

4. Run tests to ensure behavior is consistent

## Testing

### Unit Tests

Shared utilities should have comprehensive unit tests in `shared/__tests__/`:

```javascript
// shared/__tests__/ResponseParser.test.js
const { utils } = require('../index');

describe('ResponseParser', () => {
  test('extractJsonString extracts valid JSON', () => {
    const text = 'Some text {"key": "value"} more text';
    const result = utils.extractJsonString(text);
    expect(result).toBe('{"key": "value"}');
  });
});
```

### Integration Tests

Services should test their integration with shared utilities:

```javascript
// services/express/__tests__/validation.test.js
const { utils } = require('@dreamscapes/shared');

describe('Validation Integration', () => {
  test('sanitizeText removes HTML tags', () => {
    const dirty = '<script>alert("xss")</script>Hello';
    const clean = utils.sanitizeText(dirty);
    expect(clean).not.toContain('<script>');
  });
});
```

## Future Enhancements

### Planned Additions

1. **Response Transformation Utilities**

   - Common transformation patterns
   - Provider-specific transformers
   - Response normalization strategies

2. **Validation Rule Builders**

   - Fluent API for building validation rules
   - Custom validator composition
   - Rule chaining and combination

3. **Error Recovery Utilities**

   - Common error recovery patterns
   - Fallback strategies
   - Retry logic helpers

4. **Performance Utilities**
   - Caching helpers
   - Memoization utilities
   - Performance monitoring

### Contribution Guidelines

When adding new utilities:

1. Add function to appropriate file in `shared/utils/`
2. Export from `shared/utils/index.js`
3. Update `shared/index.js` if needed
4. Add comprehensive JSDoc comments
5. Write unit tests in `shared/__tests__/`
6. Update `shared/README.md` with usage examples
7. Update this document with changes

## Conclusion

The consolidation of validation utilities into the shared module provides a solid foundation for consistent validation across all services. This approach reduces code duplication, improves maintainability, and ensures that all services benefit from improvements and bug fixes to validation logic.

## Related Documents

- `shared/README.md` - Shared module documentation
- `shared/IMPLEMENTATION_SUMMARY.md` - Implementation details
- `.kiro/specs/mcp-response-schema-validation/design.md` - Design document
- `.kiro/specs/mcp-response-schema-validation/requirements.md` - Requirements document
