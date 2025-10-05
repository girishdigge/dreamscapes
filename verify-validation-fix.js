#!/usr/bin/env node
/**
 * Verification script for validation system fixes
 * Tests that dream objects are validated correctly without legacy scene logic
 */

const { UnifiedValidator } = require('./shared');

// Sample dream object (like what Cerebras returns)
const sampleDream = {
  id: 'd43b7fde-92e9-433b-96d1-9a388074b299',
  title: 'three stars colliding creating explosion',
  style: 'cyberpunk',
  structures: [
    {
      id: 's1',
      type: 'star',
      pos: [33.47, 28.19, 0],
      scale: 1.12,
      rotation: [0, 1.28, 0],
      features: ['glowing_edges', 'emissive'],
    },
  ],
  entities: [
    {
      id: 'e1',
      type: 'particle_stream',
      count: 31,
      params: {
        speed: 3.29,
        glow: 0.96,
        size: 1.02,
        color: '#00ffff',
      },
    },
  ],
  cinematography: {
    durationSec: 30,
    shots: [
      {
        type: 'establish',
        target: 's1',
        duration: 12,
        startPos: [0, 30, 50],
        endPos: [0, 25, 20],
      },
      {
        type: 'flythrough',
        target: 'e1',
        duration: 18,
        startPos: [0, 25, 20],
        endPos: [30, 20, -20],
      },
    ],
  },
  environment: {
    preset: 'dusk',
    fog: 0.2,
    skyColor: '#001133',
    ambientLight: 0.4,
  },
  render: {
    res: [1280, 720],
    fps: 30,
    quality: 'medium',
  },
  metadata: {
    generatedAt: '2025-10-04T17:26:06.026Z',
    source: 'cerebras',
    version: '1.0.0',
    originalText: 'three stars colliding creating explosion',
    requestedStyle: 'cyberpunk',
  },
  created: '2025-10-04T17:26:06.026Z',
  source: 'cerebras',
};

console.log('🔍 Verifying Validation System Fixes\n');
console.log('='.repeat(60));

// Test 1: Validate dream object
console.log('\n✅ Test 1: Validate Dream Object');
console.log('-'.repeat(60));

const validator = new UnifiedValidator({
  strictMode: false,
  logErrors: false,
});

const result = validator.validateDreamObject(sampleDream);

console.log(`Valid: ${result.valid}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Warnings: ${result.categorized?.warning?.length || 0}`);

if (result.errors.length > 0) {
  console.log('\n❌ Validation Errors:');
  result.errors.forEach((error, i) => {
    console.log(`  ${i + 1}. ${error.field}: ${error.message}`);
  });
} else {
  console.log('✅ No validation errors!');
}

// Test 2: Check for legacy scene references
console.log('\n✅ Test 2: Check for Legacy Scene References');
console.log('-'.repeat(60));

const hasSceneReferences = result.errors.some(
  (error) =>
    error.field?.includes('scenes') ||
    error.message?.includes('scenes') ||
    error.message?.includes('scene.objects')
);

if (hasSceneReferences) {
  console.log('❌ FAIL: Found legacy scene references in errors');
} else {
  console.log('✅ PASS: No legacy scene references found');
}

// Test 3: Validate structures
console.log('\n✅ Test 3: Validate Structures');
console.log('-'.repeat(60));

const structuresResult = validator.validateStructures(sampleDream.structures);
console.log(`Valid: ${structuresResult.valid}`);
console.log(`Errors: ${structuresResult.errors.length}`);

if (structuresResult.errors.length > 0) {
  console.log('\n❌ Structure Validation Errors:');
  structuresResult.errors.forEach((error, i) => {
    console.log(`  ${i + 1}. ${error.field}: ${error.message}`);
  });
} else {
  console.log('✅ Structures validated successfully!');
}

// Test 4: Validate entities
console.log('\n✅ Test 4: Validate Entities');
console.log('-'.repeat(60));

const entitiesResult = validator.validateEntities(sampleDream.entities);
console.log(`Valid: ${entitiesResult.valid}`);
console.log(`Errors: ${entitiesResult.errors.length}`);

if (entitiesResult.errors.length > 0) {
  console.log('\n❌ Entity Validation Errors:');
  entitiesResult.errors.forEach((error, i) => {
    console.log(`  ${i + 1}. ${error.field}: ${error.message}`);
  });
} else {
  console.log('✅ Entities validated successfully!');
}

// Test 5: Validate cinematography
console.log('\n✅ Test 5: Validate Cinematography');
console.log('-'.repeat(60));

const cinematographyResult = validator.validateCinematography(
  sampleDream.cinematography
);
console.log(`Valid: ${cinematographyResult.valid}`);
console.log(`Errors: ${cinematographyResult.errors.length}`);

if (cinematographyResult.errors.length > 0) {
  console.log('\n❌ Cinematography Validation Errors:');
  cinematographyResult.errors.forEach((error, i) => {
    console.log(`  ${i + 1}. ${error.field}: ${error.message}`);
  });
} else {
  console.log('✅ Cinematography validated successfully!');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary');
console.log('='.repeat(60));

const allValid =
  result.valid &&
  structuresResult.valid &&
  entitiesResult.valid &&
  cinematographyResult.valid &&
  !hasSceneReferences;

if (allValid) {
  console.log('✅ ALL TESTS PASSED!');
  console.log('✅ Dream object validation working correctly');
  console.log('✅ No legacy scene references found');
  console.log('✅ System ready for flexible prompt-to-3D generation');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('❌ Please review the errors above');
  process.exit(1);
}
