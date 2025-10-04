/**
 * Test script for Response Structure Logging
 *
 * This script tests the ResponseStructureInspector and enhanced logging
 * in EnhancedResponseTransformer to verify Task 1 implementation.
 */

const ResponseStructureInspector = require('./utils/ResponseStructureInspector');
const EnhancedResponseTransformer = require('./utils/EnhancedResponseTransformer');

console.log('=== Testing Response Structure Logging Implementation ===\n');

// Test 1: ResponseStructureInspector with various response formats
console.log(
  'Test 1: ResponseStructureInspector with different response formats\n'
);

const inspector = new ResponseStructureInspector({
  maxDepth: 5,
  maxSampleLength: 500,
  enableDetailedLogging: true,
});

// Test case 1: Direct dream object
console.log('--- Test Case 1: Direct dream object ---');
const directDreamObject = {
  id: 'dream_123',
  structures: [{ type: 'building', name: 'Tower' }],
  entities: [{ type: 'character', name: 'Hero' }],
  title: 'Test Dream',
};
inspector.inspectResponse(directDreamObject, 'test-provider', { testCase: 1 });

// Test case 2: Wrapped in data property
console.log('\n--- Test Case 2: Wrapped in data property ---');
const wrappedInData = {
  data: {
    id: 'dream_456',
    structures: [{ type: 'landscape', name: 'Mountain' }],
    entities: [{ type: 'creature', name: 'Dragon' }],
  },
};
inspector.inspectResponse(wrappedInData, 'test-provider', { testCase: 2 });

// Test case 3: Wrapped in content property (string JSON)
console.log('\n--- Test Case 3: Content as JSON string ---');
const contentAsString = {
  content: JSON.stringify({
    id: 'dream_789',
    structures: [{ type: 'structure', name: 'Castle' }],
    entities: [],
  }),
};
inspector.inspectResponse(contentAsString, 'test-provider', { testCase: 3 });

// Test case 4: Wrapped in content property (object)
console.log('\n--- Test Case 4: Content as object ---');
const contentAsObject = {
  content: {
    id: 'dream_101',
    structures: [],
    entities: [{ type: 'npc', name: 'Merchant' }],
  },
};
inspector.inspectResponse(contentAsObject, 'test-provider', { testCase: 4 });

// Test case 5: OpenAI-style response
console.log('\n--- Test Case 5: OpenAI-style response ---');
const openAIStyle = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          id: 'dream_202',
          structures: [{ type: 'room', name: 'Library' }],
          entities: [],
        }),
      },
    },
  ],
};
inspector.inspectResponse(openAIStyle, 'openai', { testCase: 5 });

// Test case 6: Cerebras-style response (unknown format)
console.log(
  '\n--- Test Case 6: Unknown format (simulating Cerebras issue) ---'
);
const unknownFormat = {
  result: {
    output: {
      text: 'Some dream description',
    },
  },
  metadata: {
    model: 'llama-4',
  },
};
inspector.inspectResponse(unknownFormat, 'cerebras', { testCase: 6 });

// Test case 7: Null response
console.log('\n--- Test Case 7: Null response ---');
inspector.inspectResponse(null, 'test-provider', { testCase: 7 });

// Test case 8: String response
console.log('\n--- Test Case 8: String response ---');
const stringResponse = JSON.stringify({
  id: 'dream_303',
  structures: [],
  entities: [],
});
inspector.inspectResponse(stringResponse, 'test-provider', { testCase: 8 });

// Test 2: EnhancedResponseTransformer extraction with logging
console.log(
  '\n\n=== Test 2: EnhancedResponseTransformer Extraction Logging ===\n'
);

const transformer = new EnhancedResponseTransformer({
  enableValidation: false, // Disable validation for this test
  enableRepair: false,
  logTransformations: true,
  enableStructureInspection: true,
});

// Test extraction with various formats
console.log('--- Extraction Test 1: Direct dream object ---');
try {
  const result1 = transformer.extractDreamData(
    directDreamObject,
    'test-provider'
  );
  console.log('Extraction result:', result1 ? 'SUCCESS' : 'FAILED');
} catch (error) {
  console.error('Extraction error:', error.message);
}

console.log('\n--- Extraction Test 2: Wrapped in data ---');
try {
  const result2 = transformer.extractDreamData(wrappedInData, 'test-provider');
  console.log('Extraction result:', result2 ? 'SUCCESS' : 'FAILED');
} catch (error) {
  console.error('Extraction error:', error.message);
}

console.log('\n--- Extraction Test 3: Content as string ---');
try {
  const result3 = transformer.extractDreamData(
    contentAsString,
    'test-provider'
  );
  console.log('Extraction result:', result3 ? 'SUCCESS' : 'FAILED');
} catch (error) {
  console.error('Extraction error:', error.message);
}

console.log(
  '\n--- Extraction Test 4: Unknown format (should fail with detailed logging) ---'
);
try {
  const result4 = transformer.extractDreamData(unknownFormat, 'cerebras');
  console.log('Extraction result:', result4 ? 'SUCCESS' : 'FAILED (EXPECTED)');
} catch (error) {
  console.error('Extraction error:', error.message);
}

console.log(
  '\n--- Extraction Test 5: Null response (should fail with detailed logging) ---'
);
try {
  const result5 = transformer.extractDreamData(null, 'test-provider');
  console.log('Extraction result:', result5 ? 'SUCCESS' : 'FAILED (EXPECTED)');
} catch (error) {
  console.error('Extraction error:', error.message);
}

console.log('\n\n=== Test Complete ===');
console.log('Check the logs above to verify:');
console.log(
  '1. ResponseStructureInspector logs response type, keys, nested structure, and sample'
);
console.log(
  '2. EnhancedResponseTransformer logs each extraction pattern attempt'
);
console.log(
  '3. Failed extractions log detailed reasons for each pattern failure'
);
console.log('4. Response structure is logged before extraction attempts');
