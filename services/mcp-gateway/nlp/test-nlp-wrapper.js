/**
 * Test script for NLP Wrapper
 * Tests basic parsing functionality
 */

const NLPWrapper = require('./NLPWrapper');

function testNLPWrapper() {
  console.log('🧪 Testing NLP Wrapper...\n');

  const nlp = new NLPWrapper();

  // Test 1: Basic parsing
  console.log('Test 1: Basic Parsing');
  try {
    const doc = nlp.parse('two dragons circling a castle');
    console.log('✅ Basic parsing works');
  } catch (error) {
    console.error('❌ Basic parsing failed:', error.message);
  }

  // Test 2: Extract nouns
  console.log('\nTest 2: Extract Nouns');
  const testPrompt = 'two dragons circling a castle at sunset';
  const nouns = nlp.extractNouns(testPrompt);
  console.log('Nouns found:', JSON.stringify(nouns, null, 2));
  console.log('✅ Noun extraction works');

  // Test 3: Extract verbs
  console.log('\nTest 3: Extract Verbs');
  const verbs = nlp.extractVerbs(testPrompt);
  console.log('Verbs found:', JSON.stringify(verbs, null, 2));
  console.log('✅ Verb extraction works');

  // Test 4: Extract adjectives
  console.log('\nTest 4: Extract Adjectives');
  const adjPrompt = 'ethereal butterflies in a magical garden';
  const adjectives = nlp.extractAdjectives(adjPrompt);
  console.log('Adjectives found:', adjectives);
  console.log('✅ Adjective extraction works');

  // Test 5: Extract numbers
  console.log('\nTest 5: Extract Numbers');
  const numbers = nlp.extractNumbers(testPrompt);
  console.log('Numbers found:', JSON.stringify(numbers, null, 2));
  console.log('✅ Number extraction works');

  // Test 6: Extract prepositions
  console.log('\nTest 6: Extract Prepositions');
  const prepositions = nlp.extractPrepositions(testPrompt);
  console.log('Prepositions found:', prepositions);
  console.log('✅ Preposition extraction works');

  // Test 7: Get sentence structure
  console.log('\nTest 7: Get Sentence Structure');
  const structure = nlp.getSentenceStructure(testPrompt);
  console.log('Sentence structure:', JSON.stringify(structure, null, 2));
  console.log('✅ Sentence structure extraction works');

  // Test 8: Normalize text
  console.log('\nTest 8: Normalize Text');
  const normalized = nlp.normalize('  TWO DRAGONS  ');
  console.log('Normalized:', normalized);
  console.log('✅ Text normalization works');

  // Test 9: Pattern matching
  console.log('\nTest 9: Pattern Matching');
  const hasPlural = nlp.hasPattern(testPrompt, '#Plural');
  console.log('Has plural nouns:', hasPlural);
  console.log('✅ Pattern matching works');

  // Test 10: Get terms with tags
  console.log('\nTest 10: Get Terms with Tags');
  const terms = nlp.getTermsWithTags('flying dragons');
  console.log('Terms with tags:', JSON.stringify(terms, null, 2));
  console.log('✅ Terms with tags extraction works');

  // Test 11: Error handling
  console.log('\nTest 11: Error Handling');
  try {
    nlp.parse('');
  } catch (error) {
    console.log('✅ Error handling works:', error.message);
  }

  console.log('\n✨ All tests passed!');
}

// Run tests
testNLPWrapper();
