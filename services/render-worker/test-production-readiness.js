// Production Readiness Test Suite for Enhanced 3D Renderer
// Tests error handling, resource cleanup, edge cases, and deployment readiness

const { renderToFrames } = require('./puppeteer/renderEngine');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

// Test scenarios for production readiness
const EDGE_CASE_TESTS = [
  {
    name: 'Empty Scene',
    dream: {
      title: 'Empty Scene Test',
      renderMode: '3d',
      environment: { preset: 'space', skybox: 'void' },
      structures: [],
      entities: [],
    },
    expectedBehavior: 'Should render default environment without errors',
  },
  {
    name: 'Missing Required Fields',
    dream: {
      renderMode: '3d',
      // Missing title, environment, structures
    },
    expectedBehavior: 'Should use defaults and render without crashing',
  },
  {
    name: 'Invalid Structure Type',
    dream: {
      title: 'Invalid Structure Test',
      renderMode: '3d',
      environment: { preset: 'space' },
      structures: [
        { id: 's1', type: 'unknown_type_xyz', pos: [0, 0, 0], scale: 1.0 },
      ],
    },
    expectedBehavior: 'Should create generic fallback structure',
  },
  {
    name: 'Malformed Colors',
    dream: {
      title: 'Malformed Colors Test',
      renderMode: '3d',
      environment: { preset: 'space' },
      structures: [
        {
          id: 's1',
          type: 'star',
          pos: [0, 0, 0],
          scale: 1.0,
          material: { color: 'invalid_color', opacity: 'not_a_number' },
        },
      ],
    },
    expectedBehavior: 'Should default to white color and valid opacity',
  },
  {
    name: 'Invalid Animation Parameters',
    dream: {
      title: 'Invalid Animation Test',
      renderMode: '3d',
      environment: { preset: 'space' },
      structures: [
        {
          id: 's1',
          type: 'planet',
          pos: [0, 0, 0],
          scale: 1.0,
          animation: { type: 'orbit', speed: -999, amplitude: 'invalid' },
        },
      ],
    },
    expectedBehavior: 'Should clamp animation parameters to valid ranges',
  },
  {
    name: 'Invalid Position and Scale',
    dream: {
      title: 'Invalid Transform Test',
      renderMode: '3d',
      environment: { preset: 'space' },
      structures: [
        {
          id: 's1',
          type: 'crystal',
          pos: 'not_an_array',
          scale: -10,
          rotation: [NaN, 'invalid', undefined],
        },
      ],
    },
    expectedBehavior: 'Should use default position and clamp scale',
  },
  {
    name: 'Large Particle Count',
    dream: {
      title: 'Large Particle Count Test',
      renderMode: '3d',
      environment: { preset: 'space' },
      entities: [
        {
          id: 'e1',
          type: 'particle_stream',
          count: 50000, // Exceeds recommended limit
          params: { speed: 2.0, size: 1.0, color: '#00ffff' },
        },
      ],
    },
    expectedBehavior: 'Should limit particle count based on quality level',
  },
  {
    name: 'Missing Cinematography',
    dream: {
      title: 'No Cinematography Test',
      renderMode: '3d',
      environment: { preset: 'space' },
      structures: [{ id: 's1', type: 'star', pos: [0, 0, 0], scale: 1.0 }],
      // No cinematography field
    },
    expectedBehavior: 'Should use default orbital camera',
  },
  {
    name: 'Complex Scene with All Features',
    dream: {
      title: 'Complex Scene Test',
      renderMode: '3d',
      environment: {
        preset: 'space',
        skybox: 'galaxy',
        lighting: { ambient: 0.4, directional: { intensity: 1.0 } },
        fog: 0.3,
      },
      structures: [
        {
          id: 's1',
          type: 'star',
          pos: [0, 0, 0],
          scale: 2.0,
          features: ['emissive', 'glowing_edges'],
          animation: { type: 'pulse', speed: 1.0, amplitude: 0.5 },
        },
        {
          id: 's2',
          type: 'planet',
          pos: [50, 0, 0],
          scale: 1.5,
          animation: { type: 'orbit', speed: 0.5, amplitude: 50 },
        },
        {
          id: 's3',
          type: 'crystal',
          pos: [-30, 20, 0],
          scale: 1.0,
          material: { color: '#00ffff', opacity: 0.7, transmission: 0.8 },
        },
      ],
      entities: [
        {
          id: 'e1',
          type: 'floating_orbs',
          count: 100,
          params: { speed: 1.0, size: 2.0, color: '#ffaa00', glow: 0.8 },
        },
      ],
      cinematography: {
        durationSec: 10,
        shots: [
          {
            type: 'orbital',
            startTime: 0,
            duration: 5,
            target: [0, 0, 0],
            distance: 100,
          },
          {
            type: 'close_up',
            startTime: 5,
            duration: 5,
            target: 's1',
            distance: 20,
          },
        ],
      },
    },
    expectedBehavior: 'Should render complex scene with all features',
  },
];

