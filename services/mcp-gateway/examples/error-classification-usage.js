// examples/error-classification-usage.js
// Example usage of ErrorClassificationSystem in MCP Gateway

const ErrorClassificationIntegration = require('../utils/ErrorClassificationIntegration');

/**
 * Example: Using ErrorClassificationSystem in MCP Gateway routes
 */
async function exampleRouteErrorHandling() {
  console.log('=== Error Classification System Usage Example ===\n');

  // Initialize the error classification integration
  const errorHandler = new ErrorClassificationIntegration({
    enableDetailedLogging: true,
    enableRecoveryExecution: true,
    enableMetricsCollection: true,
    classification: {
      maxRetryAttempts: 3,
      exponentialBackoffBase: 1000,
      circuitBreakerThreshold: 5,
    },
  });

  // Example 1: Response parsing error (common issue from requirements)
  console.log('1. Handling response parsing error:');
  try {
    const parsingError = new Error('response?.substring is not a function');
    const context = {
      provider: 'cerebras',
      operation: 'generateDream',
      attemptNumber: 1,
      responseData: { choices: [{ message: { content: 'Dream content' } }] },
    };

    const result = await errorHandler.handleError(parsingError, context);
    console.log(
      '   Classification:',
      result.classification.type,
      '- Severity:',
      result.classification.severity
    );
    console.log('   Recovery attempted:', result.recovery.attempted);
    console.log('   Suggestions:', result.suggestions.slice(0, 2).join(', '));
    console.log('');
  } catch (error) {
    console.error('   Error in example 1:', error.message);
  }

  // Example 2: Provider method error (missing getProviderHealth)
  console.log('2. Handling provider method error:');
  try {
    const methodError = new Error(
      'this.providerManager.getProviderHealth is not a function'
    );
    const context = {
      provider: 'system',
      operation: 'healthCheck',
      attemptNumber: 1,
    };

    const result = await errorHandler.handleError(methodError, context);
    console.log(
      '   Classification:',
      result.classification.type,
      '- Severity:',
      result.classification.severity
    );
    console.log('   Recoverable:', result.classification.recoverable);
    console.log('   Recovery attempted:', result.recovery.attempted);
    console.log('');
  } catch (error) {
    console.error('   Error in example 2:', error.message);
  }

  // Example 3: Network error with retry
  console.log('3. Handling network error:');
  try {
    const networkError = new Error('Connection refused');
    networkError.code = 'ECONNREFUSED';
    const context = {
      provider: 'openai',
      operation: 'generateDream',
      attemptNumber: 1,
      responseTime: 5000,
    };

    const result = await errorHandler.handleError(networkError, context);
    console.log(
      '   Classification:',
      result.classification.type,
      '- Severity:',
      result.classification.severity
    );
    console.log('   Retryable:', result.classification.retryable);
    console.log('   Recovery success:', result.recovery.success);
    console.log('');
  } catch (error) {
    console.error('   Error in example 3:', error.message);
  }

  // Example 4: Rate limit error
  console.log('4. Handling rate limit error:');
  try {
    const rateLimitError = new Error('Too many requests');
    rateLimitError.status = 429;
    const context = {
      provider: 'openai',
      operation: 'generateDream',
      responseHeaders: { 'retry-after': '60' },
    };

    const result = await errorHandler.handleError(rateLimitError, context);
    console.log(
      '   Classification:',
      result.classification.type,
      '- Severity:',
      result.classification.severity
    );
    console.log('   Recovery action:', result.recovery.action);
    console.log(
      '   Estimated recovery time:',
      result.metadata.estimatedRecoveryTime + 'ms'
    );
    console.log('');
  } catch (error) {
    console.error('   Error in example 4:', error.message);
  }

  // Example 5: Authentication error
  console.log('5. Handling authentication error:');
  try {
    const authError = new Error('Invalid API key');
    authError.status = 401;
    const context = {
      provider: 'cerebras',
      operation: 'generateDream',
    };

    const result = await errorHandler.handleError(authError, context);
    console.log(
      '   Classification:',
      result.classification.type,
      '- Severity:',
      result.classification.severity
    );
    console.log('   Recoverable:', result.classification.recoverable);
    console.log('   Key suggestion:', result.suggestions[0]);
    console.log('');
  } catch (error) {
    console.error('   Error in example 5:', error.message);
  }

  // Show collected metrics
  console.log('6. Error handling metrics:');
  const metrics = errorHandler.getMetrics();
  console.log('   Total errors handled:', metrics.totalErrors);
  console.log(
    '   Classification rate:',
    metrics.classificationRate.toFixed(1) + '%'
  );
  console.log(
    '   Recovery success rate:',
    metrics.recoverySuccessRate.toFixed(1) + '%'
  );
  console.log(
    '   Errors by type:',
    Object.keys(metrics.errorsByType).join(', ')
  );
  console.log(
    '   Errors by severity:',
    Object.keys(metrics.errorsBySeverity).join(', ')
  );
  console.log('');

  // Show classification system statistics
  console.log('7. Classification system statistics:');
  const stats = errorHandler.getClassificationStatistics();
  console.log('   Error patterns defined:', stats.errorPatterns);
  console.log('   Severity rules defined:', stats.severityRules);
  console.log('   Recovery strategies defined:', stats.recoveryStrategies);
  console.log('');
}

