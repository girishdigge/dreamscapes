// End-to-End Testing Suite for Enhanced 3D Renderer
// Tests complete workflow from JSON to video with various quality settings and resolutions

const { renderToFrames } = require('./puppeteer/renderEngine');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Test configurations
const TEST_CONFIGS = [
  {
    name: 'Low Resolution - Draft Quality',
    resolution: [640, 480],
    fps: 15,
    duration: 3,
    quality: 'draft',
  },
  {
    name: 'Medium Resolution - Medium Quality',
    resolution: [1280, 720],
    fps: 24,
    duration: 3,
    quality: 'medium',
  },
  {
    name: 'High Resolution - High Quality',
    resolution: [1920, 1080],
    fps: 30,
    duration: 3,
    quality: 'high',
  },
  {
    name: 'Ultra HD - High Quality',
    resolution: [2560, 1440],
    fps: 30,
    duration: 2,
    quality: 'high',
  },
];

// Load sample dreams
function loadSampleDream(filename) {
  const dreamPath = path.join(__dirname, '../../sample_dreams', filename);
  if (!fs.existsSync(dreamPath)) {
    console.warn(`Sample dream not found: ${filename}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(dreamPath, 'utf8'));
}

// Create test dream with all structure types
function createComprehensiveTestDream() {
  return {
    title: 'Comprehensive 3D Test Scene',
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
    structures: [
      {
        id: 's1',
        type: 'star',
        pos: [0, 0, 0],
        scale: 5.0,
        material: { color: '#ffff00', emissiveIntensity: 1.0 },
      },
      {
        id: 's2',
        type: 'planet',
        pos: [30, 0, 0],
        scale: 3.0,
        material: { color: '#4488ff' },
        animation: { type: 'orbit', speed: 0.5, amplitude: 30 },
      },
      {
        id: 's3',
        type: 'crystal',
        pos: [-20, 10, 0],
        scale: 2.0,
        features: ['glowing_edges'],
        material: { color: '#ff00ff', opacity: 0.7 },
        animation: { type: 'rotate', speed: 1.0 },
      },
      {
        id: 's4',
        type: 'tower',
        pos: [15, -5, 20],
        scale: 2.5,
        material: { color: '#888888' },
      },
      {
        id: 's5',
        type: 'mountain',
        pos: [-30, -10, -20],
        scale: 4.0,
        material: { color: '#8b7355' },
      },
      {
        id: 's6',
        type: 'water',
        pos: [0, -15, 0],
        scale: 10.0,
        material: { color: '#0077be', opacity: 0.8 },
      },
    ],
    entities: [
      {
        id: 'e1',
        type: 'floating_orbs',
        count: 30,
        params: { speed: 1.0, size: 0.5, color: '#00ffff', glow: 0.8 },
      },
      {
        id: 'e2',
        type: 'particle_stream',
        count: 50,
        params: { speed: 2.0, size: 0.3, color: '#ffffff', glow: 0.6 },
      },
    ],
    cinematography: {
      durationSec: 3,
      shots: [
        {
          type: 'orbital',
          startTime: 0,
          duration: 3,
          target: [0, 0, 0],
          distance: 60,
          speed: 0.5,
        },
      ],
    },
  };
}

// Verify frame quality
function verifyFrameQuality(framePath) {
  const stats = fs.statSync(framePath);
  const sizeKB = stats.size / 1024;

  // Frames should be at least 10KB (not blank/corrupted)
  if (sizeKB < 10) {
    return { valid: false, reason: `Frame too small (${sizeKB.toFixed(2)}KB)` };
  }

  // Frames shouldn't be unreasonably large (> 5MB suggests error)
  if (sizeKB > 5120) {
    return { valid: false, reason: `Frame too large (${sizeKB.toFixed(2)}KB)` };
  }

  return { valid: true, sizeKB };
}

// Check if ffmpeg is available
async function checkFfmpegAvailable() {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch (error) {
    return false;
  }
}

// Create video from frames using ffmpeg
async function createVideoFromFrames(framesDir, outputPath, fps) {
  const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i "${framesDir}/frame%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 23 "${outputPath}"`;

  try {
    await execPromise(ffmpegCmd);
    return true;
  } catch (error) {
    console.error('FFmpeg error:', error.message);
    return false;
  }
}

// Verify video output
function verifyVideoOutput(videoPath) {
  if (!fs.existsSync(videoPath)) {
    return { valid: false, reason: 'Video file not created' };
  }

  const stats = fs.statSync(videoPath);
  const sizeMB = stats.size / (1024 * 1024);

  if (sizeMB < 0.1) {
    return { valid: false, reason: `Video too small (${sizeMB.toFixed(2)}MB)` };
  }

  return { valid: true, sizeMB };
}

// Run a single test configuration
async function runTestConfig(config, dream, testDir) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${config.name}`);
  console.log(`Resolution: ${config.resolution[0]}x${config.resolution[1]}`);
  console.log(`FPS: ${config.fps}, Duration: ${config.duration}s`);
  console.log(`${'='.repeat(60)}`);

  const configName = config.name.toLowerCase().replace(/\s+/g, '-');
  const framesDir = path.join(testDir, `frames-${configName}`);
  const videoPath = path.join(testDir, `video-${configName}.mp4`);

  // Clean up previous test
  if (fs.existsSync(framesDir)) {
    rimraf.sync(framesDir);
  }
  fs.mkdirSync(framesDir, { recursive: true });

  const startTime = Date.now();

  try {
    // Render frames
    console.log('Rendering frames...');
    let lastProgress = 0;
    const frameCount = await renderToFrames(
      dream,
      framesDir,
      {
        resolution: config.resolution,
        fps: config.fps,
        duration: config.duration,
      },
      () => false,
      (progress) => {
        const percent = Math.floor(progress * 100);
        if (percent >= lastProgress + 10) {
          console.log(`  Progress: ${percent}%`);
          lastProgress = percent;
        }
      }
    );

    const renderTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Rendered ${frameCount} frames in ${renderTime}s`);

    // Verify frames
    console.log('Verifying frame quality...');
    const frames = fs
      .readdirSync(framesDir)
      .filter((f) => f.endsWith('.png'))
      .sort();

    if (frames.length !== frameCount) {
      throw new Error(`Expected ${frameCount} frames, found ${frames.length}`);
    }

    // Check first, middle, and last frames
    const framesToCheck = [
      frames[0],
      frames[Math.floor(frames.length / 2)],
      frames[frames.length - 1],
    ];

    for (const frame of framesToCheck) {
      const framePath = path.join(framesDir, frame);
      const quality = verifyFrameQuality(framePath);
      if (!quality.valid) {
        throw new Error(
          `Frame ${frame} quality check failed: ${quality.reason}`
        );
      }
    }

    const avgSize =
      framesToCheck.reduce((sum, frame) => {
        return sum + verifyFrameQuality(path.join(framesDir, frame)).sizeKB;
      }, 0) / framesToCheck.length;

    console.log(`✓ Frame quality verified (avg size: ${avgSize.toFixed(2)}KB)`);

    // Create video if ffmpeg is available
    const hasFfmpeg = await checkFfmpegAvailable();
    if (hasFfmpeg) {
      console.log('Creating video with ffmpeg...');
      const videoCreated = await createVideoFromFrames(
        framesDir,
        videoPath,
        config.fps
      );

      if (videoCreated) {
        const videoCheck = verifyVideoOutput(videoPath);
        if (videoCheck.valid) {
          console.log(
            `✓ Video created successfully (${videoCheck.sizeMB.toFixed(2)}MB)`
          );
        } else {
          console.warn(`⚠ Video verification failed: ${videoCheck.reason}`);
        }
      } else {
        console.warn('⚠ Video creation failed');
      }
    } else {
      console.log('⚠ FFmpeg not available, skipping video creation');
    }

    return {
      success: true,
      config: config.name,
      frameCount,
      renderTime: parseFloat(renderTime),
      avgFrameSize: avgSize,
      framesDir,
      videoPath: hasFfmpeg ? videoPath : null,
    };
  } catch (error) {
    console.error(`✗ Test failed: ${error.message}`);
    return {
      success: false,
      config: config.name,
      error: error.message,
    };
  }
}