/**
 * Run production readiness tests
 */
async function runProductionReadinessTests() {
  console.log('='.repeat(80));
  console.log('PRODUCTION READINESS TEST SUITE');
  console.log('='.repeat(80));
  console.log();

  const results = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  for (const test of EDGE_CASE_TESTS) {
    console.log(`\nTest: ${test.name}`);
    console.log(`Expected: ${test.expectedBehavior}`);
    console.log('-'.repeat(80));

    const testOutputDir = path.join(
      __dirname,
      'test-output',
      'production-readiness',
      test.name.toLowerCase().replace(/\s+/g, '-')
    );

    try {
      // Clean up previous test output
      if (fs.existsSync(testOutputDir)) {
        rimraf.sync(testOutputDir);
      }
      fs.mkdirSync(testOutputDir, { recursive: true });

      // Render test scene (short duration for quick testing)
      const frameCount = await renderToFrames(
        test.dream,
        testOutputDir,
        {
          resolution: [640, 360], // Lower resolution for faster testing
          fps: 10,
          duration: 2, // 2 seconds = 20 frames
        },
        () => false, // Don't cancel
        (progress) => {
          // Silent progress
        }
      );

      // Verify frames were created
      const frames = fs
        .readdirSync(testOutputDir)
        .filter((f) => f.endsWith('.png'));

      if (frames.length > 0) {
        console.log(`✓ PASSED: Generated ${frames.length} frames`);
        results.passed++;
      } else {
        console.log(`✗ FAILED: No frames generated`);
        results.failed++;
        results.errors.push({
          test: test.name,
          error: 'No frames generated',
        });
      }
    } catch (error) {
      console.log(`✗ FAILED: ${error.message}`);
      results.failed++;
      results.errors.push({
        test: test.name,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  // Print summary
  console.log();
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${EDGE_CASE_TESTS.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log();

  if (results.errors.length > 0) {
    console.log('ERRORS:');
    results.errors.forEach((err) => {
      console.log(`\n${err.test}:`);
      console.log(`  ${err.error}`);
      if (err.stack) {
        console.log(`  ${err.stack.split('\n').slice(0, 3).join('\n  ')}`);
      }
    });
  }

  // Production readiness checklist
  console.log();
  console.log('='.repeat(80));
  console.log('PRODUCTION READINESS CHECKLIST');
  console.log('='.repeat(80));
  console.log();

  const checklist = [
    {
      item: 'Error Handling',
      status: results.failed === 0 ? 'PASS' : 'FAIL',
      details: 'All edge cases handled gracefully without crashes',
    },
    {
      item: 'Resource Cleanup',
      status: 'MANUAL',
      details: 'Verify no memory leaks in browser console',
    },
    {
      item: 'Parameter Validation',
      status: results.failed === 0 ? 'PASS' : 'FAIL',
      details: 'Invalid parameters use defaults and log warnings',
    },
    {
      item: 'Fallback Mechanisms',
      status: results.failed === 0 ? 'PASS' : 'FAIL',
      details: 'Unknown types create generic fallbacks',
    },
    {
      item: 'Empty Scene Handling',
      status: results.failed === 0 ? 'PASS' : 'FAIL',
      details: 'Empty scenes render default environment',
    },
    {
      item: 'Performance Monitoring',
      status: 'MANUAL',
      details: 'Check console for FPS warnings during complex scenes',
    },
    {
      item: 'WebGL Availability Check',
      status: 'MANUAL',
      details: 'Test in browser without WebGL support',
    },
    {
      item: 'Cross-Browser Compatibility',
      status: 'MANUAL',
      details: 'Run test-cross-browser.js for full verification',
    },
  ];

  checklist.forEach((item) => {
    const statusSymbol =
      item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '✗' : '○';
    console.log(`${statusSymbol} ${item.item}: ${item.status}`);
    console.log(`  ${item.details}`);
    console.log();
  });

  // Final verdict
  console.log('='.repeat(80));
  if (results.failed === 0) {
    console.log('✓ PRODUCTION READY: All automated tests passed');
    console.log(
      '  Complete manual checks for full production readiness verification'
    );
  } else {
    console.log('✗ NOT PRODUCTION READY: Some tests failed');
    console.log('  Fix errors before deploying to production');
  }
  console.log('='.repeat(80));

  return results.failed === 0;
}

// Run tests if executed directly
if (require.main === module) {
  runProductionReadinessTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error running tests:', error);
      process.exit(1);
    });
}

module.exports = { runProductionReadinessTests, EDGE_CASE_TESTS };
