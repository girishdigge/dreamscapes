// tests/optimization-system.test.js
// Tests for the prompt optimization and analytics system

const { PromptOptimizer, PromptAnalytics } = require('../engine');

async function testOptimizationSystem() {
  console.log('Testing Prompt Optimization and Analytics System...');

  try {
    // Test PromptOptimizer
    console.log('\n=== Testing PromptOptimizer ===');

    const optimizer = new PromptOptimizer();
    console.log('✅ PromptOptimizer instantiated successfully');

    // Create an experiment
    const basePrompt = `Generate a detailed dream scene based on the following description: {input}

INSTRUCTIONS:
1. Create a vivid, immersive scene description
2. Include specific visual details and atmosphere
3. Generate proper JSON format output

OUTPUT FORMAT:
{
  "title": "Dream title",
  "description": "Detailed description",
  "scenes": [...]
}`;

    const experiment = optimizer.createExperiment(
      'test_experiment_1',
      basePrompt,
      {
        strategies: ['length_optimization', 'instruction_clarity'],
        target_metrics: ['relevance', 'completeness'],
        sample_size: 5,
      }
    );

    console.log('✅ Experiment created successfully');
    console.log(`   - Experiment ID: ${experiment.id}`);
    console.log(`   - Variants: ${experiment.variants.length}`);
    console.log(`   - Strategies: ${experiment.strategies.join(', ')}`);

    // Create test cases
    const testCases = [
      {
        id: 'test_1',
        input: 'I dreamed of flying over a crystal city',
        expected: { title: 'Crystal City Flight', scenes: 1 },
      },
      {
        id: 'test_2',
        input: 'I dreamed of walking through an enchanted forest',
        expected: { title: 'Enchanted Forest Walk', scenes: 1 },
      },
      {
        id: 'test_3',
        input: 'I dreamed of swimming in an ocean of stars',
        expected: { title: 'Stellar Ocean', scenes: 1 },
      },
    ];

    // Run the experiment
    console.log('Running experiment...');
    const experimentResults = await optimizer.runExperiment(
      'test_experiment_1',
      testCases
    );

    console.log('✅ Experiment completed successfully');
    console.log(`   - Winner: ${experimentResults.analysis.winner}`);
    console.log(
      `   - Confidence: ${(experimentResults.analysis.confidence * 100).toFixed(
        1
      )}%`
    );
    console.log(`   - Insights: ${experimentResults.analysis.insights.length}`);

    // Test PromptAnalytics
    console.log('\n=== Testing PromptAnalytics ===');

    const analytics = new PromptAnalytics();
    console.log('✅ PromptAnalytics instantiated successfully');

    // Simulate tracking some requests
    const sessionId = 'test_session_1';
    const requests = [];

    for (let i = 0; i < 5; i++) {
      const requestId = `request_${i + 1}`;

      // Track request start
      analytics.trackRequest({
        request_id: requestId,
        session_id: sessionId,
        prompt_type: 'dream_generation',
        provider: i % 2 === 0 ? 'cerebras' : 'openai',
        style: ['ethereal', 'cyberpunk', 'natural'][i % 3],
        quality: ['standard', 'high'][i % 2],
        input_length: 50 + i * 10,
      });

      // Simulate response
      const responseTime = 1000 + Math.random() * 2000;
      const success = Math.random() > 0.1; // 90% success rate

      analytics.trackResponse(requestId, {
        response_time: responseTime,
        token_usage: 500 + Math.random() * 1000,
        output_length: 1000 + Math.random() * 500,
        success,
        error: success ? null : 'Simulated error',
        quality_scores: {
          relevance: 0.7 + Math.random() * 0.3,
          completeness: 0.6 + Math.random() * 0.4,
          creativity: 0.8 + Math.random() * 0.2,
          coherence: 0.75 + Math.random() * 0.25,
        },
      });

      // Simulate user feedback for some requests
      if (i % 2 === 0) {
        analytics.trackUserFeedback(requestId, {
          satisfaction_rating: 3 + Math.random() * 2,
          quality_rating: 3 + Math.random() * 2,
          usefulness_rating: 3 + Math.random() * 2,
          comments: `Test feedback for request ${i + 1}`,
        });
      }

      requests.push(requestId);
    }

    console.log('✅ Request tracking completed');
    console.log(`   - Tracked requests: ${requests.length}`);

    // Generate analytics report
    const report = analytics.generateReport({
      time_range: '24h',
      categories: ['performance', 'quality', 'usage'],
      include_trends: true,
    });

    console.log('✅ Analytics report generated successfully');
    console.log(`   - Total requests: ${report.total_requests}`);
    console.log(
      `   - Categories: ${Object.keys(report.categories).join(', ')}`
    );
    console.log(`   - Trends included: ${report.trends ? 'Yes' : 'No'}`);

    // Test performance metrics
    if (report.categories.performance) {
      const perfMetrics = report.categories.performance;
      console.log('   - Performance metrics:');

      if (perfMetrics.response_time) {
        console.log(
          `     * Avg response time: ${perfMetrics.response_time.mean}ms`
        );
      }

      if (perfMetrics.success_rate) {
        console.log(
          `     * Success rate: ${(perfMetrics.success_rate.mean * 100).toFixed(
            1
          )}%`
        );
      }
    }

    // Test quality metrics
    if (report.categories.quality) {
      const qualityMetrics = report.categories.quality;
      console.log('   - Quality metrics:');

      Object.keys(qualityMetrics).forEach((metric) => {
        if (qualityMetrics[metric].mean) {
          console.log(
            `     * ${metric}: ${qualityMetrics[metric].mean.toFixed(2)}`
          );
        }
      });
    }

    // Test usage metrics
    if (report.categories.usage) {
      const usageMetrics = report.categories.usage;
      console.log('   - Usage metrics:');

      if (
        usageMetrics.provider_usage &&
        usageMetrics.provider_usage.distribution
      ) {
        console.log('     * Provider distribution:');
        Object.entries(usageMetrics.provider_usage.distribution).forEach(
          ([provider, data]) => {
            console.log(`       - ${provider}: ${data.percentage}%`);
          }
        );
      }
    }

    // Test alerts
    const alerts = analytics.getAlerts();
    console.log(`✅ Alert system tested - ${alerts.length} alerts generated`);

    // Test data export
    const exportData = analytics.exportData({
      include_raw_metrics: true,
      include_sessions: true,
      time_range: '24h',
    });

    console.log('✅ Data export completed');
    console.log(
      `   - Export size: ${JSON.stringify(exportData).length} characters`
    );

    // Integration test: Use optimizer results in analytics
    console.log('\n=== Integration Test ===');

    // Track the optimization experiment results
    const optimizationRequestId = 'optimization_test';
    analytics.trackRequest({
      request_id: optimizationRequestId,
      session_id: 'optimization_session',
      prompt_type: 'optimization_experiment',
      provider: 'cerebras',
      style: 'experimental',
      quality: 'high',
      input_length: basePrompt.length,
    });

    analytics.trackResponse(optimizationRequestId, {
      response_time: 2500,
      token_usage: 1200,
      output_length: 800,
      success: true,
      quality_scores: {
        relevance: 0.85,
        completeness: 0.9,
        creativity: 0.75,
        coherence: 0.88,
      },
      provider_metadata: {
        experiment_id: experiment.id,
        variant_used: experimentResults.analysis.winner,
        optimization_applied: true,
      },
    });

    console.log('✅ Integration test completed');
    console.log('   - Optimization results tracked in analytics');

    // Test advanced analytics features
    console.log('\n=== Advanced Features Test ===');

    // Test trend analysis
    if (report.trends) {
      console.log('✅ Trend analysis available:');
      Object.keys(report.trends).forEach((trendType) => {
        const trend = report.trends[trendType];
        if (trend.trend_direction) {
          console.log(`   - ${trendType}: ${trend.trend_direction}`);
        }
      });
    }

    // Test optimization history
    const optimizationHistory = optimizer.getOptimizationHistory();
    console.log(
      `✅ Optimization history: ${optimizationHistory.length} entries`
    );

    // Test experiment export
    const experimentExport = optimizer.exportExperiment('test_experiment_1');
    console.log('✅ Experiment export completed');
    console.log(
      `   - Export contains: ${Object.keys(experimentExport).join(', ')}`
    );

    console.log('\n🎉 All optimization and analytics tests passed!');

    return {
      optimizer_tests: 'passed',
      analytics_tests: 'passed',
      integration_tests: 'passed',
      experiment_results: experimentResults,
      analytics_report: report,
    };
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testOptimizationSystem()
    .then((results) => {
      console.log('\n✅ Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed');
      process.exit(1);
    });
}

module.exports = { testOptimizationSystem };
