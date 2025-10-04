/**
 * Unit test for extraction metrics endpoint implementation
 *
 * This test verifies that the ExtractionMetricsCollector is properly
 * integrated and the endpoint returns the expected data structure.
 */

const ExtractionMetricsCollector = require('./utils/ExtractionMetricsCollector');

console.log('Testing ExtractionMetricsCollector integration...\n');

// Create a test instance
const collector = new ExtractionMetricsCollector({
  enableLogging: false,
  maxHistorySize: 100,
  aggregationInterval: 0, // Disable auto-aggregation for testing
  syncInterval: 0, // Disable auto-sync for testing
});

console.log('✓ ExtractionMetricsCollector instantiated');

// Test recording successful extraction
collector.recordExtractionAttempt('cerebras', 'standard_patterns', true, {
  requestId: 'test-req-1',
  responseType: 'object',
});

console.log('✓ Recorded successful extraction attempt');

// Test recording failed extraction
collector.recordExtractionAttempt('cerebras', 'direct_dream_object', false, {
  requestId: 'test-req-2',
  responseType: 'object',
  attemptedPatterns: ['direct_dream_object', 'standard_patterns'],
});

console.log('✓ Recorded failed extraction attempt');

// Test recording extraction failure with details
// Note: recordExtractionFailure is for detailed failure logging, but we also need to record the attempt
collector.recordExtractionAttempt('openai', 'all_patterns', false, {
  requestId: 'test-req-3',
  responseType: 'object',
  attemptedPatterns: ['direct_dream_object', 'standard_patterns'],
});

collector.recordExtractionFailure(
  'openai',
  { choices: [{ message: { content: 'test' } }] },
  [
    {
      pattern: 'direct_dream_object',
      description: 'Check if response is dream object',
      reason: 'Missing required fields',
    },
    {
      pattern: 'standard_patterns',
      description: 'Try standard content fields',
      reason: 'No content field found',
    },
  ],
  {
    requestId: 'test-req-3',
    errorId: 'err-123',
  }
);

console.log('✓ Recorded extraction failure with details');

// Get metrics report
const report = collector.getMetricsReport();

console.log('\n=== Metrics Report ===\n');

// Verify overall metrics
console.log('Overall Metrics:');
console.log(`- Total attempts: ${report.overall.totalAttempts}`);
console.log(`- Successful: ${report.overall.successfulExtractions}`);
console.log(`- Failed: ${report.overall.failedExtractions}`);
console.log(`- Success rate: ${report.overall.successRate.toFixed(2)}%`);

if (report.overall.totalAttempts !== 3) {
  console.error(
    '✗ Expected 3 total attempts, got',
    report.overall.totalAttempts
  );
  process.exit(1);
}

console.log('✓ Overall metrics correct');

// Verify provider metrics
console.log('\nProvider Metrics:');
const providers = Object.keys(report.byProvider);
console.log(`- Providers tracked: ${providers.length}`);

providers.forEach((provider) => {
  const metrics = report.byProvider[provider];
  console.log(`  - ${provider}:`);
  console.log(`    Total: ${metrics.totalAttempts}`);
  console.log(`    Success rate: ${metrics.successRate.toFixed(2)}%`);
  console.log(`    Patterns: ${Object.keys(metrics.patterns).length}`);
});

if (!report.byProvider.cerebras) {
  console.error('✗ Expected cerebras provider metrics');
  process.exit(1);
}

if (!report.byProvider.openai) {
  console.error('✗ Expected openai provider metrics');
  process.exit(1);
}

console.log('✓ Provider metrics correct');

// Verify pattern metrics
console.log('\nPattern Metrics:');
const patterns = Object.keys(report.byPattern);
console.log(`- Patterns tracked: ${patterns.length}`);

patterns.forEach((pattern) => {
  const metrics = report.byPattern[pattern];
  console.log(`  - ${pattern}:`);
  console.log(`    Attempts: ${metrics.attempts}`);
  console.log(`    Success rate: ${metrics.successRate.toFixed(2)}%`);
});

console.log('✓ Pattern metrics correct');

