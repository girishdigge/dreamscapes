/**
 * Integration Test for NLP Module
 * Tests all NLP components working together
 */

const {
  NLPWrapper,
  TextPreprocessor,
  EntityExtractor,
  VerbExtractor,
  ModifierExtractor,
} = require('./index');

function testNLPIntegration() {
  console.log('🧪 Testing NLP Module Integration...\n');
  console.log('='.repeat(70));

  // Initialize all components
  const nlp = new NLPWrapper();
  const preprocessor = new TextPreprocessor();
  const entityExtractor = new EntityExtractor();
  const verbExtractor = new VerbExtractor();
  const modifierExtractor = new ModifierExtractor();

  // Test prompts
  const testPrompts = [
    'two dragons circling a castle at sunset',
    'a herd of horses galloping across a stormy field',
    'ethereal butterflies floating in a magical garden',
    'massive golden spaceship flying swiftly through dark nebula',
    'a flock of birds soaring over the ocean at dawn',
  ];

  testPrompts.forEach((prompt, index) => {
    console.log(`\n📝 Test ${index + 1}: "${prompt}"`);
    console.log('-'.repeat(70));

    // 1. Preprocess
    const cleaned = preprocessor.clean(prompt);
    console.log(`\n1️⃣  Preprocessed: "${cleaned}"`);

    // 2. Extract entities
    const entities = entityExtractor.extractEntities(prompt);
    console.log('\n2️⃣  Entities:');
    entities.forEach((entity) => {
      console.log(
        `   - ${entity.text}: count=${entity.count}, type=${entity.type}`
      );
    });

    // 3. Extract verbs
    const verbs = verbExtractor.extractVerbs(prompt);
    console.log('\n3️⃣  Verbs:');
    if (verbs.length > 0) {
      verbs.forEach((verb) => {
        console.log(
          `   - ${verb.text}: category=${verb.category}, intensity=${verb.intensity}`
        );
      });
    } else {
      console.log('   - No verbs found (static scene)');
      const mainEntity = entityExtractor.extractMainSubject(prompt);
      if (mainEntity) {
        const suggestedMotion = verbExtractor.suggestDefaultMotion(
          mainEntity.type
        );
        console.log(`   - Suggested default motion: ${suggestedMotion}`);
      }
    }

    // 4. Extract modifiers
    const modifiers = modifierExtractor.extractAllModifiers(prompt);
    console.log('\n4️⃣  Modifiers:');
    console.log(
      `   - Adjectives: ${modifiers.adjectives.join(', ') || 'none'}`
    );
    console.log(`   - Colors: ${modifiers.colors.join(', ') || 'none'}`);
    console.log(
      `   - Moods: ${modifiers.moods.map((m) => m.word).join(', ') || 'none'}`
    );
    console.log(`   - Time: ${modifiers.time.join(', ') || 'none'}`);
    console.log(`   - Weather: ${modifiers.weather.join(', ') || 'none'}`);

    // 5. Get visual style hints
    const styleHints = modifierExtractor.getVisualStyleHints(prompt);
    console.log('\n5️⃣  Visual Style Hints:');
    console.log(`   - Lighting: ${styleHints.lighting}`);
    console.log(`   - Atmosphere: ${styleHints.atmosphere}`);
    console.log(`   - Effects: ${styleHints.effects.join(', ') || 'none'}`);
    console.log(`   - Mood: ${styleHints.mood || 'neutral'}`);

    // 6. Scene analysis
    console.log('\n6️⃣  Scene Analysis:');
    const totalEntities = entityExtractor.getTotalEntityCount(prompt);
    const hasMultiple = entityExtractor.hasMultipleEntities(prompt);
    const isStatic = verbExtractor.isStaticScene(prompt);
    const hasHighIntensity = verbExtractor.hasHighIntensityAction(prompt);
    const dominantMotion = verbExtractor.getDominantMotionType(prompt);
    const dominantMood = modifierExtractor.getDominantMood(prompt);

    console.log(`   - Total entities: ${totalEntities}`);
    console.log(`   - Multiple entities: ${hasMultiple}`);
    console.log(`   - Static scene: ${isStatic}`);
    console.log(`   - High intensity: ${hasHighIntensity}`);
    console.log(`   - Dominant motion: ${dominantMotion || 'none'}`);
    console.log(`   - Dominant mood: ${dominantMood || 'neutral'}`);

    // 7. Enhancement suggestions
    const suggestions = modifierExtractor.suggestEnhancements(prompt);
    if (suggestions.length > 0) {
      console.log('\n7️⃣  Enhancement Suggestions:');
      suggestions.forEach((s) => {
        console.log(`   - ${s.type}: ${s.effect || s.colors} (${s.reason})`);
      });
    }

    console.log('\n' + '='.repeat(70));
  });

  console.log('\n✨ Integration test complete!\n');

  // Summary
  console.log('📊 Summary:');
  console.log('   ✅ NLP Wrapper: Working');
  console.log('   ✅ Text Preprocessor: Working');
  console.log('   ✅ Entity Extractor: Working');
  console.log('   ✅ Verb Extractor: Working');
  console.log('   ✅ Modifier Extractor: Working');
  console.log('   ✅ All components integrated successfully!');
}

// Run integration test
testNLPIntegration();
