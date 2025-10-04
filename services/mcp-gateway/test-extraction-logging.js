/**
 * Test script to verify comprehensive extraction logging
 */

const ExtractionLogger = require('./utils/ExtractionLogger');
const EnhancedContentExtractor = require('./utils/EnhancedContentExtractor');

console.log('=== Testing ExtractionLogger ===\n');

// Test 1: Create logger and test basic logging
console.log('Test 1: Basic Logging');
const logger = new ExtractionLogger({
  enableLogging: true,
  logLevel: 'debug',
  maxResponseLength: 100,
});

const context = logger.createRequestContext({
  provider: 'cerebras',
  operation: 'test',
  requestId: 'test-123',
});

console.log('Created context:', context);

// Test 2: Test response truncation
console.log('\nTest 2: Response Truncation');
const longResponse = { data: 'x'.repeat(200) };
const truncated = logger.truncateResponse(longResponse);
console.log('Truncated response:', truncated);

// Test 3: Test extraction logging
console.log('\nTest 3: Extraction Logging');
logger.logExtractionStart(context, { test: 'data' });
logger.logPatternAttempt(
  context,
  'test_pattern',
  'response.test',
  false,
  'Test pattern failed'
);
logger.logExtractionSuccess(context, 'successful_pattern', {
  id: 'test-id',
  structures: [{ id: 's1' }],
  entities: [{ id: 'e1' }],
});

// Test 4: Test validation logging
console.log('\nTest 4: Validation Logging');
logger.logValidationStart(context, { id: 'test-id' });
logger.logValidationResult(context, {
  valid: false,
  errorCount: 2,
  warningCount: 1,
  validationTime: 15,
  errors: [
    {
      field: 'structures',
      error: 'MISSING_REQUIRED_FIELD',
      message: 'Structures array is required',
      severity: 'critical',
    },
  ],
});

// Test 5: Test repair logging
console.log('\nTest 5: Repair Logging');
logger.logRepairStart(context, [
  { field: 'structures', error: 'MISSING_REQUIRED_FIELD' },
]);
logger.logRepairResult(context, {
  success: true,
  appliedStrategies: ['fillMissingFields', 'enhanceContent'],
  errors: [],
  processingTime: 234,
  attempts: 1,
});

// Test 6: Test transformation logging
console.log('\nTest 6: Transformation Logging');
logger.logTransformationStart(context, { test: 'response' });
logger.logTransformationSuccess(
  context,
  {
    data: { id: 'test-id' },
    metadata: { validationPassed: true, repairApplied: true },
  },
  150
);

// Test 7: Test extraction failure logging
console.log('\nTest 7: Extraction Failure Logging');
const failureResponse = {
  choices: [{ message: { content: 'test content' } }],
  model: 'llama-3.3-70b',
};
const attemptedPatterns = [
  {
    pattern: 'direct_dream_object',
    description: 'response.id && response.structures',
    reason: 'Missing fields: structures, entities',
  },
  {
    pattern: 'standard_content',
    description: 'response.content',
    reason: 'response.content is undefined',
  },
];
logger.logExtractionFailure(context, failureResponse, attemptedPatterns);

// Test 8: Test log level controls
console.log('\nTest 8: Log Level Controls');
console.log('Current log level:', logger.getLogLevel());
logger.setLogLevel('info');
console.log('New log level:', logger.getLogLevel());
console.log('Should log debug?', logger.shouldLog('debug'));
console.log('Should log info?', logger.shouldLog('info'));
console.log('Should log error?', logger.shouldLog('error'));

// Test 9: Test EnhancedContentExtractor with logging
console.log('\nTest 9: EnhancedContentExtractor with Logging');
const extractor = new EnhancedContentExtractor({
  enableLogging: true,
  logLevel: 'debug',
});

// Test with a response that should succeed
const successResponse = {
  id: 'dream-123',
  structures: [{ id: 's1', type: 'floating_platform' }],
  entities: [{ id: 'e1', type: 'floating_orbs' }],
};

console.log('\nExtracting from valid dream object...');
const result1 = extractor.extractContent(successResponse, 'test-provider', {
  requestId: 'test-req-1',
  operation: 'test-extraction',
});
console.log('Extraction result:', result1 ? 'SUCCESS' : 'FAILED');

// Test with a response that should fail
const failResponse = {
  choices: [{ message: { content: 'not a dream object' } }],
};

console.log('\nExtracting from invalid response...');
const result2 = extractor.extractContent(failResponse, 'test-provider', {
  requestId: 'test-req-2',
  operation: 'test-extraction',
});
console.log('Extraction result:', result2 ? 'SUCCESS' : 'FAILED');

// Test 10: Test metrics logging
console.log('\nTest 10: Extraction Metrics');
const metrics = extractor.getExtractionMetrics();
logger.logExtractionMetrics(context, metrics);
console.log('Metrics:', {
  totalExtractions: metrics.totalExtractions,
  successfulExtractions: metrics.successfulExtractions,
  failedExtractions: metrics.failedExtractions,
  successRate: metrics.successRate.toFixed(2) + '%',
});

console.log('\n=== All Tests Complete ===');
