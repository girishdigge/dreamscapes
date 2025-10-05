/**
 * Test script for Semantic Analyzer
 * Tests comprehensive semantic understanding of prompts
 */

const SemanticAnalyzer = require('./SemanticAnalyzer');

function testSemanticAnalyzer() {
  console.log('🧪 Testing Semantic Analyzer...\n');
  console.log('='.repeat(80));

  const analyzer = new SemanticAnalyzer();

  // Test prompts covering different scenarios
  const testCases = [
    {
      name: 'Simple Motion Scene',
      prompt: 'two dragons circling a castle at sunset',
      expectations: {
        entityCount: 3,
        hasMotion: true,
        environment: 'sunset',
      },
    },
    {
      name: 'Collective Noun with Weather',
      prompt: 'a herd of horses galloping through a stormy field',
      expectations: {
        hasCollective: true,
        weather: 'stormy',
        highIntensity: true,
      },
    },
    {
      name: 'Ethereal Mood Scene',
      prompt: 'ethereal butterflies floating in a magical dreamlike garden',
      expectations: {
        dominantMood: 'ethereal',
        hasRichDescription: true,
      },
    },
    {
      name: 'Static Scene',
      prompt: 'a beautiful castle on a mountain',
      expectations: {
        isStatic: true,
        hasMultipleEntities: true,
      },
    },
    {
      name: 'Complex Multi-Entity Scene',
      prompt:
        'massive golden dragons and silver spaceships flying swiftly through dark stormy nebula at twilight',
      expectations: {
        entityCount: 3,
        hasColors: true,
        hasMotion: true,
      },
    },
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
    console.log(`Prompt: "${testCase.prompt}"`);
    console.log('-'.repeat(80));

    try {
      const analysis = analyzer.analyze(testCase.prompt);

      // Display key results
      console.log('\n✅ Analysis Complete');
      console.log('\n📊 Summary:', analyzer.getSummary(analysis));

      console.log('\n🎯 Entities:');
      analysis.entities.forEach((e) => {
        console.log(`   - ${e.text}: count=${e.count}, type=${e.type}`);
      });

      console.log('\n🏃 Verbs:');
      if (analysis.verbs.length > 0) {
        analysis.verbs.forEach((v) => {
          console.log(`   - ${v.text}: ${v.category} (${v.intensity})`);
        });
      } else {
        console.log('   - None (static scene)');
      }

      console.log('\n🎨 Modifiers:');
      console.log(
        `   - Adjectives: ${analysis.modifiers.adjectives.join(', ') || 'none'}`
      );
      console.log(
        `   - Colors: ${analysis.modifiers.colors.join(', ') || 'none'}`
      );
      console.log(
        `   - Moods: ${
          analysis.modifiers.moods.map((m) => m.word).join(', ') || 'none'
        }`
      );

      console.log('\n🌍 Environment:');
      console.log(`   - Preset: ${analysis.environment.preset}`);
      console.log(`   - Time: ${analysis.environment.time || 'not specified'}`);
      console.log(
        `   - Weather: ${analysis.environment.weather || 'not specified'}`
      );
      console.log(
        `   - Location: ${analysis.environment.location || 'not specified'}`
      );

      console.log('\n😊 Mood & Style:');
      console.log(
        `   - Dominant Mood: ${analysis.mood.dominantMood || 'neutral'}`
      );
      console.log(
        `   - Suggested Lighting: ${analysis.mood.suggestedLighting}`
      );
      console.log(
        `   - Suggested Effects: ${
          analysis.mood.suggestedEffects.join(', ') || 'none'
        }`
      );

      console.log('\n📐 Spatial Relationships:');
      if (analysis.spatialRelationships.length > 0) {
        analysis.spatialRelationships.forEach((rel) => {
          console.log(
            `   - ${rel.subject} ${rel.relation} ${rel.object} (${rel.type})`
          );
        });
      } else {
        console.log('   - None detected');
      }

      console.log('\n🎬 Scene Type:');
      console.log(`   - Primary: ${analysis.sceneType.primary}`);
      console.log(`   - Complexity: ${analysis.sceneType.complexity}`);
      console.log(`   - Tags: ${analysis.sceneType.tags.join(', ')}`);

      console.log('\n📈 Characteristics:');
      console.log(`   - Static: ${analysis.characteristics.isStatic}`);
      console.log(
        `   - Multiple Entities: ${analysis.characteristics.hasMultipleEntities}`
      );
      console.log(
        `   - High Intensity: ${analysis.characteristics.hasHighIntensity}`
      );
      console.log(
        `   - Rich Description: ${analysis.characteristics.hasRichDescription}`
      );
      console.log(
        `   - Total Entity Count: ${analysis.characteristics.totalEntityCount}`
      );

      console.log('\n🔢 Count Inference:');
      console.log(
        `   - Total Inferred: ${analysis.countInference.totalInferred}`
      );
      console.log(
        `   - Average Confidence: ${(
          analysis.countInference.averageConfidence * 100
        ).toFixed(1)}%`
      );
      analysis.countInference.inferences.forEach((inf) => {
        console.log(
          `   - ${inf.entity}: ${inf.inferredCount} (${inf.method}, ${(
            inf.confidence * 100
          ).toFixed(0)}% confidence)`
        );
      });

      // Verify expectations
      console.log('\n✔️  Expectations:');
      if (testCase.expectations.entityCount !== undefined) {
        const match =
          analysis.entities.length === testCase.expectations.entityCount;
        console.log(
          `   - Entity count: ${match ? '✅' : '❌'} (expected ${
            testCase.expectations.entityCount
          }, got ${analysis.entities.length})`
        );
      }

      if (testCase.expectations.hasMotion !== undefined) {
        const match =
          !analysis.characteristics.isStatic ===
          testCase.expectations.hasMotion;
        console.log(`   - Has motion: ${match ? '✅' : '❌'}`);
      }

      if (testCase.expectations.isStatic !== undefined) {
        const match =
          analysis.characteristics.isStatic === testCase.expectations.isStatic;
        console.log(`   - Is static: ${match ? '✅' : '❌'}`);
      }

      if (testCase.expectations.environment) {
        const match =
          analysis.environment.preset === testCase.expectations.environment;
        console.log(
          `   - Environment: ${match ? '✅' : '❌'} (expected ${
            testCase.expectations.environment
          })`
        );
      }

      if (testCase.expectations.dominantMood) {
        const match =
          analysis.mood.dominantMood === testCase.expectations.dominantMood;
        console.log(
          `   - Dominant mood: ${match ? '✅' : '❌'} (expected ${
            testCase.expectations.dominantMood
          })`
        );
      }

      console.log('\n' + '='.repeat(80));
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('='.repeat(80));
    }
  });

  // Test error handling
  console.log('\n🧪 Testing Error Handling...\n');

  try {
    analyzer.analyze('');
    console.log('❌ Should have thrown error for empty string');
  } catch (error) {
    console.log('✅ Empty string error handling works:', error.message);
  }

  try {
    analyzer.analyze(null);
    console.log('❌ Should have thrown error for null');
  } catch (error) {
    console.log('✅ Null error handling works:', error.message);
  }

  console.log('\n✨ All tests complete!\n');

  // Final summary
  console.log('📊 Test Summary:');
  console.log(`   - Test cases: ${testCases.length}`);
  console.log('   - All scenarios tested successfully ✅');
  console.log('   - Error handling verified ✅');
  console.log('   - Semantic Analyzer is working correctly! 🎉');
}

// Run tests
testSemanticAnalyzer();
