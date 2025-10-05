// Performance Validation Test Suite for Enhanced 3D Renderer
// Benchmarks rendering performance, verifies FPS targets, and monitors memory usage

const { renderToFrames } = require('./puppeteer/renderEngine');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

// Performance test scenarios
const PERFORMANCE_SCENARIOS = [
  {
    name: 'Minimal Scene (10 objects)',
    objectCount: 10,
    particleCount: 50,
    targetFPS: 60,
    maxMemoryMB: 256,
  },
  {
    name: 'Small Scene (50 objects)',
    objectCount: 50,
    particleCount: 200,
    targetFPS: 45,
    maxMemoryMB: 384,
  },
  {
    name: 'Medium Scene (100 objects)',
    objectCount: 100,
    particleCount: 500,
    targetFPS: 30,
    maxMemoryMB: 512,
  },
  {
    name: 'Large Scene (500 objects)',
    objectCount: 500,
    particleCount: 1000,
    targetFPS: 30,
    maxMemoryMB: 768,
  },
  {
    name: 'Stress Test (1000 objects)',
    objectCount: 1000,
    particleCount: 2000,
    targetFPS: 20,
    maxMemoryMB: 1024,
  },
];

// Generate test dream with specified object count
function generatePerformanceTestDream(objectCount, particleCount) {
  const structures = [];
  const entities = [];

  // Add central star
  structures.push({
    id: 'central_star',
    type: 'star',
    pos: [0, 0, 0],
    scale: 5.0,
    material: { color: '#ffff00', emissiveIntensity: 1.0 },
  });

  // Add objects in a sphere distribution
  for (let i = 1; i < objectCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 20 + Math.random() * 80;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    const types = ['planet', 'crystal', 'tower', 'mountain'];
    const type = types[i % types.length];

    structures.push({
      id: `obj_${i}`,
      type,
      pos: [x, y, z],
      scale: 1.0 + Math.random() * 2.0,
      material: {
        color: `#${Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0')}`,
      },
      animation:
        Math.random() > 0.5
          ? {
              type: ['orbit', 'rotate', 'float', 'pulse'][
                Math.floor(Math.random() * 4)
              ],
              speed: 0.5 + Math.random(),
              amplitude: 5 + Math.random() * 10,
            }
          : undefined,
    });
  }

  // Add particle systems
  if (particleCount > 0) {
    entities.push({
      id: 'particles_1',
      type: 'floating_orbs',
      count: Math.floor(particleCount / 2),
      params: {
        speed: 1.0,
        size: 0.5,
        color: '#00ffff',
        glow: 0.8,
      },
    });

    entities.push({
      id: 'particles_2',
      type: 'particle_stream',
      count: Math.floor(particleCount / 2),
      params: {
        speed: 2.0,
        size: 0.3,
        color: '#ffffff',
        glow: 0.6,
      },
    });
  }

  return {
    title: `Performance Test - ${objectCount} objects`,
    renderMode: '3d',
    style: 'fantasy',
    environment: {
      preset: 'space',
      skybox: 'galaxy',
      lighting: {
        ambient: 0.4,
        directional: {
          intensity: 1.0,
          position: [100, 100, 50],
          color: '#ffffff',
        },
      },
      fog: 0.3,
    },
    structures,
    entities,
    cinematography: {
      durationSec: 3,
      shots: [
        {
          type: 'orbital',
          startTime: 0,
          duration: 3,
          target: [0, 0, 0],
          distance: 100,
          speed: 0.5,
        },
      ],
    },
  };
}

// Monitor memory usage
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: (usage.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (usage.heapTotal / 1024 / 1024).toFixed(2),
    externalMB: (usage.external / 1024 / 1024).toFixed(2),
    rssMB: (usage.rss / 1024 / 1024).toFixed(2),
  };
}

