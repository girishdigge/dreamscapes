// examples/content-repair-demo.js
// Demonstration of the automatic content repair system

const ValidationPipeline = require('../engine/ValidationPipeline');
const ContentRepair = require('../engine/ContentRepair');
const RetryStrategies = require('../engine/RetryStrategies');

async function demonstrateContentRepair() {
  console.log('🔧 Content Repair System Demonstration\n');

  const validationPipeline = new ValidationPipeline();
  const contentRepair = new ContentRepair();
  const retryStrategies = new RetryStrategies();

  // Example 1: Malformed content with multiple issues
  console.log('📝 Example 1: Repairing malformed dream response');
  console.log('='.repeat(50));

  const malformedContent = {
    // Missing 'success' field
    data: {
      // Missing 'id' and 'title'
      description: 'Short', // Too short description
      scenes: [
        {
          id: 'scene1',
          description: 'Brief', // Too short
          // Missing 'objects' array
        },
        {
          // Missing 'id'
          description: 'Another scene',
          objects: 'not an array', // Wrong type
        },
      ],
      // Missing cinematography
    },
    metadata: {
      // Missing required fields like 'source', 'model'
      confidence: 150, // Invalid range (should be 0-1)
      quality: 'invalid_quality', // Invalid enum value
      tokens: {
        input: 100,
        output: 200,
        total: 250, // Incorrect calculation
      },
    },
  };

  console.log('Original malformed content:');
  console.log(JSON.stringify(malformedContent, null, 2));
  console.log('\n');

  try {
    // Step 1: Validate the content to identify issues
    console.log('🔍 Step 1: Validating content...');
    const validation = await validationPipeline.validateResponse(
      malformedContent
    );

    console.log(
      `Validation result: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`
    );
    console.log(`Errors found: ${validation.errors.length}`);
    console.log(`Warnings: ${validation.warnings.length}`);

    if (validation.errors.length > 0) {
      console.log('\nValidation errors:');
      validation.errors.forEach((error, index) => {
        console.log(
          `  ${index + 1}. ${error.field || 'unknown'}: ${error.message}`
        );
      });
    }
    console.log('\n');

    // Step 2: Attempt automatic repair
    console.log('🔧 Step 2: Attempting automatic repair...');
    const repairResult = await contentRepair.repairContent(
      malformedContent,
      validation.errors
    );

    console.log(
      `Repair result: ${repairResult.success ? '✅ Success' : '❌ Failed'}`
    );
    console.log(`Strategies applied: ${repairResult.appliedStrategies.length}`);
    console.log(`Errors remaining: ${repairResult.remainingErrors.length}`);

    if (repairResult.appliedStrategies.length > 0) {
      console.log('\nRepair strategies applied:');
      repairResult.appliedStrategies.forEach((strategy, index) => {
        console.log(
          `  ${index + 1}. ${strategy.strategy}: Fixed ${
            strategy.errorsFixed
          } errors`
        );
      });
    }
    console.log('\n');

    // Step 3: Validate repaired content
    if (repairResult.success && repairResult.repairedContent) {
      console.log('🔍 Step 3: Validating repaired content...');
      const revalidation = await validationPipeline.validateResponse(
        repairResult.repairedContent
      );

      console.log(
        `Revalidation result: ${
          revalidation.valid ? '✅ Valid' : '❌ Still invalid'
        }`
      );
      console.log(`Remaining errors: ${revalidation.errors.length}`);

      if (revalidation.valid) {
        console.log('\n✨ Content successfully repaired!');
        console.log('\nRepaired content:');
        console.log(JSON.stringify(repairResult.repairedContent, null, 2));
      } else {
        console.log('\n⚠️  Some issues remain after repair:');
        revalidation.errors.forEach((error, index) => {
          console.log(
            `  ${index + 1}. ${error.field || 'unknown'}: ${error.message}`
          );
        });
      }
    }
  } catch (error) {
    console.error('❌ Error during repair demonstration:', error.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Example 2: Retry strategy generation
  console.log('🔄 Example 2: Generating retry strategies');
  console.log('='.repeat(50));

  const contentWithErrors = {
    success: true,
    data: {
      id: 'test',
      title: 'Test Dream',
      description: 'A dream', // Too short
      scenes: [], // Empty scenes
    },
    metadata: {
      source: 'cerebras',
      model: 'llama-4',
      confidence: 0.3, // Low confidence
    },
  };

  const qualityErrors = [
    {
      type: 'content_quality',
      field: 'data.description',
      message: 'Description too short',
      severity: 'warning',
    },
    {
      type: 'completeness_error',
      field: 'data.scenes',
      message: 'No scenes provided',
      severity: 'error',
    },
  ];

  try {
    console.log('Generating retry strategy for quality issues...');
    const retryStrategy = await retryStrategies.executeRetryStrategy(
      qualityErrors,
      contentWithErrors,
      {
        provider: 'cerebras',
        model: 'llama-4-maverick-17b',
        temperature: 0.7,
        originalPrompt: 'I dreamed of a magical forest',
      }
    );

    console.log(
      `Strategy generated: ${
        retryStrategy.success ? '✅ Success' : '❌ Failed'
      }`
    );
    console.log(`Strategy type: ${retryStrategy.strategy}`);
    console.log(`Recommendations: ${retryStrategy.recommendations.length}`);

    if (retryStrategy.retryPrompt) {
      console.log('\n📝 Generated retry prompt:');
      console.log('-'.repeat(40));
      console.log(retryStrategy.retryPrompt);
      console.log('-'.repeat(40));
    }

    if (retryStrategy.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      retryStrategy.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority}] ${rec.message}`);
      });
    }

    if (Object.keys(retryStrategy.retryOptions).length > 0) {
      console.log('\n⚙️  Retry options:');
      Object.entries(retryStrategy.retryOptions).forEach(([key, value]) => {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      });
    }
  } catch (error) {
    console.error(
      '❌ Error during retry strategy demonstration:',
      error.message
    );
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Example 3: Complete validation and repair pipeline
  console.log('🔄 Example 3: Complete validation and repair pipeline');
  console.log('='.repeat(50));

  const problematicContent = {
    data: {
      description: 'Dream',
      scenes: [{ description: 'Scene' }],
    },
    metadata: { confidence: 200 },
  };

  try {
    console.log('Running complete validation and repair pipeline...');
    const pipelineResult = await validationPipeline.validateAndRepair(
      problematicContent,
      'dreamResponse'
    );

    console.log(
      `Pipeline result: ${pipelineResult.success ? '✅ Success' : '❌ Failed'}`
    );
    console.log(
      `Initial validation: ${
        pipelineResult.validation.valid ? 'Valid' : 'Invalid'
      }`
    );
    console.log(`Repair attempted: ${pipelineResult.repair ? 'Yes' : 'No'}`);

    if (pipelineResult.repair) {
      console.log(
        `Repair successful: ${pipelineResult.repair.success ? 'Yes' : 'No'}`
      );
      console.log(
        `Strategies applied: ${pipelineResult.repair.appliedStrategies.length}`
      );
    }

    console.log('\n📊 Final content structure:');
    const finalContent = pipelineResult.finalContent;
    console.log(`- Has success field: ${finalContent.success !== undefined}`);
    console.log(`- Has data.id: ${finalContent.data?.id !== undefined}`);
    console.log(`- Has data.title: ${finalContent.data?.title !== undefined}`);
    console.log(
      `- Description length: ${finalContent.data?.description?.length || 0}`
    );
    console.log(
      `- Number of scenes: ${finalContent.data?.scenes?.length || 0}`
    );
    console.log(`- Has metadata: ${finalContent.metadata !== undefined}`);
    console.log(
      `- Confidence in range: ${
        finalContent.metadata?.confidence >= 0 &&
        finalContent.metadata?.confidence <= 1
      }`
    );
  } catch (error) {
    console.error('❌ Error during pipeline demonstration:', error.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Example 4: Metrics and performance
  console.log('📊 Example 4: System metrics');
  console.log('='.repeat(50));

  try {
    const comprehensiveMetrics = validationPipeline.getComprehensiveMetrics();

    console.log('Validation metrics:');
    console.log(
      `  Total validations: ${comprehensiveMetrics.validation.totalValidations}`
    );
    console.log(
      `  Success rate: ${comprehensiveMetrics.validation.successRate.toFixed(
        1
      )}%`
    );

    console.log('\nRepair metrics:');
    console.log(
      `  Total repair attempts: ${comprehensiveMetrics.repair.totalRepairAttempts}`
    );
    console.log(
      `  Repair success rate: ${comprehensiveMetrics.repair.successRate.toFixed(
        1
      )}%`
    );

    console.log('\nRetry metrics:');
    console.log(`  Total retries: ${comprehensiveMetrics.retry.totalRetries}`);
    console.log(
      `  Retry success rate: ${comprehensiveMetrics.retry.successRate.toFixed(
        1
      )}%`
    );

    if (Object.keys(comprehensiveMetrics.repair.repairsByStrategy).length > 0) {
      console.log('\nMost used repair strategies:');
      Object.entries(comprehensiveMetrics.repair.repairsByStrategy)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .forEach(([strategy, count]) => {
          console.log(`  ${strategy}: ${count} times`);
        });
    }
  } catch (error) {
    console.error('❌ Error getting metrics:', error.message);
  }

  console.log('\n🎉 Content repair demonstration completed!');
}

// Run the demonstration
if (require.main === module) {
  demonstrateContentRepair().catch(console.error);
}

module.exports = { demonstrateContentRepair };
