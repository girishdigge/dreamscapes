/**
 * Example usage of DreamSchema and UnifiedValidator
 *
 * This file demonstrates how to use the shared validation module
 */

const { DreamSchema, UnifiedValidator } = require('../index');

// Create a sample dream object
const sampleDream = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Ethereal Library in the Clouds',
  style: 'ethereal',
  structures: [
    {
      id: 'struct-1',
      type: 'floating_library',
      pos: [0, 10, 0],
      rotation: [0, 0, 0],
      scale: 2,
      features: ['glowing_edges', 'particle_effects'],
    },
    {
      id: 'struct-2',
      type: 'crystal_tower',
      pos: [15, 5, -10],
      scale: 1.5,
      features: ['emissive', 'pulsating'],
    },
  ],
  entities: [
    {
      id: 'entity-1',
      type: 'floating_orbs',
      count: 20,
      params: {
        speed: 0.5,
        glow: 0.8,
        size: 0.5,
        color: '#88ccff',
      },
    },
    {
      id: 'entity-2',
      type: 'book_swarm',
      count: 15,
      params: {
        speed: 0.3,
        glow: 0.4,
        size: 0.3,
        color: '#ffeeaa',
      },
    },
  ],
  cinematography: {
    durationSec: 30,
    shots: [
      {
        type: 'establish',
        target: 'struct-1',
        duration: 10,
        startPos: [0, 20, 30],
        endPos: [0, 15, 25],
      },
      {
        type: 'orbit',
        target: 'struct-1',
        duration: 15,
      },
      {
        type: 'close_up',
        target: 'entity-1',
        duration: 5,
      },
    ],
  },
  environment: {
    preset: 'dawn',
    fog: 0.2,
    skyColor: '#ffd4a3',
    ambientLight: 0.7,
  },
  render: {
    res: [1920, 1080],
    fps: 30,
    quality: 'high',
  },
  metadata: {
    generatedAt: new Date().toISOString(),
    processingTime: 1250,
    source: 'cerebras',
    version: '1.0.0',
    originalText: 'A floating library in the clouds with glowing books',
    requestedStyle: 'ethereal',
  },
  created: new Date().toISOString(),
  source: 'cerebras',
};

// Example 1: Basic validation
console.log('=== Example 1: Basic Validation ===\n');
const validator = new UnifiedValidator({ logErrors: false });
const result = validator.validateDreamObject(sampleDream);

console.log('Validation Result:', {
  valid: result.valid,
  errorCount: result.errorCount,
  validationTime: `${result.validationTime}ms`,
});

if (!result.valid) {
  console.log('\nErrors found:');
  result.errors.forEach((error) => {
    console.log(`  - ${error.field}: ${error.message}`);
  });
}

// Example 2: Section-specific validation
console.log('\n=== Example 2: Section-Specific Validation ===\n');

const structuresResult = validator.validateStructures(sampleDream.structures);
console.log('Structures validation:', {
  valid: structuresResult.valid,
  errorCount: structuresResult.errorCount,
});

const entitiesResult = validator.validateEntities(sampleDream.entities);
console.log('Entities validation:', {
  valid: entitiesResult.valid,
  errorCount: entitiesResult.errorCount,
});

const cinematographyResult = validator.validateCinematography(
  sampleDream.cinematography
);
console.log('Cinematography validation:', {
  valid: cinematographyResult.valid,
  errorCount: cinematographyResult.errorCount,
});

// Example 3: Validation report
console.log('\n=== Example 3: Comprehensive Validation Report ===\n');

const report = validator.generateValidationReport(sampleDream);
console.log('Report Summary:', report.summary);
console.log('Field Counts:', report.fieldCounts);

// Example 4: Renderability check
console.log('\n=== Example 4: Renderability Check ===\n');

const renderCheck = validator.isRenderable(sampleDream);
console.log('Is Renderable:', renderCheck.renderable);
if (!renderCheck.renderable) {
  console.log('Render Errors:', renderCheck.errors);
}

// Example 5: Invalid dream object
console.log('\n=== Example 5: Invalid Dream Object ===\n');

const invalidDream = {
  id: 'invalid-id', // Invalid UUID format
  title: 'Test',
  style: 'invalid-style', // Invalid enum value
  structures: [], // Empty array (min 1 required)
  entities: [], // Empty array (min 1 required)
  // Missing cinematography, environment, render
  created: 'not-a-date',
  source: 'test',
};

const invalidResult = validator.validateDreamObject(invalidDream);
console.log('Validation Result:', {
  valid: invalidResult.valid,
  errorCount: invalidResult.errorCount,
  criticalCount: invalidResult.criticalCount,
  warningCount: invalidResult.warningCount,
});

console.log('\nErrors (first 5):');
invalidResult.errors.slice(0, 5).forEach((error) => {
  console.log(`  - [${error.severity}] ${error.field}: ${error.message}`);
});

// Example 6: Use case specific validation
console.log('\n=== Example 6: Use Case Specific Validation ===\n');

const apiValidation = validator.validateForUseCase(sampleDream, 'api-response');
console.log('API Response Validation:', {
  valid: apiValidation.valid,
  renderable: apiValidation.renderable,
});

const dbValidation = validator.validateForUseCase(
  sampleDream,
  'database-storage'
);
console.log('Database Storage Validation:', {
  valid: dbValidation.valid,
});

// Example 7: Schema access
console.log('\n=== Example 7: Schema Access ===\n');

const schema = DreamSchema.getSchema();
console.log('Available top-level fields:', Object.keys(schema));

const structureSchema = DreamSchema.getStructureSchema();
console.log('Structure fields:', Object.keys(structureSchema));

const entitySchema = DreamSchema.getEntitySchema();
console.log('Entity fields:', Object.keys(entitySchema));

console.log('\n=== Examples Complete ===\n');
