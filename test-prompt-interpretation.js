#!/usr/bin/env node
/**
 * Test script to verify prompt interpretation improvements
 * Tests quantity extraction and action-aware cinematography
 */

const CerebrasService = require('./services/mcp-gateway/services/cerebrasService');

// Mock API key for testing
const cerebrasService = new CerebrasService({
  apiKey: 'test-key-for-verification',
});

async function testPromptInterpretation() {
  console.log('🧪 Testing Prompt Interpretation Improvements\n');
  console.log('='.repeat(60));

  const testCases = [
    {
      name: 'Two Stars Orbiting',
      prompt: 'two stars orbiting each other',
      style: 'surreal',
      expectedStructures: 2,
      expectedAction: 'orbit',
    },
    {
      name: 'Three Stars Colliding',
      prompt: 'three stars colliding creating explosion',
      style: 'cyberpunk',
      expectedStructures: 3,
      expectedAction: 'close_up',
    },
    {
      name: 'Five Crystals Flying',
      prompt: 'five crystals flying through space',
      style: 'ethereal',
      expectedStructures: 5,
      expectedAction: 'flythrough',
    },
    {
      name: 'Single Tower',
      prompt: 'a mysterious tower in the void',
      style: 'nightmare',
      expectedStructures: 1,
      expectedAction: 'establish',
    },
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log('-'.repeat(60));
    console.log(`Prompt: "${testCase.prompt}"`);
    console.log(`Style: ${testCase.style}`);

    try {
      // Generate dream from prompt
      const dreamJson = await cerebrasService.generateDream(testCase.prompt, {
        style: testCase.style,
        duration: 30,
      });

      const dream = JSON.parse(dreamJson);

      // Check structure count
      const structureCount = dream.structures.length;
      const structureMatch = structureCount === testCase.expectedStructures;

      console.log(
        `\n${
          structureMatch ? '✅' : '❌'
        } Structure Count: ${structureCount} (expected: ${
          testCase.expectedStructures
        })`
      );

      if (dream.structures.length > 0) {
        console.log('   Structures:');
        dream.structures.forEach((s, i) => {
          console.log(
            `   - ${s.id}: ${s.type} at [${s.pos
              .map((p) => p.toFixed(1))
              .join(', ')}]`
          );
        });
      }

      // Check cinematography
      const shotTypes = dream.cinematography.shots.map((s) => s.type);
      const hasExpectedAction = shotTypes.includes(testCase.expectedAction);

      console.log(
        `\n${hasExpectedAction ? '✅' : '❌'} Cinematography: ${shotTypes.join(
          ', '
        )}`
      );
      console.log(`   Expected action: ${testCase.expectedAction}`);

      if (dream.cinematography.shots.length > 0) {
        console.log('   Shots:');
        dream.cinematography.shots.forEach((shot, i) => {
          console.log(
            `   - ${shot.type} (${shot.duration}s) targeting ${shot.target}`
          );
        });
      }

      // Check entities
      if (dream.entities.length > 0) {
        console.log('\n📦 Entities:');
        dream.entities.forEach((e) => {
          console.log(`   - ${e.id}: ${e.type} (count: ${e.count})`);
        });
      }

      // Overall test result
      if (structureMatch && hasExpectedAction) {
        console.log('\n✅ TEST PASSED');
        passedTests++;
      } else {
        console.log('\n❌ TEST FAILED');
        failedTests++;
      }
    } catch (error) {
      console.error(`\n❌ TEST ERROR: ${error.message}`);
      failedTests++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(
    `Success Rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`
  );

  if (failedTests === 0) {
    console.log(
      '\n🎉 All tests passed! Prompt interpretation is working correctly.'
    );
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testPromptInterpretation().catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testPromptInterpretation };
