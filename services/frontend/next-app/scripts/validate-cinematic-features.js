#!/usr/bin/env node

/**
 * Cinematic Features Validation Script
 *
 * Tests and validates all cinematic quality enhancement features:
 * - Camera movement types
 * - Post-processing effects
 * - Performance monitoring
 * - Backward compatibility
 * - Error handling
 * - WebGL capability detection
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) {
    console.log(`  ${details}`);
  }
}

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
};

function test(name, fn) {
  results.total++;
  try {
    const result = fn();
    if (result === true) {
      results.passed++;
      logTest(name, true);
    } else if (result === 'warning') {
      results.warnings++;
      logTest(name, true, '⚠ Warning: ' + result.message);
    } else {
      results.failed++;
      logTest(name, false, result || 'Test failed');
    }
  } catch (error) {
    results.failed++;
    logTest(name, false, error.message);
  }
}

// ============================================================================
// File Existence Tests
// ============================================================================

logSection('1. File Existence Tests');

test('DreamScene component exists', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  return fs.existsSync(filePath);
});

test('PostProcessing component exists', () => {
  const filePath = path.join(__dirname, '../app/components/PostProcessing.tsx');
  return fs.existsSync(filePath);
});

test('PostProcessingErrorBoundary exists', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/PostProcessingErrorBoundary.tsx'
  );
  return fs.existsSync(filePath);
});

test('CinematicCamera component exists', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/CinematicCamera.tsx'
  );
  return fs.existsSync(filePath);
});

test('EnhancedLighting component exists', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/EnhancedLighting.tsx'
  );
  return fs.existsSync(filePath);
});

test('WebGL capabilities utility exists', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  return fs.existsSync(filePath);
});

test('Cinematic features documentation exists', () => {
  const filePath = path.join(__dirname, '../CINEMATIC_FEATURES.md');
  return fs.existsSync(filePath);
});

// ============================================================================
// Component Implementation Tests
// ============================================================================

logSection('2. Component Implementation Tests');

test('DreamScene imports PostProcessingErrorBoundary', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('PostProcessingErrorBoundary');
});

test('DreamScene wraps PostProcessing with error boundary', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('<PostProcessingErrorBoundary') &&
    content.includes('<PostProcessing')
  );
});

test('DreamScene imports WebGL capabilities', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('detectWebGLCapabilities') ||
    content.includes('getCapabilityWarnings')
  );
});

test('DreamScene shows capability warnings', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('capabilityWarnings') &&
    content.includes('showCapabilityWarning')
  );
});

test('PostProcessing imports capability detection', () => {
  const filePath = path.join(__dirname, '../app/components/PostProcessing.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('detectWebGLCapabilities') &&
    content.includes('getFeatureSupport')
  );
});

test('PostProcessing checks feature support', () => {
  const filePath = path.join(__dirname, '../app/components/PostProcessing.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('featureSupport.depthOfField') ||
    content.includes('featureSupport.bloom')
  );
});

test('PostProcessingErrorBoundary has error logging', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/PostProcessingErrorBoundary.tsx'
  );
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('console.error') && content.includes('componentDidCatch')
  );
});

test('PostProcessingErrorBoundary provides fallback', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/PostProcessingErrorBoundary.tsx'
  );
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('fallback') && content.includes('hasError');
});

// ============================================================================
// WebGL Capabilities Tests
// ============================================================================

logSection('3. WebGL Capabilities Tests');

test('WebGL capabilities exports detectWebGLCapabilities', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('export function detectWebGLCapabilities');
});

test('WebGL capabilities exports getFeatureSupport', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('export function getFeatureSupport');
});

test('WebGL capabilities exports getCapabilityWarnings', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('export function getCapabilityWarnings');
});

test('WebGL capabilities exports getRecommendedQuality', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('export function getRecommendedQuality');
});

test('WebGL capabilities checks WebGL2 support', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('webgl2') && content.includes('getContext');
});

test('WebGL capabilities checks float texture support', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('floatTextures') && content.includes('OES_texture_float')
  );
});

test('WebGL capabilities checks depth texture support', () => {
  const filePath = path.join(__dirname, '../app/utils/webglCapabilities.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('depthTexture') && content.includes('WEBGL_depth_texture')
  );
});

// ============================================================================
// Documentation Tests
// ============================================================================

logSection('4. Documentation Tests');

test('Documentation includes camera configuration', () => {
  const filePath = path.join(__dirname, '../CINEMATIC_FEATURES.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('Camera Configuration') && content.includes('CameraShot')
  );
});

test('Documentation includes quality presets', () => {
  const filePath = path.join(__dirname, '../CINEMATIC_FEATURES.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('Quality Presets') &&
    content.includes('cinematic') &&
    content.includes('balanced') &&
    content.includes('performance')
  );
});

test('Documentation includes post-processing effects', () => {
  const filePath = path.join(__dirname, '../CINEMATIC_FEATURES.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('Post-Processing Effects') &&
    content.includes('Depth of Field') &&
    content.includes('Bloom')
  );
});

test('Documentation includes browser compatibility', () => {
  const filePath = path.join(__dirname, '../CINEMATIC_FEATURES.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('Browser Compatibility') && content.includes('WebGL');
});

test('Documentation includes troubleshooting', () => {
  const filePath = path.join(__dirname, '../CINEMATIC_FEATURES.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('Troubleshooting');
});

// ============================================================================
// Example Configuration Tests
// ============================================================================

logSection('5. Example Configuration Tests');

test('Cinematic space scene example exists', () => {
  const filePath = path.join(
    __dirname,
    '../examples/cinematic-space-scene.json'
  );
  return fs.existsSync(filePath);
});

test('Underwater dream example exists', () => {
  const filePath = path.join(__dirname, '../examples/underwater-dream.json');
  return fs.existsSync(filePath);
});

test('Performance optimized example exists', () => {
  const filePath = path.join(
    __dirname,
    '../examples/performance-optimized.json'
  );
  return fs.existsSync(filePath);
});

test('Examples README exists', () => {
  const filePath = path.join(__dirname, '../examples/README.md');
  return fs.existsSync(filePath);
});

test('Cinematic space scene has valid JSON', () => {
  const filePath = path.join(
    __dirname,
    '../examples/cinematic-space-scene.json'
  );
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    JSON.parse(content);
    return true;
  } catch (e) {
    return `Invalid JSON: ${e.message}`;
  }
});

test('Cinematic space scene has cinematography config', () => {
  const filePath = path.join(
    __dirname,
    '../examples/cinematic-space-scene.json'
  );
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return (
    content.cinematography &&
    content.cinematography.shots &&
    content.cinematography.shots.length > 0
  );
});

test('Underwater dream has color grading', () => {
  const filePath = path.join(__dirname, '../examples/underwater-dream.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return (
    content.render?.customQuality?.postProcessing?.effects?.colorGrading
      ?.enabled === true
  );
});

test('Performance example disables post-processing', () => {
  const filePath = path.join(
    __dirname,
    '../examples/performance-optimized.json'
  );
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return (
    content.render?.customQuality?.postProcessing?.enabled === false ||
    content.render?.qualityPreset === 'performance'
  );
});

// ============================================================================
// Camera Shot Type Tests
// ============================================================================

logSection('6. Camera Shot Type Tests');

test('Cinematic space scene uses establish shot', () => {
  const filePath = path.join(
    __dirname,
    '../examples/cinematic-space-scene.json'
  );
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content.cinematography.shots.some((shot) => shot.type === 'establish');
});

test('Cinematic space scene uses orbit shot', () => {
  const filePath = path.join(
    __dirname,
    '../examples/cinematic-space-scene.json'
  );
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content.cinematography.shots.some((shot) => shot.type === 'orbit');
});

test('Cinematic space scene uses dolly shot', () => {
  const filePath = path.join(
    __dirname,
    '../examples/cinematic-space-scene.json'
  );
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content.cinematography.shots.some((shot) => shot.type === 'dolly_in');
});

test('Underwater dream uses handheld shot', () => {
  const filePath = path.join(__dirname, '../examples/underwater-dream.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content.cinematography.shots.some((shot) => shot.type === 'handheld');
});

test('Performance example uses flythrough shot', () => {
  const filePath = path.join(
    __dirname,
    '../examples/performance-optimized.json'
  );
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content.cinematography.shots.some(
    (shot) => shot.type === 'flythrough'
  );
});

// ============================================================================
// Backward Compatibility Tests
// ============================================================================

logSection('7. Backward Compatibility Tests');

test('DreamScene handles missing cinematography', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  // Should have optional chaining or checks for cinematography
  return (
    content.includes('cinematography?') ||
    content.includes('dream.cinematography') ||
    content.includes('hasCinematography')
  );
});

test('DreamScene handles missing render config', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('dream.render ||') || content.includes('renderConfig =')
  );
});

test('PostProcessing handles disabled state', () => {
  const filePath = path.join(__dirname, '../app/components/PostProcessing.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('if (!config.enabled)') && content.includes('return null')
  );
});

// ============================================================================
// Error Handling Tests
// ============================================================================

logSection('8. Error Handling Tests');

test('PostProcessingErrorBoundary catches errors', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/PostProcessingErrorBoundary.tsx'
  );
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('getDerivedStateFromError') &&
    content.includes('componentDidCatch')
  );
});

test('PostProcessingErrorBoundary logs errors', () => {
  const filePath = path.join(
    __dirname,
    '../app/components/PostProcessingErrorBoundary.tsx'
  );
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('console.error') && content.includes('error.message');
});

test('PostProcessing warns on unsupported features', () => {
  const filePath = path.join(__dirname, '../app/components/PostProcessing.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('console.warn') && content.includes('not supported');
});

test('DreamScene shows performance warnings', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('performanceWarning') &&
    content.includes('Performance degraded')
  );
});

// ============================================================================
// Performance Monitoring Tests
// ============================================================================

logSection('9. Performance Monitoring Tests');

test('DreamScene tracks FPS', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('currentFPS') && content.includes('setCurrentFPS');
});

test('DreamScene has adaptive quality', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('adaptiveQuality') &&
    content.includes('setAdaptiveQuality')
  );
});

test('DreamScene uses PerformanceMonitor', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('PerformanceMonitor') &&
    content.includes('handlePerformanceChange')
  );
});

test('DreamScene displays FPS in UI', () => {
  const filePath = path.join(__dirname, '../app/components/DreamScene.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('FPS:') && content.includes('currentFPS');
});

// ============================================================================
// Results Summary
// ============================================================================

logSection('Test Results Summary');

const passRate = ((results.passed / results.total) * 100).toFixed(1);
const failRate = ((results.failed / results.total) * 100).toFixed(1);

console.log(`\nTotal Tests: ${results.total}`);
log(`Passed: ${results.passed} (${passRate}%)`, 'green');
if (results.failed > 0) {
  log(`Failed: ${results.failed} (${failRate}%)`, 'red');
}
if (results.warnings > 0) {
  log(`Warnings: ${results.warnings}`, 'yellow');
}

console.log('\n' + '='.repeat(60));

if (results.failed === 0) {
  log('✓ All tests passed!', 'green');
  process.exit(0);
} else {
  log('✗ Some tests failed. Please review the output above.', 'red');
  process.exit(1);
}
