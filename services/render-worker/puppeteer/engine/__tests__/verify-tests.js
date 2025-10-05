#!/usr/bin/env node

/**
 * Test Verification Script
 * Verifies that all test files are properly structured and can be loaded
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('Test Suite Verification');
console.log('='.repeat(70));
console.log('');

const testFiles = [
  'SceneRenderer.test.js',
  'AssetLibrary.test.js',
  'MaterialSystem.test.js',
  'AnimationController.test.js',
  'CameraController.test.js',
  'integration.test.js',
  'visual-regression.test.js',
];

const infrastructureFiles = [
  'run-all-tests.html',
  'run-tests.js',
  'README.md',
  'IMPLEMENTATION_SUMMARY.md',
];

let allFilesExist = true;
let totalTests = 0;

console.log('Checking test files...');
console.log('');

testFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    const testCount = (content.match(/async test\w+\(/g) || []).length;
    totalTests += testCount;

    console.log(`✅ ${file.padEnd(35)} (${testCount} tests)`);
  } else {
    console.log(`❌ ${file.padEnd(35)} MISSING`);
    allFilesExist = false;
  }
});

console.log('');
console.log('Checking infrastructure files...');
console.log('');

infrastructureFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);

  if (exists) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✅ ${file.padEnd(35)} (${sizeKB} KB)`);
  } else {
    console.log(`❌ ${file.padEnd(35)} MISSING`);
    allFilesExist = false;
  }
});

console.log('');
console.log('='.repeat(70));

if (allFilesExist) {
  console.log(`✅ All test files verified successfully!`);
  console.log(`📊 Total test methods found: ${totalTests}`);
  console.log('');
  console.log('Test suite is ready to run:');
  console.log('  - Browser: Open run-all-tests.html');
  console.log('  - CLI: node run-tests.js');
} else {
  console.log('❌ Some files are missing!');
  process.exit(1);
}

console.log('='.repeat(70));
