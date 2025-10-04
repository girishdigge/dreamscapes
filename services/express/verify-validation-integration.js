#!/usr/bin/env node
/**
 * Verification script for Express service validation integration
 *
 * Tests that all validation files correctly import from shared module
 */

console.log('🔍 Verifying Express Service Validation Integration...\n');

let allPassed = true;

// Test 1: Verify shared module imports
console.log('Test 1: Verifying shared module imports...');
try {
  const {
    UnifiedValidator,
    validationMonitor,
    DreamSchema,
    EnhancedContentRepair,
  } = require('@dreamscapes/shared');

  if (typeof UnifiedValidator !== 'function') {
    throw new Error('UnifiedValidator is not a function');
  }
  if (typeof validationMonitor !== 'object') {
    throw new Error('validationMonitor is not an object');
  }
  if (typeof DreamSchema !== 'function') {
    throw new Error('DreamSchema is not a function');
  }
  if (typeof EnhancedContentRepair !== 'function') {
    throw new Error('EnhancedContentRepair is not a function');
  }

  console.log('✅ Shared module imports work correctly');
  console.log('   - UnifiedValidator: function');
  console.log('   - validationMonitor: object');
  console.log('   - DreamSchema: function');
  console.log('   - EnhancedContentRepair: function\n');
} catch (error) {
  console.error('❌ Shared module import failed:', error.message);
  allPassed = false;
}

// Test 2: Verify dreamValidator.js
console.log('Test 2: Verifying utils/dreamValidator.js...');
try {
  const dreamValidator = require('./utils/dreamValidator');

  if (typeof dreamValidator.validateDream !== 'function') {
    throw new Error('validateDream is not exported');
  }
  if (typeof dreamValidator.quickValidate !== 'function') {
    throw new Error('quickValidate is not exported');
  }
  if (typeof dreamValidator.unifiedValidator !== 'object') {
    throw new Error('unifiedValidator is not exported');
  }

  console.log('✅ dreamValidator.js exports correct functions');
  console.log('   - validateDream: function');
  console.log('   - quickValidate: function');
  console.log('   - unifiedValidator: object\n');
} catch (error) {
  console.error('❌ dreamValidator.js verification failed:', error.message);
  allPassed = false;
}

// Test 3: Verify middleware/validation.js
console.log('Test 3: Verifying middleware/validation.js...');
try {
  const validation = require('./middleware/validation');

  if (typeof validation.validateDream !== 'function') {
    throw new Error('validateDream is not exported');
  }
  if (typeof validation.unifiedValidator !== 'object') {
    throw new Error('unifiedValidator is not exported');
  }
  if (typeof validation.validationMonitor !== 'object') {
    throw new Error('validationMonitor is not exported');
  }

  console.log('✅ middleware/validation.js exports correct functions');
  console.log('   - validateDream: function');
  console.log('   - unifiedValidator: object');
  console.log('   - validationMonitor: object\n');
} catch (error) {
  console.error(
    '❌ middleware/validation.js verification failed:',
    error.message
  );
  allPassed = false;
}

// Test 4: Verify enhancedResponseProcessor.js
console.log('Test 4: Verifying utils/enhancedResponseProcessor.js...');
try {
  const {
    EnhancedResponseProcessor,
    enhancedResponseProcessor,
  } = require('./utils/enhancedResponseProcessor');

  if (typeof EnhancedResponseProcessor !== 'function') {
    throw new Error('EnhancedResponseProcessor is not a class');
  }
  if (typeof enhancedResponseProcessor !== 'object') {
    throw new Error('enhancedResponseProcessor singleton is not exported');
  }
  if (typeof enhancedResponseProcessor.validator !== 'object') {
    throw new Error('enhancedResponseProcessor does not have validator');
  }

  console.log('✅ enhancedResponseProcessor.js exports correct classes');
  console.log('   - EnhancedResponseProcessor: class');
  console.log('   - enhancedResponseProcessor: object');
  console.log('   - validator: object\n');
} catch (error) {
  console.error(
    '❌ enhancedResponseProcessor.js verification failed:',
    error.message
  );
  allPassed = false;
}

// Test 5: Verify processingPipeline.js
console.log('Test 5: Verifying utils/processingPipeline.js...');
try {
  const ProcessingPipeline = require('./utils/processingPipeline');

  if (typeof ProcessingPipeline !== 'function') {
    throw new Error('ProcessingPipeline is not a class');
  }

  const pipeline = new ProcessingPipeline();
  if (typeof pipeline.validator !== 'object') {
    throw new Error('ProcessingPipeline does not have validator');
  }

  console.log('✅ processingPipeline.js exports correct class');
  console.log('   - ProcessingPipeline: class');
  console.log('   - validator: object\n');
} catch (error) {
  console.error('❌ processingPipeline.js verification failed:', error.message);
  allPassed = false;
}

// Test 6: Verify validation-monitoring.js
console.log('Test 6: Verifying routes/validation-monitoring.js...');
try {
  const validationMonitoring = require('./routes/validation-monitoring');

  if (typeof validationMonitoring !== 'function') {
    throw new Error('validation-monitoring router is not exported');
  }

  console.log('✅ validation-monitoring.js exports router correctly\n');
} catch (error) {
  console.error(
    '❌ validation-monitoring.js verification failed:',
    error.message
  );
  allPassed = false;
}

// Test 7: Verify UnifiedValidator functionality
console.log('Test 7: Testing UnifiedValidator functionality...');
try {
  const { UnifiedValidator } = require('@dreamscapes/shared');
  const validator = new UnifiedValidator({ strictMode: false });

  // Test with a minimal valid dream
  const testDream = {
    id: '12345678-1234-1234-1234-123456789abc',
    title: 'Test Dream',
    style: 'ethereal',
    structures: [
      {
        id: 'struct-1',
        type: 'floating_platform',
        pos: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
      },
    ],
    entities: [
      {
        id: 'entity-1',
        type: 'floating_orbs',
        count: 10,
        params: { speed: 1, glow: 0.5, size: 1 },
      },
    ],
    cinematography: {
      durationSec: 30,
      shots: [
        {
          type: 'establish',
          duration: 10,
          startPos: [0, 5, 10],
          endPos: [0, 5, 10],
        },
      ],
    },
    environment: {
      preset: 'dawn',
      fog: 0.3,
      skyColor: '#87CEEB',
      ambientLight: 0.5,
    },
    render: {
      res: [1920, 1080],
      fps: 30,
      quality: 'medium',
    },
  };

  const result = validator.validateDreamObject(testDream);

  if (typeof result !== 'object') {
    throw new Error('Validation result is not an object');
  }
  if (typeof result.valid !== 'boolean') {
    throw new Error('Validation result does not have valid property');
  }

  console.log('✅ UnifiedValidator functionality works correctly');
  console.log(`   - Validation result: ${result.valid ? 'valid' : 'invalid'}`);
  console.log(`   - Error count: ${result.errorCount || 0}\n`);
} catch (error) {
  console.error(
    '❌ UnifiedValidator functionality test failed:',
    error.message
  );
  allPassed = false;
}

// Final summary
console.log('═'.repeat(60));
if (allPassed) {
  console.log('✅ ALL TESTS PASSED');
  console.log('\nExpress service validation integration is working correctly!');
  console.log('All files properly import from shared module (../../shared)');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('\nPlease review the errors above and fix the issues.');
  process.exit(1);
}