// Run performance benchmark
async function runPerformanceBenchmark(scenario, testDir) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Performance Test: ${scenario.name}`);
  console.log(
    `Objects: ${scenario.objectCount}, Particles: ${scenario.particleCount}`
  );
  console.log(
    `Target FPS: ${scenario.targetFPS}, Max Memory: ${scenario.maxMemoryMB}MB`
  );
  console.log(`${'='.repeat(70)}`);

  const scenarioName = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const framesDir = path.join(testDir, `frames-${scenarioName}`);

  // Clean up previous test
  if (fs.existsSync(framesDir)) {
    rimraf.sync(framesDir);
  }
  fs.mkdirSync(framesDir, { recursive: true });

  // Generate test dream
  const dream = generatePerformanceTestDream(
    scenario.objectCount,
    scenario.particleCount
  );

  // Record initial memory
  const memoryBefore = getMemoryUsage();
  console.log(
    `Memory before: ${memoryBefore.rssMB}MB RSS, ${memoryBefore.heapUsedMB}MB heap`
  );

  const startTime = Date.now();
  let peakMemory = 0;

  // Monitor memory during rendering
  const memoryMonitor = setInterval(() => {
    const current = parseFloat(getMemoryUsage().rssMB);
    if (current > peakMemory) {
      peakMemory = current;
    }
  }, 100);

  try {
    // Render frames
    console.log('Rendering...');
    const frameCount = await renderToFrames(
      dream,
      framesDir,
      {
        resolution: [1280, 720],
        fps: 30,
        duration: 3,
      },
      () => false,
      (progress) => {
        if (progress === 1.0) {
          console.log('  ✓ Rendering complete');
        }
      }
    );

    clearInterval(memoryMonitor);

    const renderTime = (Date.now() - startTime) / 1000;
    const memoryAfter = getMemoryUsage();

    // Calculate metrics
    const renderingFPS = frameCount / renderTime;
    const avgTimePerFrame = (renderTime / frameCount) * 1000; // ms
    const memoryIncrease =
      parseFloat(memoryAfter.rssMB) - parseFloat(memoryBefore.rssMB);

    console.log(`\nResults:`);
    console.log(`  Frames rendered: ${frameCount}`);
    console.log(`  Total time: ${renderTime.toFixed(2)}s`);
    console.log(`  Rendering FPS: ${renderingFPS.toFixed(2)} fps`);
    console.log(`  Avg time per frame: ${avgTimePerFrame.toFixed(2)}ms`);
    console.log(`  Peak memory: ${peakMemory.toFixed(2)}MB`);
    console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    console.log(
      `  Memory after: ${memoryAfter.rssMB}MB RSS, ${memoryAfter.heapUsedMB}MB heap`
    );

    // Verify performance targets
    const results = {
      scenario: scenario.name,
      objectCount: scenario.objectCount,
      particleCount: scenario.particleCount,
      frameCount,
      renderTime: parseFloat(renderTime.toFixed(2)),
      renderingFPS: parseFloat(renderingFPS.toFixed(2)),
      avgTimePerFrame: parseFloat(avgTimePerFrame.toFixed(2)),
      peakMemoryMB: parseFloat(peakMemory.toFixed(2)),
      memoryIncreaseMB: parseFloat(memoryIncrease.toFixed(2)),
      targetFPS: scenario.targetFPS,
      maxMemoryMB: scenario.maxMemoryMB,
      fpsTargetMet: renderingFPS >= scenario.targetFPS * 0.8, // Allow 20% tolerance
      memoryTargetMet: peakMemory <= scenario.maxMemoryMB,
      success: true,
    };

    // Print pass/fail
    console.log(`\nPerformance Targets:`);
    if (results.fpsTargetMet) {
      console.log(
        `  ✓ FPS target met (${renderingFPS.toFixed(2)} >= ${
          scenario.targetFPS * 0.8
        })`
      );
    } else {
      console.log(
        `  ✗ FPS target not met (${renderingFPS.toFixed(2)} < ${
          scenario.targetFPS * 0.8
        })`
      );
    }

    if (results.memoryTargetMet) {
      console.log(
        `  ✓ Memory target met (${peakMemory.toFixed(2)}MB <= ${
          scenario.maxMemoryMB
        }MB)`
      );
    } else {
      console.log(
        `  ✗ Memory target exceeded (${peakMemory.toFixed(2)}MB > ${
          scenario.maxMemoryMB
        }MB)`
      );
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('  ✓ Garbage collection triggered');
    }

    return results;
  } catch (error) {
    clearInterval(memoryMonitor);
    console.error(`✗ Benchmark failed: ${error.message}`);
    return {
      scenario: scenario.name,
      success: false,
      error: error.message,
    };
  }
}

// Analyze bottlenecks
function analyzeBottlenecks(results) {
  console.log(
    '\n\n╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Bottleneck Analysis                                               ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  const successful = results.filter((r) => r.success);

  if (successful.length === 0) {
    console.log('No successful benchmarks to analyze.');
    return;
  }

  // Analyze FPS degradation
  console.log('FPS Degradation by Object Count:');
  successful.forEach((r) => {
    const fpsPerObject = r.renderingFPS / r.objectCount;
    console.log(
      `  ${r.objectCount} objects: ${r.renderingFPS.toFixed(2)} fps (${(
        fpsPerObject * 1000
      ).toFixed(3)} fps per object)`
    );
  });

  // Analyze memory usage
  console.log('\nMemory Usage by Object Count:');
  successful.forEach((r) => {
    const memoryPerObject = r.peakMemoryMB / r.objectCount;
    console.log(
      `  ${r.objectCount} objects: ${r.peakMemoryMB.toFixed(
        2
      )}MB (${memoryPerObject.toFixed(3)}MB per object)`
    );
  });

  // Identify bottlenecks
  console.log('\nIdentified Bottlenecks:');

  const avgFPS =
    successful.reduce((sum, r) => sum + r.renderingFPS, 0) / successful.length;
  const slowTests = successful.filter((r) => r.renderingFPS < avgFPS * 0.7);

  if (slowTests.length > 0) {
    console.log('  ⚠ Slow rendering detected in:');
    slowTests.forEach((r) => {
      console.log(
        `    - ${r.scenario}: ${r.renderingFPS.toFixed(
          2
        )} fps (${r.avgTimePerFrame.toFixed(2)}ms per frame)`
      );
    });
  }

  const highMemoryTests = successful.filter(
    (r) => r.peakMemoryMB > r.maxMemoryMB * 0.9
  );
  if (highMemoryTests.length > 0) {
    console.log('  ⚠ High memory usage detected in:');
    highMemoryTests.forEach((r) => {
      console.log(
        `    - ${r.scenario}: ${r.peakMemoryMB.toFixed(2)}MB (${(
          (r.peakMemoryMB / r.maxMemoryMB) *
          100
        ).toFixed(1)}% of limit)`
      );
    });
  }

  // Optimization suggestions
  console.log('\nOptimization Suggestions:');

  if (slowTests.length > 0) {
    console.log(
      '  • Consider implementing Level of Detail (LOD) for distant objects'
    );
    console.log('  • Enable more aggressive frustum culling');
    console.log('  • Use instanced rendering for identical objects');
    console.log('  • Reduce particle counts in complex scenes');
  }

  if (highMemoryTests.length > 0) {
    console.log('  • Implement geometry caching more aggressively');
    console.log('  • Share materials between similar objects');
    console.log('  • Dispose of unused resources promptly');
    console.log('  • Consider streaming assets for very large scenes');
  }

  if (slowTests.length === 0 && highMemoryTests.length === 0) {
    console.log('  ✓ No significant bottlenecks detected!');
    console.log('  ✓ Performance is within acceptable ranges');
  }
}

// Main test runner
async function runPerformanceValidation() {
  console.log(
    '╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Enhanced 3D Renderer - Performance Validation Suite              ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  console.log(
    'This suite benchmarks rendering performance with varying scene complexity.'
  );
  console.log('It verifies FPS targets and memory usage limits are met.\n');

  const testDir = path.join(__dirname, 'test-output', 'performance');

  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    rimraf.sync(testDir);
  }
  fs.mkdirSync(testDir, { recursive: true });

  const results = [];

  // Run all performance scenarios
  for (const scenario of PERFORMANCE_SCENARIOS) {
    const result = await runPerformanceBenchmark(scenario, testDir);
    results.push(result);

    // Wait a bit between tests to allow memory cleanup
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log(
    '\n\n╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Performance Validation Summary                                    ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total Benchmarks: ${results.length}`);
  console.log(`✓ Completed: ${successful.length}`);
  console.log(`✗ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('Performance Results:');
    console.log(
      '┌─────────────────────────────┬──────────┬─────────┬──────────┬──────────┐'
    );
    console.log(
      '│ Scenario                    │ Objects  │ FPS     │ Memory   │ Status   │'
    );
    console.log(
      '├─────────────────────────────┼──────────┼─────────┼──────────┼──────────┤'
    );

    successful.forEach((r) => {
      const fpsStatus = r.fpsTargetMet ? '✓' : '✗';
      const memStatus = r.memoryTargetMet ? '✓' : '✗';
      const status = r.fpsTargetMet && r.memoryTargetMet ? '✓ PASS' : '✗ FAIL';

      const scenario = r.scenario.padEnd(27);
      const objects = String(r.objectCount).padStart(8);
      const fps = `${r.renderingFPS.toFixed(1)}`.padStart(7);
      const memory = `${r.peakMemoryMB.toFixed(0)}MB`.padStart(8);
      const statusStr = status.padStart(8);

      console.log(
        `│ ${scenario} │ ${objects} │ ${fps} │ ${memory} │ ${statusStr} │`
      );
    });

    console.log(
      '└─────────────────────────────┴──────────┴─────────┴──────────┴──────────┘'
    );
  }

  if (failed.length > 0) {
    console.log('\nFailed Benchmarks:');
    failed.forEach((r) => {
      console.log(`  ✗ ${r.scenario}: ${r.error}`);
    });
  }

  // Analyze bottlenecks
  if (successful.length > 0) {
    analyzeBottlenecks(successful);
  }

  // Save results to JSON
  const resultsPath = path.join(testDir, 'performance-results.json');
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results,
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          allTargetsMet: successful.every(
            (r) => r.fpsTargetMet && r.memoryTargetMet
          ),
        },
      },
      null,
      2
    )
  );

  console.log(`\n\nResults saved to: ${resultsPath}`);
  console.log(`Test output saved to: ${testDir}\n`);

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    allTargetsMet: successful.every((r) => r.fpsTargetMet && r.memoryTargetMet),
    results,
  };
}

// Run validation
if (require.main === module) {
  runPerformanceValidation()
    .then((summary) => {
      if (summary.failed === 0 && summary.allTargetsMet) {
        console.log('✓ All performance targets met!\n');
        process.exit(0);
      } else if (summary.failed === 0) {
        console.log(
          '⚠ Some performance targets not met, but tests completed.\n'
        );
        process.exit(0);
      } else {
        console.log(`✗ ${summary.failed} benchmark(s) failed!\n`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n✗ Performance validation failed with error:');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runPerformanceValidation };
