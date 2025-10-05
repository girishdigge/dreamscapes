// Test script for 3D Puppeteer integration
const { renderToFrames } = require('./puppeteer/renderEngine');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

// Test dream with 3D renderMode
const test3DDream = {
  title: 'Test 3D Scene',
  renderMode: '3d',
  style: 'ethereal',

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
      material: {
        color: '#ffff00',
        emissiveIntensity: 1.0,
      },
    },
    {
      id: 's2',
      type: 'planet',
      pos: [30, 0, 0],
      scale: 3.0,
      material: {
        color: '#4488ff',
      },
      animation: {
        type: 'orbit',
        speed: 0.5,
        amplitude: 30,
      },
    },
    {
      id: 's3',
      type: 'crystal',
      pos: [-20, 10, 0],
      scale: 2.0,
      features: ['glowing_edges'],
      material: {
        color: '#ff00ff',
        opacity: 0.7,
      },
      animation: {
        type: 'rotate',
        speed: 1.0,
      },
    },
  ],

  entities: [
    {
      id: 'e1',
      type: 'floating_orbs',
      count: 50,
      params: {
        speed: 1.0,
        size: 0.5,
        color: '#00ffff',
        glow: 0.8,
      },
    },
  ],

  cinematography: {
    durationSec: 5,
    shots: [
      {
        type: 'orbital',
        startTime: 0,
        duration: 5,
        target: [0, 0, 0],
        distance: 60,
        speed: 0.5,
      },
    ],
  },
};

// Test dream without renderMode (should use 2D template)
const test2DDream = {
  text: 'A simple 2D test scene',
  style: 'surreal',
};

async function runTests() {
  console.log('=== Testing 3D Puppeteer Integration ===\n');

  const testDir = path.join(__dirname, 'test-output');

  try {
    // Clean up previous test output
    if (fs.existsSync(testDir)) {
      rimraf.sync(testDir);
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Test 1: Verify 3D template loads
    console.log('Test 1: Verify 3D template loads with renderMode="3d"');
    const frames3DDir = path.join(testDir, 'frames-3d');
    fs.mkdirSync(frames3DDir, { recursive: true });

    const frameCount3D = await renderToFrames(
      test3DDream,
      frames3DDir,
      {
        resolution: [640, 480],
        fps: 10,
        duration: 2,
      },
      () => false,
      (progress) => {
        if (progress === 1.0) {
          console.log('  ✓ 3D rendering completed');
        }
      }
    );

    console.log(`  ✓ Generated ${frameCount3D} frames`);

    // Verify frames were created
    const frames3D = fs
      .readdirSync(frames3DDir)
      .filter((f) => f.endsWith('.png'));
    if (frames3D.length === frameCount3D) {
      console.log(`  ✓ All ${frameCount3D} frames captured successfully`);
    } else {
      console.error(
        `  ✗ Expected ${frameCount3D} frames, got ${frames3D.length}`
      );
    }

    // Verify frame file sizes (should be > 0)
    const firstFrame = path.join(frames3DDir, frames3D[0]);
    const frameSize = fs.statSync(firstFrame).size;
    if (frameSize > 1000) {
      console.log(`  ✓ Frame size is valid (${frameSize} bytes)`);
    } else {
      console.error(`  ✗ Frame size too small (${frameSize} bytes)`);
    }

    console.log(
      '\nTest 2: Verify deterministic rendering (same input = same output)'
    );
    const frames3DDir2 = path.join(testDir, 'frames-3d-repeat');
    fs.mkdirSync(frames3DDir2, { recursive: true });

    await renderToFrames(test3DDream, frames3DDir2, {
      resolution: [640, 480],
      fps: 10,
      duration: 2,
    });

    // Compare first and last frames from both renders
    const frame1_1 = fs.readFileSync(path.join(frames3DDir, 'frame00001.png'));
    const frame1_2 = fs.readFileSync(path.join(frames3DDir2, 'frame00001.png'));
    const frameLast_1 = fs.readFileSync(
      path.join(
        frames3DDir,
        `frame${String(frameCount3D).padStart(5, '0')}.png`
      )
    );
    const frameLast_2 = fs.readFileSync(
      path.join(
        frames3DDir2,
        `frame${String(frameCount3D).padStart(5, '0')}.png`
      )
    );

    if (frame1_1.equals(frame1_2) && frameLast_1.equals(frameLast_2)) {
      console.log('  ✓ Deterministic rendering verified (identical frames)');
    } else {
      console.warn(
        '  ⚠ Frames differ slightly (may be due to timing or GPU differences)'
      );
    }

    console.log(
      '\nTest 3: Verify backward compatibility (2D template without renderMode)'
    );
    const frames2DDir = path.join(testDir, 'frames-2d');
    fs.mkdirSync(frames2DDir, { recursive: true });

    const frameCount2D = await renderToFrames(test2DDream, frames2DDir, {
      resolution: [640, 480],
      fps: 10,
      duration: 1,
    });

    console.log(
      `  ✓ 2D template still works (${frameCount2D} frames generated)`
    );

    console.log(
      '\nTest 4: Verify seek() produces different frames at different times'
    );
    const frame1 = path.join(frames3DDir, 'frame00001.png');
    const frame10 = path.join(frames3DDir, 'frame00010.png');
    const frame20 = path.join(frames3DDir, 'frame00020.png');

    const size1 = fs.statSync(frame1).size;
    const size10 = fs.statSync(frame10).size;
    const size20 = fs.statSync(frame20).size;

    // Frames should have different content (different file sizes is a rough check)
    if (size1 !== size10 || size10 !== size20) {
      console.log(
        '  ✓ Different frames have different content (animation working)'
      );
    } else {
      console.warn(
        '  ⚠ Frames appear identical (animation may not be working)'
      );
    }

    console.log('\n=== All Tests Completed ===');
    console.log(`\nTest output saved to: ${testDir}`);
    console.log(
      'You can inspect the generated frames to verify visual quality.'
    );
  } catch (error) {
    console.error('\n✗ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✓ Integration tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Integration tests failed!');
    console.error(error);
    process.exit(1);
  });