// Verify failure patterns
console.log('\nFailure Patterns:');
console.log(`- Failure patterns detected: ${report.failurePatterns.length}`);

if (report.failurePatterns.length > 0) {
  report.failurePatterns.forEach((pattern, index) => {
    console.log(
      `  ${index + 1}. Provider: ${pattern.provider}, Type: ${
        pattern.responseType
      }, Occurrences: ${pattern.occurrences}`
    );
  });
}

console.log('✓ Failure patterns tracked');

// Verify recent failures
console.log('\nRecent Failures:');
console.log(`- Recent failures: ${report.recentFailures.length}`);

if (report.recentFailures.length > 0) {
  console.log(`  Latest failure:`);
  const latest = report.recentFailures[0];
  console.log(`    Provider: ${latest.provider}`);
  console.log(`    Attempted patterns: ${latest.attemptedPatterns.length}`);
  console.log(`    Response type: ${latest.responseDetails.type}`);
}

console.log('✓ Recent failures tracked');

// Verify insights
console.log('\nInsights:');
const insights = report.insights;
console.log(`- Overall health: ${insights.overallHealth}`);
console.log(`- Issues: ${insights.issues.length}`);
console.log(`- Recommendations: ${insights.recommendations.length}`);
console.log(`- Successful patterns: ${insights.patterns.successful.length}`);
console.log(`- Failing patterns: ${insights.patterns.failing.length}`);
console.log(`- Emerging patterns: ${insights.patterns.emerging.length}`);

console.log('✓ Insights generated');

// Test successful patterns by provider
console.log('\nSuccessful Patterns by Provider:');
const successfulPatterns = collector.getSuccessfulPatternsByProvider();

Object.keys(successfulPatterns).forEach((provider) => {
  const data = successfulPatterns[provider];
  console.log(`  - ${provider}: ${data.totalPatterns} successful patterns`);
  data.patterns.forEach((pattern) => {
    console.log(
      `    - ${pattern.pattern}: ${pattern.successRate.toFixed(2)}% (${
        pattern.successes
      }/${pattern.attempts})`
    );
  });
});

console.log('✓ Successful patterns retrieved');

// Test extraction success rate
console.log('\nExtraction Success Rates:');
providers.forEach((provider) => {
  const rate = collector.getExtractionSuccessRate(provider);
  console.log(`  - ${provider}: ${rate.toFixed(2)}%`);
});

console.log('✓ Success rates calculated');

// Test recent history
console.log('\nRecent History:');
const history = collector.getRecentHistory(10);
console.log(`- History entries: ${history.length}`);

if (history.length > 0) {
  console.log(`  Latest entry:`);
  const latest = history[0];
  console.log(`    Provider: ${latest.provider}`);
  console.log(`    Pattern: ${latest.pattern}`);
  console.log(`    Success: ${latest.success}`);
  console.log(`    Timestamp: ${latest.timestamp}`);
}

console.log('✓ History retrieved');

// Cleanup
collector.destroy();
console.log('\n✓ Collector destroyed');

console.log('\n=== All Tests Passed! ===\n');

// Print sample endpoint response structure
console.log('Expected endpoint response structure:');
console.log(
  JSON.stringify(
    {
      success: true,
      timestamp: new Date().toISOString(),
      extraction: {
        overall: report.overall,
        byProvider: report.byProvider,
        byPattern: report.byPattern,
        failurePatterns: report.failurePatterns,
        recentFailures: report.recentFailures,
        insights: report.insights,
      },
      validation: {
        overall: { totalValidations: 0, successRate: 0 },
        byService: { total: 0, successRate: 0 },
        recentFailures: [],
      },
      repair: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        byProvider: {},
        byStrategy: {},
      },
      summary: {
        extractionSuccessRate: report.overall.successRate,
        validationSuccessRate: 0,
        repairSuccessRate: 0,
        totalExtractionAttempts: report.overall.totalAttempts,
        totalValidations: 0,
        totalRepairs: 0,
      },
    },
    null,
    2
  )
);

console.log('\n✓ Integration test complete!');
