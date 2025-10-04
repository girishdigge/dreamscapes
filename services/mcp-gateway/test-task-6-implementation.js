/**
 * Test script for Task 6 implementation
 * Tests request validation, response transformation, and fallback mechanisms
 */

const RequestValidator = require('./middleware/requestValidator');
const EnhancedResponseTransformer = require('./utils/EnhancedResponseTransformer');
const GatewayFallbackHandler = require('./utils/GatewayFallbackHandler');

console.log('Testing Task 6 Implementation...\n');

// Test 1: Request Validator
console.log('=== Test 1: Request Validator ===');
const requestValidator = new RequestValidator({
  strictMode: true,
  logValidation: false,
});

// Mock request and response objects
const mockReq = {
  body: {
    text: 'A floating library in the clouds',
    style: 'ethereal',
    options: {
      temperature: 0.7,
      maxTokens: 4000,
    },
  },
  validationMetadata: {},
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log(`Response Status: ${code}`);
      console.log('Response Data:', JSON.stringify(data, null, 2));
      return data;
    },
  }),
  json: (data) => {
    console.log('Response Data:', JSON.stringify(data, null, 2));
    return data;
  },
};

const mockNext = () => {
  console.log('✅ Validation passed, proceeding to next middleware');
};

console.log('Testing valid request...');
requestValidator.validateParseRequest(mockReq, mockRes, mockNext);

console.log('\nTesting invalid request (missing text)...');
const invalidReq = {
  body: {
    style: 'ethereal',
  },
};
requestValidator.validateParseRequest(invalidReq, mockRes, mockNext);

// Test 2: Response Transformer
console.log('\n=== Test 2: Response Transformer ===');
const responseTransformer = new EnhancedResponseTransformer({
  enableValidation: true,
  enableRepair: true,
  strictMode: false,
  logTransformations: false,
});

const mockResponse = {
  id: 'test-dream-123',
  title: 'Test Dream',
  style: 'ethereal',
  structures: [
    {
      id: 'struct-1',
      type: 'floating_platform',
      pos: [0, 10, 0],
      rotation: [0, 0, 0],
      scale: 5,
      features: ['glowing_edges'],
    },
  ],
  entities: [
    {
      id: 'entity-1',
      type: 'floating_orbs',
      count: 20,
      params: {
        speed: 1,
        glow: 0.5,
        size: 1,
        color: '#B8A9D4',
      },
    },
  ],
  cinematography: {
    durationSec: 30,
    shots: [
      {
        type: 'establish',
        target: 'struct-1',
        duration: 30,
        startPos: [0, 50, 80],
        endPos: [0, 40, 60],
      },
    ],
  },
  environment: {
    preset: 'dusk',
    fog: 0.3,
    skyColor: '#87CEEB',
    ambientLight: 0.5,
  },
  render: {
    res: [1920, 1080],
    fps: 30,
    quality: 'medium',
  },
  created: new Date().toISOString(),
  source: 'test',
};

const context = {
  text: 'A floating library in the clouds',
  style: 'ethereal',
  options: {},
};

(async () => {
  try {
    console.log('Testing response transformation...');
    const transformed = await responseTransformer.transformResponse(
      mockResponse,
      'test-provider',
      context
    );

    console.log('✅ Transformation successful');
    console.log('Validation passed:', transformed.metadata.validationPassed);
    console.log('Repair applied:', transformed.metadata.repairApplied);
    console.log('Structure count:', transformed.data.structures?.length || 0);
    console.log('Entity count:', transformed.data.entities?.length || 0);

    // Test validation before sending
    console.log('\nTesting validation before sending...');
    const sendValidation =
      responseTransformer.validateBeforeSending(transformed);
    console.log('Valid for sending:', sendValidation.valid);
    console.log('Error count:', sendValidation.errorCount);

    // Test 3: Fallback Handler
    console.log('\n=== Test 3: Fallback Handler ===');
    const fallbackHandler = new GatewayFallbackHandler({
      enableFallbackGeneration: true,
      enableEmergencyRepair: true,
      logFallbacks: false,
    });

    console.log('Testing provider failure fallback...');
    const fallbackDream = await fallbackHandler.handleProviderFailure(
      new Error('Provider timeout'),
      context
    );

    console.log('✅ Fallback dream generated');
    console.log('Dream ID:', fallbackDream.id);
    console.log('Title:', fallbackDream.title);
    console.log('Style:', fallbackDream.style);
    console.log('Structure count:', fallbackDream.structures?.length || 0);
    console.log('Entity count:', fallbackDream.entities?.length || 0);
    console.log('Source:', fallbackDream.source);

    // Test invalid data handling
    console.log('\nTesting invalid data handling...');
    const invalidData = {
      id: 'invalid-dream',
      title: 'Invalid Dream',
      style: 'ethereal',
      structures: [], // Empty - invalid
      entities: [], // Empty - invalid
    };

    const repairedDream = await fallbackHandler.handleInvalidData(
      invalidData,
      [
        { field: 'structures', error: 'ARRAY_TOO_SHORT' },
        { field: 'entities', error: 'ARRAY_TOO_SHORT' },
      ],
      context
    );

    console.log('✅ Invalid data handled');
    console.log('Structure count:', repairedDream.structures?.length || 0);
    console.log('Entity count:', repairedDream.entities?.length || 0);

    // Test ensure complete response
    console.log('\nTesting ensure complete response...');
    const incompleteResponse = {
      id: 'incomplete-dream',
      title: 'Incomplete Dream',
      style: 'ethereal',
      structures: [],
      entities: [],
    };

    const completeResponse = await fallbackHandler.ensureCompleteResponse(
      incompleteResponse,
      context
    );

    console.log('✅ Response ensured complete');
    console.log('Structure count:', completeResponse.structures?.length || 0);
    console.log('Entity count:', completeResponse.entities?.length || 0);

    // Test minimal dream generation
    console.log('\nTesting minimal dream generation...');
    const minimalDream = fallbackHandler.generateMinimalDream(context);

    console.log('✅ Minimal dream generated');
    console.log('Structure count:', minimalDream.structures?.length || 0);
    console.log('Entity count:', minimalDream.entities?.length || 0);

    // Display metrics
    console.log('\n=== Metrics ===');
    console.log('Transformer metrics:', responseTransformer.getMetrics());
    console.log('Fallback metrics:', fallbackHandler.getMetrics());

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
