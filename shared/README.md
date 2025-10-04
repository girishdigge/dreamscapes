# Dreamscapes Shared Module

This module provides unified schemas and validators for the Dreamscapes application, ensuring consistent data validation across all services.

## Installation

From any service directory:

```bash
npm install ../../shared
```

Or add to package.json:

```json
{
  "dependencies": {
    "@dreamscapes/shared": "file:../../shared"
  }
}
```

## Usage

### Basic Validation

```javascript
const { DreamSchema, UnifiedValidator } = require('@dreamscapes/shared');

// Create validator instance
const validator = new UnifiedValidator({
  strictMode: true,
  logErrors: true,
});

// Validate a complete dream object
const result = validator.validateDreamObject(dreamData);

if (!result.valid) {
  console.error('Validation failed:', result.errors);
  console.log('Error counts:', {
    critical: result.criticalCount,
    errors: result.errorCount,
    warnings: result.warningCount,
  });
}
```

### Section-Specific Validation

```javascript
// Validate individual sections
const structuresResult = validator.validateStructures(dream.structures);
const entitiesResult = validator.validateEntities(dream.entities);
const cinematographyResult = validator.validateCinematography(
  dream.cinematography
);
const environmentResult = validator.validateEnvironment(dream.environment);
const renderResult = validator.validateRenderConfig(dream.render);
```

### Generate Validation Report

```javascript
// Get comprehensive validation report
const report = validator.generateValidationReport(dream);

console.log('Validation Summary:', report.summary);
console.log('Field Counts:', report.fieldCounts);
console.log('Section Validation:', report.sectionValidation);
```

### Check Renderability

```javascript
// Check if dream has minimum data for rendering
const renderCheck = validator.isRenderable(dream);

if (!renderCheck.renderable) {
  console.error('Dream is not renderable:', renderCheck.errors);
}
```

### Use Case Specific Validation

```javascript
// Validate for specific use cases
const apiValidation = validator.validateForUseCase(dream, 'api-response');
const dbValidation = validator.validateForUseCase(dream, 'database-storage');
const cacheValidation = validator.validateForUseCase(dream, 'cache');
```

## Schema Access

```javascript
const { DreamSchema } = require('@dreamscapes/shared');

// Get complete schema definition
const schema = DreamSchema.getSchema();

// Get section schemas
const structureSchema = DreamSchema.getStructureSchema();
const entitySchema = DreamSchema.getEntitySchema();
const cinematographySchema = DreamSchema.getCinematographySchema();
const environmentSchema = DreamSchema.getEnvironmentSchema();
const renderSchema = DreamSchema.getRenderSchema();
const metadataSchema = DreamSchema.getMetadataSchema();

// Direct validation using schema
const result = DreamSchema.validate(dream);
```

## Validation Options

```javascript
const validator = new UnifiedValidator({
  strictMode: true, // Enforce all validation rules strictly
  allowPartial: false, // Allow partial validation (for intermediate stages)
  logErrors: true, // Log validation errors to console
});
```

## Error Structure

Validation errors follow this structure:

```javascript
{
  field: 'structures[0].pos',           // Field path
  error: 'ARRAY_TOO_SHORT',             // Error code
  message: 'Array must have at least 3 items',  // Human-readable message
  expected: '>= 3',                     // Expected value/format
  received: 2,                          // Actual value
  severity: 'error'                     // 'critical', 'error', or 'warning'
}
```

## Error Severity Levels

- **critical**: Missing required fields or invalid object structure
- **error**: Invalid data types, out-of-range values, or schema violations
- **warning**: Unusual but valid values, or potential issues

## Validation Result Structure

```javascript
{
  valid: false,                         // Overall validation status
  errors: [...],                        // Array of error objects
  errorCount: 5,                        // Total error count
  validationTime: 12,                   // Validation time in ms
  categorized: {                        // Errors by severity
    critical: [...],
    error: [...],
    warning: [...]
  },
  criticalCount: 1,
  errorCount: 3,
  warningCount: 1
}
```

## Integration Examples

### Express Service

```javascript
const { UnifiedValidator } = require('@dreamscapes/shared');
const validator = new UnifiedValidator();

app.post('/api/dreams', async (req, res) => {
  const validation = validator.validateDreamObject(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid dream data',
      details: validation.errors,
    });
  }

  // Process valid dream...
});
```

### MCP Gateway

```javascript
const { UnifiedValidator } = require('@dreamscapes/shared');
const validator = new UnifiedValidator({ logErrors: true });

async function processAIResponse(response) {
  const validation = validator.validateDreamObject(response.dream);

  if (!validation.valid) {
    console.error('AI response validation failed:', validation.errors);
    // Apply content repair...
  }

  return response;
}
```

### Content Repair Integration

```javascript
const { UnifiedValidator } = require('@dreamscapes/shared');
const validator = new UnifiedValidator();

function repairDream(dream) {
  const validation = validator.validateDreamObject(dream);

  if (validation.valid) {
    return dream;
  }

  // Apply repairs based on validation errors
  validation.errors.forEach((error) => {
    if (error.error === 'MISSING_REQUIRED_FIELD') {
      // Generate missing field...
    }
  });

  return repairedDream;
}
```

