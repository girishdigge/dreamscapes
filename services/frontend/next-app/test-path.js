const { join } = require('path');
const { existsSync } = require('fs');

console.log('Testing path resolution...\n');

// Simulate Next.js environment
const cwd = process.cwd();
console.log('Current working directory:', cwd);

// Try different path combinations
const paths = [
  join(cwd, 'sample_dreams', 'star_collision.json'),
  join(cwd, '..', '..', '..', 'sample_dreams', 'star_collision.json'),
  join(cwd, '..', '..', 'sample_dreams', 'star_collision.json'),
  join(cwd, '..', 'sample_dreams', 'star_collision.json'),
];

paths.forEach((path, index) => {
  const exists = existsSync(path);
  console.log(`\nPath ${index + 1}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  console.log(`  ${path}`);
});

// Find the correct path
const correctPath = paths.find((p) => existsSync(p));
if (correctPath) {
  console.log('\n✅ Correct path found!');
  console.log('Use this in route.ts:', correctPath);

  // Calculate the relative path
  const levels = correctPath.split('..').length - 1;
  console.log(`\nGo up ${levels} levels from process.cwd()`);
} else {
  console.log('\n❌ No valid path found. Check file locations.');
}
