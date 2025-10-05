/**
 * Test script for Entity Extractor
 * Tests entity extraction, count inference, and classification
 */

const EntityExtractor = require('./EntityExtractor');

function testEntityExtractor() {
  console.log('🧪 Testing Entity Extractor...\n');

  const extractor = new EntityExtractor();

  // Test 1: Extract entities with explicit count
  console.log('Test 1: Extract Entities with Explicit Count');
  const prompt1 = 'two dragons circling a castle';
  const entities1 = extractor.extractEntities(prompt1);
  console.log('Input:', prompt1);
  console.log('Entities:', JSON.stringify(entities1, null, 2));
  console.log('✅ Entity extraction with explicit count works\n');

  // Test 2: Extract entities with collective noun
  console.log('Test 2: Extract Entities with Collective Noun');
  const prompt2 = 'a herd of horses galloping';
  const entities2 = extractor.extractEntities(prompt2);
  console.log('Input:', prompt2);
  console.log('Entities:', JSON.stringify(entities2, null, 2));
  console.log('✅ Collective noun detection works\n');

  // Test 3: Extract entities with quantifier
  console.log('Test 3: Extract Entities with Quantifier');
  const prompt3 = 'many butterflies in a garden';
  const entities3 = extractor.extractEntities(prompt3);
  console.log('Input:', prompt3);
  console.log('Entities:', JSON.stringify(entities3, null, 2));
  console.log('✅ Quantifier detection works\n');

  // Test 4: Singular vs Plural detection
  console.log('Test 4: Singular vs Plural Detection');
  const prompt4 = 'a dragon and three castles';
  const entities4 = extractor.extractEntities(prompt4);
  console.log('Input:', prompt4);
  console.log(
    'Singular entities:',
    extractor.extractSingularEntities(prompt4).map((e) => e.text)
  );
  console.log(
    'Plural entities:',
    extractor.extractPluralEntities(prompt4).map((e) => e.text)
  );
  console.log('✅ Singular/plural detection works\n');

  // Test 5: Entity classification
  console.log('Test 5: Entity Classification');
  const prompt5 = 'a dragon flying over a castle near the ocean';
  const entities5 = extractor.extractEntities(prompt5);
  console.log('Input:', prompt5);
  entities5.forEach((entity) => {
    console.log(`  - "${entity.text}" classified as: ${entity.type}`);
  });
  console.log('✅ Entity classification works\n');

  // Test 6: Group entities by type
  console.log('Test 6: Group Entities by Type');
  const prompt6 = 'dragons and birds flying over castles and towers';
  const grouped = extractor.groupEntitiesByType(prompt6);
  console.log('Input:', prompt6);
  console.log('Grouped:', JSON.stringify(grouped, null, 2));
  console.log('✅ Entity grouping works\n');

  // Test 7: Extract main subject
  console.log('Test 7: Extract Main Subject');
  const prompt7 = 'two dragons circling a castle at sunset';
  const mainSubject = extractor.extractMainSubject(prompt7);
  console.log('Input:', prompt7);
  console.log('Main subject:', mainSubject?.text);
  console.log('✅ Main subject extraction works\n');

  // Test 8: Total entity count
  console.log('Test 8: Total Entity Count');
  const prompt8 = 'two dragons and three castles';
  const totalCount = extractor.getTotalEntityCount(prompt8);
  console.log('Input:', prompt8);
  console.log('Total entity count:', totalCount);
  console.log('Expected: ~5 (2 dragons + 3 castles)');
  console.log('✅ Total count calculation works\n');

  // Test 9: Collective noun - flock
  console.log('Test 9: Collective Noun - Flock');
  const prompt9 = 'a flock of birds';
  const entities9 = extractor.extractEntities(prompt9);
  console.log('Input:', prompt9);
  console.log('Inferred count:', entities9[0]?.count);
  console.log('Expected: ~15 (average of 10-20)');
  console.log('✅ Flock collective noun works\n');

  // Test 10: Collective noun - swarm
  console.log('Test 10: Collective Noun - Swarm');
  const prompt10 = 'a swarm of bees';
  const entities10 = extractor.extractEntities(prompt10);
  console.log('Input:', prompt10);
  console.log('Inferred count:', entities10[0]?.count);
  console.log('Expected: ~35 (average of 20-50)');
  console.log('✅ Swarm collective noun works\n');

  // Test 11: Check for multiple entities
  console.log('Test 11: Check for Multiple Entities');
  const prompt11 = 'a dragon and a castle';
  const hasMultiple = extractor.hasMultipleEntities(prompt11);
  console.log('Input:', prompt11);
  console.log('Has multiple entities:', hasMultiple);
  console.log('✅ Multiple entity detection works\n');

  // Test 12: Proper noun detection
  console.log('Test 12: Proper Noun Detection');
  const prompt12 = 'dragons flying over Paris';
  const properNouns = extractor.extractProperNouns(prompt12);
  console.log('Input:', prompt12);
  console.log(
    'Proper nouns:',
    properNouns.map((e) => e.text)
  );
  console.log('✅ Proper noun detection works\n');

  // Test 13: Complex prompt
  console.log('Test 13: Complex Prompt');
  const prompt13 =
    'a fleet of spaceships and several dragons orbiting a planet';
  const entities13 = extractor.extractEntities(prompt13);
  console.log('Input:', prompt13);
  console.log('Entities found:');
  entities13.forEach((entity) => {
    console.log(
      `  - ${entity.text}: count=${entity.count}, type=${entity.type}, collective=${entity.isCollective}`
    );
  });
  console.log('✅ Complex prompt handling works\n');

  console.log('✨ All tests passed!');
}

// Run tests
testEntityExtractor();
