// services/express/tests/responseProcessor.test.js
const { MCPResponseProcessor } = require('../utils/responseProcessor');

// Manual test function for development
async function manualTest() {
  console.log('Running manual tests for MCPResponseProcessor...');

  const processor = new MCPResponseProcessor();

  // Test response preview
  console.log('\n=== Testing response preview ===');
  console.log('Empty:', processor.createResponsePreview(''));
  console.log('Short:', processor.createResponsePreview('Hello world'));
  console.log('Long:', processor.createResponsePreview('x'.repeat(400), 50));

  // Test JSON issue identification
  console.log('\n=== Testing JSON issue identification ===');
  console.log('Trailing comma:', processor.identifyJsonIssues('{"a": 1,}'));
  console.log('Mismatched braces:', processor.identifyJsonIssues('{"a": 1'));
  console.log('Valid JSON:', processor.identifyJsonIssues('{"a": 1}'));
  console.log(
    'Undefined values:',
    processor.identifyJsonIssues('{"key": undefined}')
  );
  console.log(
    'Unescaped newlines:',
    processor.identifyJsonIssues('{"key": "value\nwith newline"}')
  );

  // Test error categorization
  console.log('\n=== Testing error categorization ===');
  console.log(
    'Timeout:',
    processor.categorizeError(new Error('timeout occurred'))
  );
  console.log('JSON:', processor.categorizeError(new Error('invalid json')));
  console.log(
    'Network:',
    processor.categorizeError(new Error('network error'))
  );
  console.log(
    'Validation:',
    processor.categorizeError(new Error('schema validation failed'))
  );
  console.log(
    'Unknown:',
    processor.categorizeError(new Error('something else'))
  );

  // Test retry determination
  console.log('\n=== Testing retry determination ===');
  console.log(
    'Timeout retryable:',
    processor.isRetryableError(new Error('timeout'))
  );
  console.log(
    'Network retryable:',
    processor.isRetryableError(new Error('network failed'))
  );
  console.log(
    'JSON retryable:',
    processor.isRetryableError(new Error('invalid json'))
  );
  console.log(
    'Validation retryable:',
    processor.isRetryableError(new Error('validation failed'))
  );

  // Test processing stage identification
  console.log('\n=== Testing processing stage identification ===');
  console.log(
    'Text extraction:',
    processor.identifyProcessingStage(new Error('failed to read response body'))
  );
  console.log(
    'JSON parsing:',
    processor.identifyProcessingStage(new Error('invalid json format'))
  );
  console.log(
    'Structure validation:',
    processor.identifyProcessingStage(new Error('missing required fields'))
  );
  console.log(
    'Dream data extraction:',
    processor.identifyProcessingStage(new Error('no dream data found'))
  );
  console.log(
    'Schema validation:',
    processor.identifyProcessingStage(new Error('schema validation failed'))
  );
  console.log(
    'Unknown stage:',
    processor.identifyProcessingStage(new Error('something unexpected'))
  );

  // Test cache functionality
  console.log('\n=== Testing cache functionality ===');
  console.log('Initial stats:', processor.getCacheStats());

  // Test cache key creation
  const dreamData1 = {
    id: 'test1',
    title: 'Test Dream',
    style: 'ethereal',
    structures: [],
    entities: [],
  };
  const dreamData2 = {
    id: 'test2',
    title: 'Test Dream',
    style: 'ethereal',
    structures: [],
    entities: [],
  };

  const key1 = processor.createValidationCacheKey(dreamData1);
  const key2 = processor.createValidationCacheKey(dreamData2);

  console.log('Cache key 1:', key1.substring(0, 50) + '...');
  console.log('Cache key 2:', key2.substring(0, 50) + '...');
  console.log('Keys are different:', key1 !== key2);

  processor.clearValidationCache();
  console.log('After clear:', processor.getCacheStats());

  console.log('\n=== Manual tests completed successfully! ===');

  // Test some edge cases
  console.log('\n=== Testing edge cases ===');

  // Test with null/undefined inputs
  try {
    processor.createResponsePreview(null);
    console.log('Null preview handled gracefully');
  } catch (e) {
    console.log('Null preview error:', e.message);
  }

  try {
    processor.identifyJsonIssues('');
    console.log('Empty JSON issues handled gracefully');
  } catch (e) {
    console.log('Empty JSON issues error:', e.message);
  }

  // Test complex JSON issues
  const complexJson = `{
    "key1": "value1",
    "key2": undefined,
    "key3": [1, 2, 3,],
    "key4": {
      "nested": "value"
    }
  `;

  console.log(
    'Complex JSON issues:',
    processor.identifyJsonIssues(complexJson)
  );

  console.log('\n=== All tests completed! ===');
}

// Export for use in other tests
module.exports = {
  MCPResponseProcessor,
  manualTest,
};

// Run manual test if this file is executed directly
if (require.main === module) {
  manualTest().catch(console.error);
}
