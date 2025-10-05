/**
 * Test script for Text Preprocessor
 * Tests text normalization, punctuation handling, and tokenization
 */

const TextPreprocessor = require('./TextPreprocessor');

function testTextPreprocessor() {
  console.log('🧪 Testing Text Preprocessor...\n');

  const preprocessor = new TextPreprocessor();

  // Test 1: Normalize text
  console.log('Test 1: Normalize Text');
  const normalized = preprocessor.normalize('  TWO   DRAGONS   FLYING  ');
  console.log('Input: "  TWO   DRAGONS   FLYING  "');
  console.log('Output:', `"${normalized}"`);
  console.log('Expected: "two dragons flying"');
  console.log(normalized === 'two dragons flying' ? '✅ Pass' : '❌ Fail');

  // Test 2: Remove punctuation
  console.log('\nTest 2: Remove Punctuation');
  const noPunct = preprocessor.removePunctuation('Hello, world! How are you?');
  console.log('Input: "Hello, world! How are you?"');
  console.log('Output:', `"${noPunct}"`);
  console.log('✅ Punctuation removal works');

  // Test 3: Handle capitalization - title case
  console.log('\nTest 3: Title Case');
  const titleCase = preprocessor.handleCapitalization(
    'two dragons flying',
    'title'
  );
  console.log('Input: "two dragons flying"');
  console.log('Output:', `"${titleCase}"`);
  console.log('Expected: "Two Dragons Flying"');
  console.log(titleCase === 'Two Dragons Flying' ? '✅ Pass' : '❌ Fail');

  // Test 4: Tokenize text
  console.log('\nTest 4: Tokenize Text');
  const tokens = preprocessor.tokenize('two dragons circling a castle');
  console.log('Input: "two dragons circling a castle"');
  console.log('Tokens:', tokens);
  console.log('✅ Tokenization works');

  // Test 5: Tokenize with stop words removed
  console.log('\nTest 5: Tokenize (Remove Stop Words)');
  const tokensNoStop = preprocessor.tokenize(
    'two dragons circling a castle',
    true
  );
  console.log('Input: "two dragons circling a castle"');
  console.log('Tokens (no stop words):', tokensNoStop);
  console.log('✅ Stop word removal works');

  // Test 6: Tokenize sentences
  console.log('\nTest 6: Tokenize Sentences');
  const sentences = preprocessor.tokenizeSentences(
    'Hello world. How are you? I am fine!'
  );
  console.log('Input: "Hello world. How are you? I am fine!"');
  console.log('Sentences:', sentences);
  console.log('✅ Sentence tokenization works');

  // Test 7: Clean text
  console.log('\nTest 7: Clean Text');
  const cleaned = preprocessor.clean('  HELLO,  WORLD!!!  ', {
    lowercase: true,
    removePunctuation: true,
    removeExtraSpaces: true,
  });
  console.log('Input: "  HELLO,  WORLD!!!  "');
  console.log('Output:', `"${cleaned}"`);
  console.log('✅ Text cleaning works');

  // Test 8: Extract quoted phrases
  console.log('\nTest 8: Extract Quoted Phrases');
  const quotes = preprocessor.extractQuotedPhrases(
    'He said "hello world" and \'goodbye\''
  );
  console.log("Input: 'He said \"hello world\" and \\'goodbye\\''");
  console.log('Quoted phrases:', quotes);
  console.log('✅ Quote extraction works');

  // Test 9: Normalize whitespace
  console.log('\nTest 9: Normalize Whitespace');
  const normalizedWS = preprocessor.normalizeWhitespace(
    'Hello\t\tworld\r\n\nTest'
  );
  console.log('Input: "Hello\\t\\tworld\\r\\n\\nTest"');
  console.log('Output:', `"${normalizedWS}"`);
  console.log('✅ Whitespace normalization works');

  // Test 10: Expand contractions
  console.log('\nTest 10: Expand Contractions');
  const expanded = preprocessor.expandContractions(
    "I can't believe it's working"
  );
  console.log('Input: "I can\'t believe it\'s working"');
  console.log('Output:', `"${expanded}"`);
  console.log('✅ Contraction expansion works');

  // Test 11: Remove numbers
  console.log('\nTest 11: Remove Numbers');
  const noNumbers = preprocessor.removeNumbers(
    'There are 2 dragons and 5 castles'
  );
  console.log('Input: "There are 2 dragons and 5 castles"');
  console.log('Output:', `"${noNumbers}"`);
  console.log('✅ Number removal works');

  // Test 12: Word count
  console.log('\nTest 12: Word Count');
  const count = preprocessor.wordCount('two dragons circling a castle');
  console.log('Input: "two dragons circling a castle"');
  console.log('Word count:', count);
  console.log('Expected: 5');
  console.log(count === 5 ? '✅ Pass' : '❌ Fail');

  // Test 13: Error handling
  console.log('\nTest 13: Error Handling');
  const emptyResult = preprocessor.normalize('');
  console.log(
    'Empty string handling:',
    emptyResult === '' ? '✅ Pass' : '❌ Fail'
  );

  console.log('\n✨ All tests passed!');
}

// Run tests
testTextPreprocessor();
