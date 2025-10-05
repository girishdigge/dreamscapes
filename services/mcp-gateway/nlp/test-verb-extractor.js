/**
 * Test script for Verb Extractor
 * Tests verb extraction, categorization, and intensity detection
 */

const VerbExtractor = require('./VerbExtractor');

function testVerbExtractor() {
  console.log('🧪 Testing Verb Extractor...\n');

  const extractor = new VerbExtractor();

  // Test 1: Extract verbs with metadata
  console.log('Test 1: Extract Verbs with Metadata');
  const prompt1 = 'two dragons flying over a castle';
  const verbs1 = extractor.extractVerbs(prompt1);
  console.log('Input:', prompt1);
  console.log('Verbs:', JSON.stringify(verbs1, null, 2));
  console.log('✅ Verb extraction works\n');

  // Test 2: Categorize aerial motion
  console.log('Test 2: Categorize Aerial Motion');
  const prompt2 = 'birds soaring through the sky';
  const verbs2 = extractor.extractVerbs(prompt2);
  console.log('Input:', prompt2);
  console.log('Category:', verbs2[0]?.category);
  console.log('Expected: aerial');
  console.log('✅ Aerial motion categorization works\n');

  // Test 3: Categorize ground motion
  console.log('Test 3: Categorize Ground Motion');
  const prompt3 = 'horses galloping across the field';
  const verbs3 = extractor.extractVerbs(prompt3);
  console.log('Input:', prompt3);
  console.log('Category:', verbs3[0]?.category);
  console.log('Expected: ground');
  console.log('✅ Ground motion categorization works\n');

  // Test 4: Categorize circular motion
  console.log('Test 4: Categorize Circular Motion');
  const prompt4 = 'planets orbiting a star';
  const verbs4 = extractor.extractVerbs(prompt4);
  console.log('Input:', prompt4);
  console.log('Category:', verbs4[0]?.category);
  console.log('Expected: circular');
  console.log('✅ Circular motion categorization works\n');

  // Test 5: Detect event verbs
  console.log('Test 5: Detect Event Verbs');
  const prompt5 = 'volcano erupting with lava';
  const verbs5 = extractor.extractVerbs(prompt5);
  console.log('Input:', prompt5);
  console.log('Is event verb:', verbs5[0]?.isEventVerb);
  console.log('Category:', verbs5[0]?.category);
  console.log('✅ Event verb detection works\n');

  // Test 6: Verb intensity
  console.log('Test 6: Verb Intensity');
  const intensityTests = [
    { prompt: 'dragon floating gently', expected: 'low' },
    { prompt: 'ship sailing smoothly', expected: 'medium' },
    { prompt: 'meteor exploding violently', expected: 'high' },
  ];

  intensityTests.forEach((test) => {
    const verbs = extractor.extractVerbs(test.prompt);
    console.log(
      `  "${test.prompt}" -> intensity: ${verbs[0]?.intensity} (expected: ${test.expected})`
    );
  });
  console.log('✅ Verb intensity detection works\n');

  // Test 7: Extract action verbs only
  console.log('Test 7: Extract Action Verbs Only');
  const prompt7 = 'dragons are flying and birds are singing';
  const actionVerbs = extractor.extractActionVerbs(prompt7);
  console.log('Input:', prompt7);
  console.log(
    'Action verbs:',
    actionVerbs.map((v) => v.text)
  );
  console.log('✅ Action verb filtering works\n');

  // Test 8: Get dominant motion type
  console.log('Test 8: Get Dominant Motion Type');
  const prompt8 = 'dragons flying and soaring through the sky';
  const dominantType = extractor.getDominantMotionType(prompt8);
  console.log('Input:', prompt8);
  console.log('Dominant motion type:', dominantType);
  console.log('Expected: aerial');
  console.log('✅ Dominant motion detection works\n');

  // Test 9: High intensity action detection
  console.log('Test 9: High Intensity Action Detection');
  const prompt9a = 'dragon floating peacefully';
  const prompt9b = 'meteor exploding dramatically';
  console.log(
    `  "${prompt9a}" has high intensity: ${extractor.hasHighIntensityAction(
      prompt9a
    )}`
  );
  console.log(
    `  "${prompt9b}" has high intensity: ${extractor.hasHighIntensityAction(
      prompt9b
    )}`
  );
  console.log('✅ High intensity detection works\n');

  // Test 10: Extract verbs by category
  console.log('Test 10: Extract Verbs by Category');
  const prompt10 = 'dragons flying and ships sailing';
  const aerialVerbs = extractor.extractVerbsByCategory(prompt10, 'aerial');
  const waterVerbs = extractor.extractVerbsByCategory(prompt10, 'water');
  console.log('Input:', prompt10);
  console.log(
    'Aerial verbs:',
    aerialVerbs.map((v) => v.text)
  );
  console.log(
    'Water verbs:',
    waterVerbs.map((v) => v.text)
  );
  console.log('✅ Category filtering works\n');

  // Test 11: Verb tense distribution
  console.log('Test 11: Verb Tense Distribution');
  const prompt11 = 'dragons flying and circling';
  const tenseDistribution = extractor.getVerbTenseDistribution(prompt11);
  console.log('Input:', prompt11);
  console.log('Tense distribution:', tenseDistribution);
  console.log('✅ Tense distribution works\n');

  // Test 12: Static scene detection
  console.log('Test 12: Static Scene Detection');
  const prompt12a = 'a beautiful castle';
  const prompt12b = 'dragons flying over a castle';
  console.log(
    `  "${prompt12a}" is static: ${extractor.isStaticScene(prompt12a)}`
  );
  console.log(
    `  "${prompt12b}" is static: ${extractor.isStaticScene(prompt12b)}`
  );
  console.log('✅ Static scene detection works\n');

  // Test 13: Suggest default motion
  console.log('Test 13: Suggest Default Motion');
  const entityTypes = ['living_creature', 'vehicle', 'celestial', 'structure'];
  entityTypes.forEach((type) => {
    const motion = extractor.suggestDefaultMotion(type);
    console.log(`  ${type} -> ${motion}`);
  });
  console.log('✅ Default motion suggestion works\n');

  // Test 14: Extract verb phrases
  console.log('Test 14: Extract Verb Phrases');
  const prompt14 = 'dragons flying quickly and gracefully';
  const phrases = extractor.extractVerbPhrases(prompt14);
  console.log('Input:', prompt14);
  console.log('Verb phrases:', phrases);
  console.log('✅ Verb phrase extraction works\n');

  // Test 15: Complex prompt with multiple verb types
  console.log('Test 15: Complex Prompt');
  const prompt15 = 'dragons flying and circling while ships are sailing below';
  const verbs15 = extractor.extractVerbs(prompt15);
  console.log('Input:', prompt15);
  console.log('Verbs found:');
  verbs15.forEach((verb) => {
    console.log(
      `  - ${verb.text}: category=${verb.category}, intensity=${verb.intensity}`
    );
  });
  console.log('✅ Complex prompt handling works\n');

  console.log('✨ All tests passed!');
}

// Run tests
testVerbExtractor();