// Main test runner
async function runE2ETests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Enhanced 3D Renderer - End-to-End Testing Suite          ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  const testDir = path.join(__dirname, 'test-output', 'e2e-final');

  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    rimraf.sync(testDir);
  }
  fs.mkdirSync(testDir, { recursive: true });

  const results = [];

  // Test 1: Comprehensive test dream with all structure types
  console.log('\n📋 Test Suite 1: Comprehensive Scene (All Structure Types)');
  const comprehensiveDream = createComprehensiveTestDream();

  for (const config of TEST_CONFIGS) {
    const result = await runTestConfig(config, comprehensiveDream, testDir);
    results.push(result);
  }

  // Test 2: Sample dream - Cosmic Voyage
  console.log('\n\n📋 Test Suite 2: Sample Dream - Cosmic Voyage');
  const cosmicDream = loadSampleDream('cosmic_voyage_3d.json');
  if (cosmicDream) {
    const result = await runTestConfig(
      {
        name: 'Cosmic Voyage - Medium Quality',
        resolution: [1280, 720],
        fps: 24,
        duration: 3,
        quality: 'medium',
      },
      cosmicDream,
      testDir
    );
    results.push(result);
  }

  // Test 3: Different frame rates
  console.log('\n\n📋 Test Suite 3: Frame Rate Variations');
  const fpsTests = [
    {
      name: 'Low FPS (15)',
      resolution: [1280, 720],
      fps: 15,
      duration: 2,
      quality: 'medium',
    },
    {
      name: 'Standard FPS (30)',
      resolution: [1280, 720],
      fps: 30,
      duration: 2,
      quality: 'medium',
    },
    {
      name: 'High FPS (60)',
      resolution: [1280, 720],
      fps: 60,
      duration: 2,
      quality: 'medium',
    },
  ];

  for (const config of fpsTests) {
    const result = await runTestConfig(config, comprehensiveDream, testDir);
    results.push(result);
  }

  // Print summary
  console.log(
    '\n\n╔════════════════════════════════════════════════════════════╗'
  );
  console.log('║  Test Results Summary                                      ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✓ Passed: ${successful.length}`);
  console.log(`✗ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('Successful Tests:');
    successful.forEach((r) => {
      console.log(`  ✓ ${r.config}`);
      console.log(
        `    - Frames: ${r.frameCount}, Render Time: ${r.renderTime}s`
      );
      console.log(`    - Avg Frame Size: ${r.avgFrameSize.toFixed(2)}KB`);
      if (r.videoPath && fs.existsSync(r.videoPath)) {
        const videoSize = (
          fs.statSync(r.videoPath).size /
          (1024 * 1024)
        ).toFixed(2);
        console.log(`    - Video: ${videoSize}MB`);
      }
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed Tests:');
    failed.forEach((r) => {
      console.log(`  ✗ ${r.config}: ${r.error}`);
    });
  }

  // Performance analysis
  if (successful.length > 0) {
    console.log('\n\nPerformance Analysis:');
    const avgRenderTime =
      successful.reduce((sum, r) => sum + r.renderTime, 0) / successful.length;
    const avgFrameSize =
      successful.reduce((sum, r) => sum + r.avgFrameSize, 0) /
      successful.length;

    console.log(`  Average Render Time: ${avgRenderTime.toFixed(2)}s`);
    console.log(`  Average Frame Size: ${avgFrameSize.toFixed(2)}KB`);

    // Calculate FPS performance
    const fpsPerformance = successful.map((r) => ({
      config: r.config,
      fps: r.frameCount / r.renderTime,
    }));

    console.log('\n  Rendering FPS (frames generated per second):');
    fpsPerformance.forEach((p) => {
      console.log(`    ${p.config}: ${p.fps.toFixed(2)} fps`);
    });
  }

  console.log(`\n\nTest output saved to: ${testDir}`);
  console.log(
    'You can inspect the generated frames and videos to verify visual quality.\n'
  );

  return {
    total: results.length,
    passed: successful.length,
    failed: failed.length,
    results,
  };
}

// Run tests
if (require.main === module) {
  runE2ETests()
    .then((summary) => {
      if (summary.failed === 0) {
        console.log('✓ All end-to-end tests passed!\n');
        process.exit(0);
      } else {
        console.log(`✗ ${summary.failed} test(s) failed!\n`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n✗ Test suite failed with error:');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runE2ETests };
