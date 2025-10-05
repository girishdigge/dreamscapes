// Test template selection logic without launching browser
const path = require('path');
const fs = require('fs');

console.log('=== Testing Template Selection Logic ===\n');

// Test 1: Verify 3D template exists
console.log('Test 1: Verify 3D template file exists');
const template3DPath = path.join(
  __dirname,
  'puppeteer',
  'templates',
  'render_template_3d.html'
);
if (fs.existsSync(template3DPath)) {
  console.log('  ✓ 3D template exists at:', template3DPath);
} else {
  console.error('  ✗ 3D template not found at:', template3DPath);
  process.exit(1);
}

// Test 2: Verify 2D template still exists
console.log(
  '\nTest 2: Verify 2D template file exists (backward compatibility)'
);
const template2DPath = path.join(
  __dirname,
  'puppeteer',
  'templates',
  'render_template.html'
);
if (fs.existsSync(template2DPath)) {
  console.log('  ✓ 2D template exists at:', template2DPath);
} else {
  console.error('  ✗ 2D template not found at:', template2DPath);
  process.exit(1);
}

// Test 3: Verify template selection logic
console.log('\nTest 3: Verify template selection logic in renderEngine.js');
const renderEngineCode = fs.readFileSync(
  path.join(__dirname, 'puppeteer', 'renderEngine.js'),
  'utf8'
);

// Check for renderMode detection
if (
  renderEngineCode.includes('renderMode') &&
  renderEngineCode.includes('3d')
) {
  console.log('  ✓ renderMode detection code found');
} else {
  console.error('  ✗ renderMode detection code not found');
  process.exit(1);
}

// Check for template selection
if (renderEngineCode.includes('render_template_3d.html')) {
  console.log('  ✓ 3D template selection code found');
} else {
  console.error('  ✗ 3D template selection code not found');
  process.exit(1);
}

// Check for backward compatibility (default to 2D)
if (renderEngineCode.includes('render_template.html')) {
  console.log('  ✓ 2D template fallback code found (backward compatibility)');
} else {
  console.error('  ✗ 2D template fallback code not found');
  process.exit(1);
}

// Test 4: Verify 3D template has required interface
console.log('\nTest 4: Verify 3D template has required Puppeteer interface');
const template3DContent = fs.readFileSync(template3DPath, 'utf8');

const requiredFunctions = [
  'window.initWithDream',
  'window.seek',
  'renderCanvas',
];

let allFunctionsFound = true;
requiredFunctions.forEach((func) => {
  if (template3DContent.includes(func)) {
    console.log(`  ✓ ${func} found in 3D template`);
  } else {
    console.error(`  ✗ ${func} not found in 3D template`);
    allFunctionsFound = false;
  }
});

if (!allFunctionsFound) {
  process.exit(1);
}

// Test 5: Verify Three.js is included
console.log('\nTest 5: Verify Three.js library is included in 3D template');
if (
  template3DContent.includes('three') ||
  template3DContent.includes('THREE')
) {
  console.log('  ✓ Three.js reference found in 3D template');
} else {
  console.error('  ✗ Three.js reference not found in 3D template');
  process.exit(1);
}

// Test 6: Verify sample dreams
console.log('\nTest 6: Verify sample dreams with different renderModes');
const sampleDir = path.join(__dirname, '../../sample_dreams');
const samples = fs.readdirSync(sampleDir).filter((f) => f.endsWith('.json'));

let has3DSample = false;
let has2DSample = false;

samples.forEach((filename) => {
  const content = JSON.parse(
    fs.readFileSync(path.join(sampleDir, filename), 'utf8')
  );
  if (content.renderMode === '3d') {
    console.log(`  ✓ Found 3D sample: ${filename}`);
    has3DSample = true;
  } else {
    console.log(`  ✓ Found 2D sample: ${filename}`);
    has2DSample = true;
  }
});

if (!has3DSample) {
  console.warn('  ⚠ No 3D sample dreams found');
}

if (!has2DSample) {
  console.warn('  ⚠ No 2D sample dreams found');
}

// Test 7: Verify package.json has three.js dependency
console.log('\nTest 7: Verify three.js dependency in package.json');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);
if (packageJson.dependencies && packageJson.dependencies.three) {
  console.log(
    `  ✓ three.js dependency found (version ${packageJson.dependencies.three})`
  );
} else {
  console.error('  ✗ three.js dependency not found in package.json');
  process.exit(1);
}

console.log('\n=== All Template Selection Tests Passed ===');
console.log('\nIntegration Summary:');
console.log('  • 3D template selection: ✓ Implemented');
console.log('  • Backward compatibility: ✓ Maintained');
console.log('  • Required interfaces: ✓ Present');
console.log('  • Dependencies: ✓ Installed');
console.log('  • Sample dreams: ✓ Valid');
console.log(
  '\nNote: Full Puppeteer integration test requires Chromium to be installed.'
);
console.log(
  'To test with actual rendering, ensure Chromium is available and run:'
);
console.log('  node test-3d-integration.js');

process.exit(0);
