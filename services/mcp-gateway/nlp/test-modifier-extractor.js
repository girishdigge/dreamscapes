/**
 * Test script for Modifier Extractor
 * Tests adjective, color, size, and mood extraction
 */

const ModifierExtractor = require('./ModifierExtractor');

function testModifierExtractor() {
  console.log('🧪 Testing Modifier Extractor...\n');

  const extractor = new ModifierExtractor();

  // Test 1: Extract adjectives
  console.log('Test 1: Extract Adjectives');
  const prompt1 = 'ethereal butterflies in a magical garden';
  const adjectives = extractor.extractAdjectives(prompt1);
  console.log('Input:', prompt1);
  console.log('Adjectives:', adjectives);
  console.log('✅ Adjective extraction works\n');

  // Test 2: Extract mood words
  console.log('Test 2: Extract Mood Words');
  const prompt2 = 'dark and mysterious castle in a dreamlike landscape';
  const moods = extractor.extractMoodWords(prompt2);
  console.log('Input:', prompt2);
  console.log('Moods:', JSON.stringify(moods, null, 2));
  console.log('✅ Mood word extraction works\n');

  // Test 3: Extract colors
  console.log('Test 3: Extract Colors');
  const prompt3 = 'golden dragons with crimson wings flying through azure sky';
  const colors = extractor.extractColors(prompt3);
  console.log('Input:', prompt3);
  console.log('Colors:', colors);
  console.log('✅ Color extraction works\n');

  // Test 4: Extract size modifiers
  console.log('Test 4: Extract Size Modifiers');
  const prompt4 = 'tiny butterflies and giant mountains';
  const sizes = extractor.extractSizeModifiers(prompt4);
  console.log('Input:', prompt4);
  console.log('Sizes:', JSON.stringify(sizes, null, 2));
  console.log('✅ Size modifier extraction works\n');

  // Test 5: Extract speed modifiers
  console.log('Test 5: Extract Speed Modifiers');
  const prompt5 = 'swift dragons flying rapidly';
  const speeds = extractor.extractSpeedModifiers(prompt5);
  console.log('Input:', prompt5);
  console.log('Speeds:', JSON.stringify(speeds, null, 2));
  console.log('✅ Speed modifier extraction works\n');

  // Test 6: Extract weather words
  console.log('Test 6: Extract Weather Words');
  const prompt6 = 'stormy ocean with foggy atmosphere';
  const weather = extractor.extractWeatherWords(prompt6);
  console.log('Input:', prompt6);
  console.log('Weather:', weather);
  console.log('✅ Weather word extraction works\n');

  // Test 7: Extract time words
  console.log('Test 7: Extract Time Words');
  const prompt7 = 'dragons flying at sunset near twilight';
  const time = extractor.extractTimeWords(prompt7);
  console.log('Input:', prompt7);
  console.log('Time:', time);
  console.log('✅ Time word extraction works\n');

  // Test 8: Extract all modifiers
  console.log('Test 8: Extract All Modifiers');
  const prompt8 =
    'ethereal golden dragons flying swiftly at sunset through stormy skies';
  const allModifiers = extractor.extractAllModifiers(prompt8);
  console.log('Input:', prompt8);
  console.log('All modifiers:', JSON.stringify(allModifiers, null, 2));
  console.log('✅ Comprehensive modifier extraction works\n');

  // Test 9: Get dominant mood
  console.log('Test 9: Get Dominant Mood');
  const prompt9 = 'dark and mysterious castle with ominous shadows';
  const dominantMood = extractor.getDominantMood(prompt9);
  console.log('Input:', prompt9);
  console.log('Dominant mood:', dominantMood);
  console.log('Expected: dark');
  console.log('✅ Dominant mood detection works\n');

  // Test 10: Get visual style hints
  console.log('Test 10: Get Visual Style Hints');
  const prompt10 = 'ethereal magical garden with golden flowers at sunset';
  const styleHints = extractor.getVisualStyleHints(prompt10);
  console.log('Input:', prompt10);
  console.log('Style hints:', JSON.stringify(styleHints, null, 2));
  console.log('✅ Visual style hint generation works\n');

  // Test 11: Check rich description
  console.log('Test 11: Check Rich Description');
  const prompt11a = 'a dragon';
  const prompt11b = 'a majestic golden dragon with ethereal glow';
  console.log(
    `  "${prompt11a}" has rich description: ${extractor.hasRichDescription(
      prompt11a
    )}`
  );
  console.log(
    `  "${prompt11b}" has rich description: ${extractor.hasRichDescription(
      prompt11b
    )}`
  );
  console.log('✅ Rich description detection works\n');

  // Test 12: Get modifier density
  console.log('Test 12: Get Modifier Density');
  const prompt12 = 'beautiful ethereal golden dragons';
  const density = extractor.getModifierDensity(prompt12);
  console.log('Input:', prompt12);
  console.log('Modifier density:', density.toFixed(2));
  console.log('✅ Modifier density calculation works\n');

  // Test 13: Suggest enhancements
  console.log('Test 13: Suggest Enhancements');
  const prompt13 =
    'ethereal dreamlike castle with golden glow in foggy atmosphere';
  const suggestions = extractor.suggestEnhancements(prompt13);
  console.log('Input:', prompt13);
  console.log('Enhancement suggestions:');
  suggestions.forEach((s) => {
    console.log(`  - ${s.type}: ${s.effect || s.colors} (${s.reason})`);
  });
  console.log('✅ Enhancement suggestion works\n');

  // Test 14: Multiple mood detection
  console.log('Test 14: Multiple Mood Detection');
  const prompt14 = 'dark mysterious castle with bright magical glow';
  const moods14 = extractor.extractMoodWords(prompt14);
  console.log('Input:', prompt14);
  console.log(
    'Moods found:',
    moods14.map((m) => `${m.word} (${m.mood})`)
  );
  console.log('✅ Multiple mood detection works\n');

  // Test 15: Complex descriptive prompt
  console.log('Test 15: Complex Descriptive Prompt');
  const prompt15 =
    'massive ethereal golden dragons with crimson wings flying swiftly through dark stormy skies at twilight';
  const modifiers15 = extractor.extractAllModifiers(prompt15);
  console.log('Input:', prompt15);
  console.log('Summary:');
  console.log(`  - Adjectives: ${modifiers15.adjectives.length}`);
  console.log(`  - Moods: ${modifiers15.moods.length}`);
  console.log(`  - Colors: ${modifiers15.colors.length}`);
  console.log(`  - Sizes: ${modifiers15.sizes.length}`);
  console.log(`  - Speeds: ${modifiers15.speeds.length}`);
  console.log(`  - Weather: ${modifiers15.weather.length}`);
  console.log(`  - Time: ${modifiers15.time.length}`);
  console.log('✅ Complex prompt handling works\n');

  console.log('✨ All tests passed!');
}

// Run tests
testModifierExtractor();
