#!/usr/bin/env node
/**
 * Test PromptAnalyzer directly to debug extraction issues
 */

const PromptAnalyzer = require('./services/mcp-gateway/services/PromptAnalyzer');

const analyzer = new PromptAnalyzer();

const testPrompts = [
  'two stars orbiting each other',
  'three stars colliding creating explosion',
  'five crystals flying through space',
  'a mysterious tower in the void',
];

console.log('🔍 Testing PromptAnalyzer\n');
console.log('='.repeat(60));

for (const prompt of testPrompts) {
  console.log(`\n📝 Prompt: "${prompt}"`);
  console.log('-'.repeat(60));

  const analysis = analyzer.analyze(prompt);

  console.log('Entities:', analysis.entities);
  console.log('Actions:', analysis.actions);
  console.log('Locations:', analysis.locations);
  console.log('Quantities:', analysis.quantities);
  console.log('Mood:', analysis.mood);
  console.log('Confidence:', analysis.confidence.toFixed(2));

  // Debug: Show word array
  const words = prompt.toLowerCase().split(/\s+/);
  console.log('\nDebug - Words:', words);

  // Check if "star" or "stars" is in words
  console.log('Has "star":', words.includes('star'));
  console.log('Has "stars":', words.includes('stars'));

  // Check if analyzer recognizes these words
  console.log('Is "star" an entity:', analyzer._isEntity('star'));
  console.log('Is "stars" an entity:', analyzer._isEntity('stars'));
}

console.log('\n' + '='.repeat(60));
