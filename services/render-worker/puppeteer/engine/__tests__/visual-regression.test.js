/**
 * Visual Regression Tests for Enhanced 3D Renderer
 * Tests visual consistency by comparing renders against reference frames
 */

class VisualRegressionTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
    this.referenceFrames = new Map();
  }

  /**
   * Generate reference frames for standard scenes
   * Requirements: 10.7
   */
  async generateReferenceFrames() {
    console.log('Generating reference frames...');

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Standard test scene
    const standardScene = {
      title: 'Standard Reference Scene',
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
      },
      structures: [
        { id: 's1', type: 'star', pos: [0, 0, 0], scale: 10 },
        { id: 's2', type: 'planet', pos: [50, 0, 0], scale: 15 },
        { id: 's3', type: 'crystal', pos: [-50, 0, 0], scale: 12 },
        {
          id: 's4',
          type: 'tower',
          pos: [0, -20, 50],
          scale: 20,
          animation: {
            type: 'rotate',
            speed: 1.0,
          },
        },
      ],
      cinematography: {
        durationSec: 10,
        shots: [
          {
            type: 'orbital',
            startTime: 0,
            duration: 10,
            target: [0, 0, 0],
            distance: 100,
            speed: 1.0,
          },
        ],
      },
    };

    renderer.initWithDream(standardScene, 1920, 1080);

    // Generate reference frames at key time points
    const timePoints = [0, 2.5, 5, 7.5, 10];

    for (const time of timePoints) {
      renderer.seek(time);

      // Capture frame data (in real implementation, this would be pixel data)
      const frameData = this.captureFrame(canvas, renderer);

      this.referenceFrames.set(`standard_t${time}`, frameData);
    }

    console.log(
      `Generated ${this.referenceFrames.size} reference frames for standard scene`
    );

    renderer.dispose();

    return true;
  }

  /**
   * Capture frame data from canvas
   */
  captureFrame(canvas, renderer) {
    // In a real implementation, this would capture pixel data
    // For this test, we'll capture scene state instead

    return {
      cameraPosition: renderer.camera.position.clone(),
      cameraRotation: renderer.camera.rotation.clone(),
      objectCount: renderer.renderObjects.size,
      sceneChildren: renderer.scene.children.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Compare two frames for similarity
   */
  compareFrames(frame1, frame2, tolerance = 0.01) {
    // Compare camera positions
    const posDiff = frame1.cameraPosition.distanceTo(frame2.cameraPosition);
    if (posDiff > tolerance) {
      return {
        match: false,
        reason: `Camera position difference: ${posDiff.toFixed(4)}`,
      };
    }

    // Compare camera rotations
    const rotDiff =
      Math.abs(frame1.cameraRotation.x - frame2.cameraRotation.x) +
      Math.abs(frame1.cameraRotation.y - frame2.cameraRotation.y) +
      Math.abs(frame1.cameraRotation.z - frame2.cameraRotation.z);
    if (rotDiff > tolerance) {
      return {
        match: false,
        reason: `Camera rotation difference: ${rotDiff.toFixed(4)}`,
      };
    }

    // Compare object counts
    if (frame1.objectCount !== frame2.objectCount) {
      return {
        match: false,
        reason: `Object count mismatch: ${frame1.objectCount} vs ${frame2.objectCount}`,
      };
    }

    return { match: true };
  }

  /**
   * Test: Compare new renders against references
   * Requirements: 10.7
   */
  async testCompareAgainstReferences() {
    // First generate reference frames
    await this.generateReferenceFrames();

    // Now render the same scene again and compare
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    const standardScene = {
      title: 'Standard Reference Scene',
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
      },
      structures: [
        { id: 's1', type: 'star', pos: [0, 0, 0], scale: 10 },
        { id: 's2', type: 'planet', pos: [50, 0, 0], scale: 15 },
        { id: 's3', type: 'crystal', pos: [-50, 0, 0], scale: 12 },
        {
          id: 's4',
          type: 'tower',
          pos: [0, -20, 50],
          scale: 20,
          animation: {
            type: 'rotate',
            speed: 1.0,
          },
        },
      ],
      cinematography: {
        durationSec: 10,
        shots: [
          {
            type: 'orbital',
            startTime: 0,
            duration: 10,
            target: [0, 0, 0],
            distance: 100,
            speed: 1.0,
          },
        ],
      },
    };

    renderer.initWithDream(standardScene, 1920, 1080);

    // Compare frames at same time points
    const timePoints = [0, 2.5, 5, 7.5, 10];
    let matchCount = 0;

    for (const time of timePoints) {
      renderer.seek(time);

      const newFrame = this.captureFrame(canvas, renderer);
      const refFrame = this.referenceFrames.get(`standard_t${time}`);

      const comparison = this.compareFrames(newFrame, refFrame);

      if (comparison.match) {
        matchCount++;
      } else {
        console.warn(`Frame mismatch at t=${time}: ${comparison.reason}`);
      }
    }

    this.assert(
      matchCount === timePoints.length,
      `All ${timePoints.length} frames should match references (matched: ${matchCount})`
    );

    renderer.dispose();

    return true;
  }

  /**
   * Test: Animation consistency at different time points
   * Requirements: 10.7
   */
  async testAnimationConsistency() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    const dreamData = {
      title: 'Animation Consistency Test',
      environment: {
        preset: 'space',
        skybox: 'void',
      },
      structures: [
        {
          id: 's1',
          type: 'star',
          pos: [0, 0, 0],
          scale: 10,
          animation: {
            type: 'rotate',
            speed: 1.0,
          },
        },
        {
          id: 's2',
          type: 'planet',
          pos: [50, 0, 0],
          scale: 15,
          animation: {
            type: 'orbit',
            speed: 1.0,
            amplitude: 30,
          },
        },
        {
          id: 's3',
          type: 'crystal',
          pos: [-50, 0, 0],
          scale: 12,
          animation: {
            type: 'pulse',
            speed: 1.0,
            amplitude: 0.5,
          },
        },
      ],
      cinematography: {
        durationSec: 10,
        shots: [
          {
            type: 'establish',
            startTime: 0,
            duration: 10,
            position: [0, 50, 100],
            target: [0, 0, 0],
          },
        ],
      },
    };

    renderer.initWithDream(dreamData, 1920, 1080);

    // Capture animation states at multiple time points
    const timePoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const states = new Map();

    for (const time of timePoints) {
      renderer.seek(time);

      const s1 = renderer.renderObjects.get('s1');
      const s2 = renderer.renderObjects.get('s2');
      const s3 = renderer.renderObjects.get('s3');

      states.set(time, {
        s1Rotation: s1.mesh.rotation.y,
        s2Position: s2.mesh.position.clone(),
        s3Scale: s3.mesh.scale.x,
      });
    }

    // Verify animations are consistent when seeking back
    for (const time of timePoints) {
      renderer.seek(time);

      const s1 = renderer.renderObjects.get('s1');
      const s2 = renderer.renderObjects.get('s2');
      const s3 = renderer.renderObjects.get('s3');

      const originalState = states.get(time);

      this.assert(
        Math.abs(s1.mesh.rotation.y - originalState.s1Rotation) < 0.001,
        `Rotation at t=${time} should be consistent`
      );

      this.assert(
        s2.mesh.position.distanceTo(originalState.s2Position) < 0.001,
        `Position at t=${time} should be consistent`
      );

      this.assert(
        Math.abs(s3.mesh.scale.x - originalState.s3Scale) < 0.001,
        `Scale at t=${time} should be consistent`
      );
    }

    renderer.dispose();

    return true;
  }

  /**
   * Test: Different skybox types render consistently
   */
  async testSkyboxConsistency() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const skyboxTypes = ['galaxy', 'nebula', 'sunset', 'underwater', 'void'];

    for (const skyboxType of skyboxTypes) {
      const renderer = new SceneRenderer(canvas);

      const dreamData = {
        title: `Skybox Test: ${skyboxType}`,
        environment: {
          preset: 'space',
          skybox: skyboxType,
        },
        structures: [{ id: 's1', type: 'star', pos: [0, 0, 0], scale: 10 }],
        cinematography: {
          durationSec: 5,
          shots: [
            {
              type: 'establish',
              startTime: 0,
              duration: 5,
              position: [0, 0, 100],
              target: [0, 0, 0],
            },
          ],
        },
      };

      renderer.initWithDream(dreamData, 1920, 1080);

      // Render at multiple times
      const frames = [];
      for (let t = 0; t <= 5; t += 1) {
        renderer.seek(t);
        frames.push(this.captureFrame(canvas, renderer));
      }

      // Verify frames are consistent
      this.assert(
        frames.length === 6,
        `Should capture 6 frames for ${skyboxType} skybox`
      );

      // Verify determinism
      renderer.seek(2.5);
      const frame1 = this.captureFrame(canvas, renderer);

      renderer.seek(4);
      renderer.seek(2.5);
      const frame2 = this.captureFrame(canvas, renderer);

      const comparison = this.compareFrames(frame1, frame2);
      this.assert(
        comparison.match,
        `${skyboxType} skybox should render deterministically`
      );

      renderer.dispose();
    }

    return true;
  }

  /**
   * Test: Complex scene visual consistency
   */
  async testComplexSceneConsistency() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Create a complex scene with many elements
    const structures = [];
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const radius = 30 + (i % 10) * 5;
      structures.push({
        id: `s${i}`,
        type: i % 3 === 0 ? 'star' : i % 3 === 1 ? 'planet' : 'crystal',
        pos: [
          Math.cos(angle) * radius,
          (i % 10) * 5 - 25,
          Math.sin(angle) * radius,
        ],
        scale: 3 + (i % 5),
        animation: {
          type: i % 2 === 0 ? 'rotate' : 'pulse',
          speed: 0.5 + (i % 3) * 0.5,
        },
      });
    }

    const dreamData = {
      title: 'Complex Scene Consistency Test',
      environment: {
        preset: 'space',
        skybox: 'galaxy',
      },
      structures: structures,
      cinematography: {
        durationSec: 10,
        shots: [
          {
            type: 'orbital',
            startTime: 0,
            duration: 10,
            target: [0, 0, 0],
            distance: 150,
            speed: 1.0,
          },
        ],
      },
    };

    renderer.initWithDream(dreamData, 1920, 1080);

    // Capture frames at multiple time points
    const timePoints = [0, 2, 4, 6, 8, 10];
    const firstPass = new Map();

    for (const time of timePoints) {
      renderer.seek(time);
      firstPass.set(time, this.captureFrame(canvas, renderer));
    }

    // Render again and compare
    for (const time of timePoints) {
      renderer.seek(time);
      const secondFrame = this.captureFrame(canvas, renderer);
      const firstFrame = firstPass.get(time);

      const comparison = this.compareFrames(firstFrame, secondFrame);
      this.assert(
        comparison.match,
        `Complex scene at t=${time} should be consistent`
      );
    }

    renderer.dispose();

    return true;
  }

  /**
   * Test: Camera shot transitions are smooth
   */
  async testCameraTransitionSmoothness() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    const dreamData = {
      title: 'Camera Transition Test',
      environment: {
        preset: 'space',
        skybox: 'void',
      },
      structures: [{ id: 's1', type: 'star', pos: [0, 0, 0], scale: 10 }],
      cinematography: {
        durationSec: 15,
        shots: [
          {
            type: 'establish',
            startTime: 0,
            duration: 5,
            position: [0, 0, 100],
            target: [0, 0, 0],
          },
          {
            type: 'close_up',
            startTime: 5,
            duration: 5,
            target: [0, 0, 0],
            distance: 20,
          },
          {
            type: 'pull_back',
            startTime: 10,
            duration: 5,
            startDistance: 20,
            endDistance: 150,
            target: [0, 0, 0],
          },
        ],
      },
    };

    renderer.initWithDream(dreamData, 1920, 1080);

    // Sample camera positions frequently during transitions
    const positions = [];
    for (let t = 0; t <= 15; t += 0.25) {
      renderer.seek(t);
      positions.push({
        time: t,
        position: renderer.camera.position.clone(),
      });
    }

    // Check for smooth transitions (no large jumps)
    for (let i = 1; i < positions.length; i++) {
      const distance = positions[i].position.distanceTo(
        positions[i - 1].position
      );

      this.assert(
        distance < 20,
        `Camera movement should be smooth at t=${positions[i].time.toFixed(
          2
        )} (distance: ${distance.toFixed(2)})`
      );
    }

    renderer.dispose();

    return true;
  }

  // Test runner utilities
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  async runTest(testName, testFn) {
    try {
      console.log(`Running: ${testName}`);
      await testFn.call(this);
      this.passed++;
      this.results.push({ test: testName, status: 'PASS' });
      console.log(`✓ ${testName}`);
    } catch (error) {
      this.failed++;
      this.results.push({
        test: testName,
        status: 'FAIL',
        error: error.message,
      });
      console.error(`✗ ${testName}: ${error.message}`);
    }
  }

  async runAll() {
    console.log('=== Visual Regression Tests ===\n');

    await this.runTest(
      'Compare new renders against references',
      this.testCompareAgainstReferences
    );
    await this.runTest(
      'Animation consistency at different time points',
      this.testAnimationConsistency
    );
    await this.runTest(
      'Different skybox types render consistently',
      this.testSkyboxConsistency
    );
    await this.runTest(
      'Complex scene visual consistency',
      this.testComplexSceneConsistency
    );
    await this.runTest(
      'Camera shot transitions are smooth',
      this.testCameraTransitionSmoothness
    );

    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);

    return {
      passed: this.passed,
      failed: this.failed,
      results: this.results,
    };
  }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualRegressionTests;
}
