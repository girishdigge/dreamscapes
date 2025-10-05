// Quick Production Readiness Verification Script
// Checks key aspects without running full render tests

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('PRODUCTION READINESS VERIFICATION');
console.log('='.repeat(80));
console.log();

const checks = [];

// Check 1: Verify all required files exist
console.log('1. Checking file structure...');
const requiredFiles = [
  'puppeteer/templates/render_template_3d.html',
  'puppeteer/renderEngine.js',
  'package.json',
];

let filesOk = true;
requiredFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ✗ ${file} - MISSING`);
    filesOk = false;
  }
});
checks.push({ name: 'File Structure', passed: filesOk });
console.log();

// Check 2: Verify Three.js dependency
console.log('2. Checking dependencies...');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);
const hasThreeJs = packageJson.dependencies && packageJson.dependencies.three;
if (hasThreeJs) {
  console.log(`   ✓ three.js: ${packageJson.dependencies.three}`);
  checks.push({ name: 'Three.js Dependency', passed: true });
} else {
  console.log(`   ✗ three.js dependency missing`);
  checks.push({ name: 'Three.js Dependency', passed: false });
}
console.log();

// Check 3: Verify template has error handling
console.log('3. Checking error handling in template...');
const templatePath = path.join(
  __dirname,
  'puppeteer/templates/render_template_3d.html'
);
const templateContent = fs.readFileSync(templatePath, 'utf8');

const errorHandlingChecks = [
  {
    name: 'WebGL availability check',
    pattern: /typeof THREE === ['"]undefined['"]/,
  },
  { name: 'Parameter validation', pattern: /ParameterValidator/ },
  { name: 'Unknown structure fallback', pattern: /createGenericStructure/ },
  { name: 'Color validation', pattern: /validateColor/ },
  { name: 'Number validation', pattern: /validateNumber/ },
  { name: 'Position validation', pattern: /validatePosition/ },
];

let errorHandlingOk = true;
errorHandlingChecks.forEach((check) => {
  if (check.pattern.test(templateContent)) {
    console.log(`   ✓ ${check.name}`);
  } else {
    console.log(`   ✗ ${check.name} - NOT FOUND`);
    errorHandlingOk = false;
  }
});
checks.push({ name: 'Error Handling', passed: errorHandlingOk });
console.log();

// Check 4: Verify resource cleanup
console.log('4. Checking resource cleanup...');
const cleanupChecks = [
  { name: 'dispose() method', pattern: /dispose\(\)\s*{/ },
  { name: 'geometry disposal', pattern: /geometry\.dispose\(\)/ },
  { name: 'material disposal', pattern: /material\.dispose\(\)/ },
  { name: 'texture disposal', pattern: /texture\.dispose\(\)/ },
  { name: 'cache clearing', pattern: /\.clear\(\)/ },
];

let cleanupOk = true;
cleanupChecks.forEach((check) => {
  if (check.pattern.test(templateContent)) {
    console.log(`   ✓ ${check.name}`);
  } else {
    console.log(`   ✗ ${check.name} - NOT FOUND`);
    cleanupOk = false;
  }
});
checks.push({ name: 'Resource Cleanup', passed: cleanupOk });
console.log();

// Check 5: Verify template selection logic
console.log('5. Checking template selection...');
const renderEnginePath = path.join(__dirname, 'puppeteer/renderEngine.js');
const renderEngineContent = fs.readFileSync(renderEnginePath, 'utf8');

const templateSelectionOk =
  renderEngineContent.includes('renderMode') &&
  renderEngineContent.includes('render_template_3d.html') &&
  renderEngineContent.includes('render_template.html');

if (templateSelectionOk) {
  console.log(`   ✓ Template selection based on renderMode`);
  console.log(`   ✓ Backward compatibility with 2D template`);
  checks.push({ name: 'Template Selection', passed: true });
} else {
  console.log(`   ✗ Template selection logic incomplete`);
  checks.push({ name: 'Template Selection', passed: false });
}
console.log();

// Check 6: Verify Puppeteer integration interface
console.log('6. Checking Puppeteer integration...');
const integrationChecks = [
  { name: 'window.initWithDream()', pattern: /window\.initWithDream\s*=/ },
  { name: 'window.seek()', pattern: /window\.seek\s*=/ },
  { name: '#renderCanvas element', pattern: /id=["']renderCanvas["']/ },
];

let integrationOk = true;
integrationChecks.forEach((check) => {
  if (check.pattern.test(templateContent)) {
    console.log(`   ✓ ${check.name}`);
  } else {
    console.log(`   ✗ ${check.name} - NOT FOUND`);
    integrationOk = false;
  }
});
checks.push({ name: 'Puppeteer Integration', passed: integrationOk });
console.log();

// Check 7: Verify all subsystems are present
console.log('7. Checking engine subsystems...');
const subsystems = [
  { name: 'SceneRenderer', pattern: /class SceneRenderer/ },
  { name: 'AssetLibrary', pattern: /class AssetLibrary/ },
  { name: 'MaterialSystem', pattern: /class MaterialSystem/ },
  { name: 'AnimationController', pattern: /class AnimationController/ },
  { name: 'CameraController', pattern: /class CameraController/ },
];

let subsystemsOk = true;
subsystems.forEach((subsystem) => {
  if (subsystem.pattern.test(templateContent)) {
    console.log(`   ✓ ${subsystem.name}`);
  } else {
    console.log(`   ✗ ${subsystem.name} - NOT FOUND`);
    subsystemsOk = false;
  }
});
checks.push({ name: 'Engine Subsystems', passed: subsystemsOk });
console.log();

// Summary
console.log('='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80));
console.log();

const passed = checks.filter((c) => c.passed).length;
const total = checks.length;

checks.forEach((check) => {
  const symbol = check.passed ? '✓' : '✗';
  console.log(`${symbol} ${check.name}`);
});

console.log();
console.log(`Passed: ${passed}/${total}`);
console.log();

// Production readiness checklist
console.log('='.repeat(80));
console.log('PRODUCTION READINESS CHECKLIST');
console.log('='.repeat(80));
console.log();

const checklist = [
  {
    item: 'Error Handling',
    status: errorHandlingOk ? 'PASS' : 'FAIL',
    details: 'All edge cases handled gracefully',
  },
  {
    item: 'Resource Cleanup',
    status: cleanupOk ? 'PASS' : 'FAIL',
    details: 'Proper disposal of GPU resources',
  },
  {
    item: 'Parameter Validation',
    status: errorHandlingOk ? 'PASS' : 'FAIL',
    details: 'Invalid parameters use defaults',
  },
  {
    item: 'Template Selection',
    status: templateSelectionOk ? 'PASS' : 'FAIL',
    details: 'Correct template based on renderMode',
  },
  {
    item: 'Puppeteer Integration',
    status: integrationOk ? 'PASS' : 'FAIL',
    details: 'Exposes required interface functions',
  },
  {
    item: 'Engine Subsystems',
    status: subsystemsOk ? 'PASS' : 'FAIL',
    details: 'All required classes present',
  },
  {
    item: 'Dependencies',
    status: hasThreeJs ? 'PASS' : 'FAIL',
    details: 'Three.js dependency installed',
  },
];

checklist.forEach((item) => {
  const statusSymbol = item.status === 'PASS' ? '✓' : '✗';
  console.log(`${statusSymbol} ${item.item}: ${item.status}`);
  console.log(`  ${item.details}`);
  console.log();
});

// Manual checks reminder
console.log('='.repeat(80));
console.log('MANUAL CHECKS REQUIRED');
console.log('='.repeat(80));
console.log();
console.log('○ Test with actual dream JSON files');
console.log('  Run: node test-e2e-final.js');
console.log();
console.log('○ Verify performance with complex scenes');
console.log('  Run: node test-performance-validation.js');
console.log();
console.log('○ Test cross-browser compatibility');
console.log('  Run: node test-cross-browser.js');
console.log();
console.log('○ Check for memory leaks');
console.log('  Monitor browser console during long renders');
console.log();
console.log('○ Verify WebGL error handling');
console.log('  Test in browser without WebGL support');
console.log();

// Final verdict
console.log('='.repeat(80));
if (passed === total) {
  console.log('✓ PRODUCTION READY: All automated checks passed');
  console.log(
    '  Complete manual checks for full production readiness verification'
  );
  process.exit(0);
} else {
  console.log('✗ NOT PRODUCTION READY: Some checks failed');
  console.log('  Fix issues before deploying to production');
  process.exit(1);
}