## Schema Compliance

All dream objects must comply with the following structure:

### Required Fields

- `id` (string, UUID format)
- `title` (string, 1-200 characters)
- `style` (enum: ethereal, cyberpunk, surreal, fantasy, nightmare, nature, abstract)
- `structures` (array, min 1 item)
- `entities` (array, min 1 item)
- `cinematography` (object with durationSec and shots)
- `environment` (object with preset)
- `render` (object with res, fps, quality)
- `created` (ISO date string)
- `source` (string)

### Optional Fields

- `metadata` (object with generation info)

See the schema definitions in `schemas/DreamSchema.js` for complete field specifications.

## Testing

```javascript
const { UnifiedValidator, DreamSchema } = require('@dreamscapes/shared');

// Test with sample dream
const sampleDream = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Dream',
  style: 'ethereal',
  structures: [
    {
      id: 'struct-1',
      type: 'floating_platform',
      pos: [0, 0, 0],
    },
  ],
  entities: [
    {
      id: 'entity-1',
      type: 'floating_orbs',
      count: 10,
      params: { speed: 1, glow: 0.5, size: 1, color: '#ffffff' },
    },
  ],
  cinematography: {
    durationSec: 30,
    shots: [
      {
        type: 'establish',
        duration: 30,
      },
    ],
  },
  environment: {
    preset: 'dusk',
  },
  render: {
    res: [1920, 1080],
    fps: 30,
    quality: 'medium',
  },
  created: new Date().toISOString(),
  source: 'test',
};

const validator = new UnifiedValidator();
const result = validator.validateDreamObject(sampleDream);
console.log('Validation result:', result);
```

## Utility Functions

### Response Parser Utilities

Common functions for parsing and extracting content from AI provider responses:

```javascript
const { utils } = require('@dreamscapes/shared');
// or
const { ResponseParser } = require('@dreamscapes/shared');

// Extract JSON from text
const jsonStr = utils.extractJsonString(responseText);

// Clean JSON string
const cleaned = utils.cleanJsonString(dirtyJson);

// Normalize provider response
const normalized = utils.normalizeRawResponse(rawResponse, 'cerebras');

// Parse dream response
const dream = utils.parseDreamResponse(rawResponse, 'openai');

// Detect response format
const format = utils.detectResponseFormat(response);

// Create preview for logging
const preview = utils.createResponsePreview(longText, 300);

// Identify JSON issues
const issues = utils.identifyJsonIssues(jsonString);
```

### Validation Helper Utilities

Common functions for validation formatting, error handling, and data sanitization:

```javascript
const { utils } = require('@dreamscapes/shared');
// or
const { ValidationHelpers } = require('@dreamscapes/shared');

// Format validation errors
const formatted = utils.formatValidationError(error);
const response = utils.formatValidationErrors(errors);

// Sanitize inputs
const cleanText = utils.sanitizeText(userInput, 2000);
const cleanId = utils.sanitizeId(userId, 50);

// Ensure required fields
const result = utils.ensureRequiredFields(dreamData, originalText);
if (result.modified) {
  console.log('Fields were added:', result.data);
}

// Generate dream statistics
const stats = utils.generateDreamStats(dreamData);
console.log('Complexity:', stats.complexityRating);

// Validation helpers
const isUUID = utils.isValidUUID(id);
const isDate = utils.isValidISODate(timestamp);
const isColor = utils.isValidHexColor('#FF0000');

// Validate coordinates
const coordCheck = utils.validateCoordinates([0, 5, 10]);
if (!coordCheck.valid) {
  console.error(coordCheck.error);
}

// Validate numeric range
const rangeCheck = utils.validateRange(value, 0, 100);
```

### Creating Validation Cache Keys

```javascript
const { utils } = require('@dreamscapes/shared');

// Create cache key for validation results
const cacheKey = utils.createValidationCacheKey(dreamData);
validationCache.set(cacheKey, validationResult);
```

## Module Structure

```
shared/
├── schemas/
│   └── DreamSchema.js          # Dream object schema definition
├── validators/
│   ├── UnifiedValidator.js     # Main validation logic
│   └── ValidationMonitor.js    # Validation metrics tracking
├── repair/
│   └── EnhancedContentRepair.js # Content repair system
├── utils/
│   ├── ResponseParser.js       # Response parsing utilities
│   ├── ValidationHelpers.js    # Validation helper functions
│   └── index.js                # Utils exports
├── __tests__/                  # Test files
├── examples/                   # Usage examples
└── index.js                    # Main module exports
```

## Contributing

When adding new validation rules:

1. Update the schema definition in `schemas/DreamSchema.js`
2. Add corresponding validation logic in `validators/UnifiedValidator.js`
3. Update this README with usage examples
4. Test with existing services to ensure compatibility

When adding new utility functions:

1. Add functions to appropriate file in `utils/` directory
2. Export from `utils/index.js`
3. Update this README with usage examples
4. Add tests in `__tests__/` directory