/**
 * Example: Integration with Express.js error middleware
 */
function createEnhancedErrorMiddleware() {
  const errorHandler = new ErrorClassificationIntegration({
    enableDetailedLogging: true,
    enableRecoveryExecution: false, // Don't execute recovery in middleware
    enableMetricsCollection: true,
  });

  return async (err, req, res, next) => {
    const context = {
      provider: req.headers['x-provider'] || 'unknown',
      operation: req.route?.path || req.path,
      attemptNumber: parseInt(req.headers['x-attempt-number']) || 1,
      responseTime: Date.now() - (req.startTime || Date.now()),
    };

    const result = await errorHandler.handleError(err, context);

    // Determine HTTP status code based on classification
    let statusCode = 500;
    switch (result.classification.type) {
      case 'authentication':
        statusCode = 401;
        break;
      case 'validation':
        statusCode = 400;
        break;
      case 'rate_limit':
        statusCode = 429;
        break;
      case 'network_error':
      case 'timeout':
        statusCode = 503;
        break;
      case 'provider_error':
        statusCode = 502;
        break;
    }

    // Send enhanced error response
    res.status(statusCode).json({
      success: false,
      error: result.error,
      type: result.classification.type,
      severity: result.classification.severity,
      retryable: result.classification.retryable,
      suggestions: result.suggestions,
      metadata: {
        timestamp: result.context.timestamp,
        provider: result.context.provider,
        operation: result.context.operation,
        estimatedRecoveryTime: result.metadata.estimatedRecoveryTime,
      },
    });
  };
}

/**
 * Example: Using classification for provider selection
 */
async function exampleProviderSelection(errorHistory) {
  console.log('=== Provider Selection Based on Error Classification ===\n');

  const errorHandler = new ErrorClassificationIntegration();

  // Analyze error patterns to inform provider selection
  const providerReliability = {};

  for (const errorRecord of errorHistory) {
    const classification = errorHandler.classifier.classifyError(
      errorRecord.error,
      errorRecord.context
    );

    const provider = errorRecord.context.provider;
    if (!providerReliability[provider]) {
      providerReliability[provider] = {
        totalErrors: 0,
        criticalErrors: 0,
        recoverableErrors: 0,
        averageSeverity: 0,
      };
    }

    const reliability = providerReliability[provider];
    reliability.totalErrors++;

    if (classification.severity === 'critical') {
      reliability.criticalErrors++;
    }

    if (classification.recoverable) {
      reliability.recoverableErrors++;
    }

    // Calculate weighted severity score
    const severityWeights = { low: 1, medium: 2, high: 3, critical: 4 };
    reliability.averageSeverity =
      (reliability.averageSeverity * (reliability.totalErrors - 1) +
        severityWeights[classification.severity]) /
      reliability.totalErrors;
  }

  // Rank providers by reliability
  const rankedProviders = Object.entries(providerReliability)
    .map(([provider, stats]) => ({
      provider,
      reliabilityScore:
        (stats.recoverableErrors / stats.totalErrors) *
        (1 / stats.averageSeverity) *
        (1 - stats.criticalErrors / stats.totalErrors),
      ...stats,
    }))
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  console.log('Provider reliability ranking:');
  rankedProviders.forEach((provider, index) => {
    console.log(
      `   ${index + 1}. ${
        provider.provider
      } (Score: ${provider.reliabilityScore.toFixed(3)})`
    );
    console.log(
      `      Total errors: ${provider.totalErrors}, Critical: ${provider.criticalErrors}`
    );
    console.log(
      `      Average severity: ${provider.averageSeverity.toFixed(2)}`
    );
  });

  return rankedProviders;
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await exampleRouteErrorHandling();

      // Example error history for provider selection
      const mockErrorHistory = [
        {
          error: new Error('response?.substring is not a function'),
          context: { provider: 'cerebras', operation: 'generateDream' },
        },
        {
          error: Object.assign(new Error('Connection timeout'), {
            name: 'TimeoutError',
          }),
          context: { provider: 'openai', operation: 'generateDream' },
        },
        {
          error: Object.assign(new Error('Rate limit exceeded'), {
            status: 429,
          }),
          context: { provider: 'openai', operation: 'generateDream' },
        },
        {
          error: Object.assign(new Error('Internal server error'), {
            status: 500,
          }),
          context: { provider: 'cerebras', operation: 'generateDream' },
        },
      ];

      await exampleProviderSelection(mockErrorHistory);
    } catch (error) {
      console.error('Error running examples:', error);
    }
  })();
}

module.exports = {
  exampleRouteErrorHandling,
  createEnhancedErrorMiddleware,
  exampleProviderSelection,
};
