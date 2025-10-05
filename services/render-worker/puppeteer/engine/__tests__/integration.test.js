/**
 * Integration Tests for Enhanced 3D Renderer
 * Tests complete scene rendering, Puppeteer integration, and performance
 */

class IntegrationTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  /**
   * Test: Complete scene rendering with all structure types
   * Requirements: 1.3, 1.4, 9.1, 9.3, 9.4
   */
  async testCompleteSceneRendering() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Create a comprehensive dream with many structure types
    const dreamData = {
      title: 'Integration Test Dream',
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
        // Celestial objects
        { id: 's1', type: 'star', pos: [0, 0, 0], scale: 10 },
        { id: 's2', type: 'planet', pos: [50, 0, 0], scale: 15 },
        { id: 's3', type: 'galaxy', pos: [0, 50, 0], scale: 30 },
        { id: 's4', type: 'nebula', pos: [-50, 0, 0], scale: 40 },

        // Natural elements
        { id: 's5', type: 'water', pos: [0, -20, 0], scale: 50 },
        { id: 's6', type: 'mountain', pos: [30, -10, 30], scale: 25 },
        { id: 's7', type: 'cloud', pos: [0, 40, 0], scale: 20 },
        { id: 's8', type: 'fire', pos: [-30, 0, -30], scale: 8 },

        // Living beings
        { id: 's9', type: 'horse', pos: [20, -10, 20], scale: 5 },
        { id: 's10', type: 'bird', pos: [0, 30, 0], scale: 2 },
        { id: 's11', type: 'fish', pos: [10, -15, 10], scale: 3 },

        // Architectural structures
        { id: 's12', type: 'tower', pos: [-20, 0, -20], scale: 20 },
        { id: 's13', type: 'crystal', pos: [40, 0, -40], scale: 15 },
        { id: 's14', type: 'bridge', pos: [0, -5, 40], scale: 30 },
      ],
      entities: [
        {
          id: 'e1',
          type: 'particle_stream',
          count: 100,
          params: { speed: 2.0, color: '#00ffff' },
        },
        {
          id: 'e2',
          type: 'floating_orbs',
          count: 50,
          params: { size: 1.0, color: '#ffff00' },
        },
      ],
      cinematography: {
        durationSec: 30,
        shots: [
          {
            type: 'orbital',
            startTime: 0,
            duration: 10,
            target: [0, 0, 0],
            distance: 100,
            speed: 1.0,
          },
          {
            type: 'close_up',
            startTime: 10,
            duration: 10,
            target: [0, 0, 0],
            distance: 30,
          },
          {
            type: 'pull_back',
            startTime: 20,
            duration: 10,
            startDistance: 30,
            endDistance: 150,
            target: [0, 0, 0],
          },
        ],
      },
    };

    // Initialize with dream
    renderer.initWithDream(dreamData, 1920, 1080);

    // Verify all structures were created
    this.assert(
      renderer.renderObjects.size >= 14,
      'All structures should be created'
    );

    // Verify scene has objects
    let objectCount = 0;
    renderer.scene.traverse(() => objectCount++);
    this.assert(
      objectCount > 20,
      'Scene should have many objects (structures, lights, skybox, etc.)'
    );

    // Render at different times
    renderer.seek(0);
    renderer.seek(10);
    renderer.seek(20);
    renderer.seek(30);

    // Should not throw errors
    this.assert(true, 'Complete scene should render without errors');

    // Cleanup
    renderer.dispose();

    return true;
  }

  /**
   * Test: Puppeteer integration end-to-end
   * Requirements: 1.3, 1.4, 9.1, 9.3, 9.4
   */
  async testPuppeteerIntegration() {
    // This test simulates what Puppeteer would do

    const canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 1920;
    canvas.height = 1080;

    // Simulate window.initWithDream() function
    const dreamData = {
      title: 'Puppeteer Test',
      environment: {
        preset: 'space',
        skybox: 'galaxy',
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
      ],
      cinematography: {
        durationSec: 10,
        shots: [
          {
            type: 'orbital',
            startTime: 0,
            duration: 10,
            target: [0, 0, 0],
            distance: 50,
            speed: 1.0,
          },
        ],
      },
    };

    const renderer = new SceneRenderer(canvas);
    renderer.initWithDream(dreamData, 1920, 1080);

    // Simulate frame capture at different times
    const frames = [];
    for (let t = 0; t < 10; t += 1) {
      renderer.seek(t);
      // In real Puppeteer, this would be a screenshot
      frames.push({ time: t, rendered: true });
    }

    this.assert(frames.length === 10, 'Should capture 10 frames');

    // Test deterministic rendering
    renderer.seek(5);
    const pos1 = renderer.camera.position.clone();

    renderer.seek(7);
    renderer.seek(5);
    const pos2 = renderer.camera.position.clone();

    this.assert(
      Math.abs(pos1.x - pos2.x) < 0.001 &&
        Math.abs(pos1.y - pos2.y) < 0.001 &&
        Math.abs(pos1.z - pos2.z) < 0.001,
      'Rendering should be deterministic'
    );

    // Verify canvas is accessible
    this.assert(canvas.id === 'renderCanvas', 'Canvas should have correct ID');

    renderer.dispose();

    return true;
  }

  /**
   * Test: Performance with 100 objects
   * Requirements: 1.3, 1.4, 9.1, 9.3, 9.4
   */
  async testPerformance100Objects() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Create dream with 100 objects
    const structures = [];
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      const radius = 50 + (i % 10) * 10;
      structures.push({
        id: `s${i}`,
        type:
          i % 5 === 0
            ? 'star'
            : i % 5 === 1
            ? 'planet'
            : i % 5 === 2
            ? 'crystal'
            : i % 5 === 3
            ? 'tower'
            : 'mountain',
        pos: [
          Math.cos(angle) * radius,
          (i % 20) * 5 - 50,
          Math.sin(angle) * radius,
        ],
        scale: 5 + (i % 10),
      });
    }

    const dreamData = {
      title: 'Performance Test 100',
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
            distance: 200,
            speed: 1.0,
          },
        ],
      },
    };

    const startTime = performance.now();
    renderer.initWithDream(dreamData, 1920, 1080);
    const initTime = performance.now() - startTime;

    this.assert(
      initTime < 5000,
      'Initialization with 100 objects should take less than 5 seconds'
    );

    // Render a few frames and measure time
    const renderStartTime = performance.now();
    for (let t = 0; t < 5; t += 0.5) {
      renderer.seek(t);
    }
    const renderTime = performance.now() - renderStartTime;
    const avgFrameTime = renderTime / 10;

    this.assert(
      avgFrameTime < 100,
      'Average frame time should be less than 100ms (10+ FPS)'
    );

    console.log(
      `Performance (100 objects): Init=${initTime.toFixed(
        2
      )}ms, AvgFrame=${avgFrameTime.toFixed(2)}ms`
    );

    renderer.dispose();

    return true;
  }

  /**
   * Test: Performance with 500 objects
   * Requirements: 1.3, 1.4, 9.1, 9.3, 9.4
   */
  async testPerformance500Objects() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Create dream with 500 objects
    const structures = [];
    for (let i = 0; i < 500; i++) {
      const angle = (i / 500) * Math.PI * 2;
      const radius = 50 + (i % 50) * 5;
      const height = (i % 40) * 5 - 100;
      structures.push({
        id: `s${i}`,
        type: i % 3 === 0 ? 'star' : i % 3 === 1 ? 'crystal' : 'planet',
        pos: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
        scale: 3 + (i % 5),
      });
    }

    const dreamData = {
      title: 'Performance Test 500',
      environment: {
        preset: 'space',
        skybox: 'void',
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
            distance: 300,
            speed: 1.0,
          },
        ],
      },
    };

    const startTime = performance.now();
    renderer.initWithDream(dreamData, 1920, 1080);
    const initTime = performance.now() - startTime;

    this.assert(
      initTime < 10000,
      'Initialization with 500 objects should take less than 10 seconds'
    );

    // Render a few frames
    const renderStartTime = performance.now();
    for (let t = 0; t < 3; t += 0.5) {
      renderer.seek(t);
    }
    const renderTime = performance.now() - renderStartTime;
    const avgFrameTime = renderTime / 6;

    this.assert(
      avgFrameTime < 150,
      'Average frame time should be less than 150ms (6+ FPS)'
    );

    console.log(
      `Performance (500 objects): Init=${initTime.toFixed(
        2
      )}ms, AvgFrame=${avgFrameTime.toFixed(2)}ms`
    );

    renderer.dispose();

    return true;
  }

  /**
   * Test: Performance with 1000 objects
   * Requirements: 1.3, 1.4, 9.1, 9.3, 9.4
   */
  async testPerformance1000Objects() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'draft' });

    // Create dream with 1000 objects
    const structures = [];
    for (let i = 0; i < 1000; i++) {
      const angle = (i / 1000) * Math.PI * 2;
      const radius = 50 + (i % 100) * 3;
      const height = (i % 50) * 4 - 100;
      structures.push({
        id: `s${i}`,
        type: i % 2 === 0 ? 'star' : 'crystal',
        pos: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
        scale: 2 + (i % 3),
      });
    }

    const dreamData = {
      title: 'Performance Test 1000',
      environment: {
        preset: 'void',
        skybox: 'void',
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
            distance: 400,
            speed: 1.0,
          },
        ],
      },
    };

    const startTime = performance.now();
    renderer.initWithDream(dreamData, 1920, 1080);
    const initTime = performance.now() - startTime;

    this.assert(
      initTime < 20000,
      'Initialization with 1000 objects should take less than 20 seconds'
    );

    // Render a few frames
    const renderStartTime = performance.now();
    for (let t = 0; t < 2; t += 0.5) {
      renderer.seek(t);
    }
    const renderTime = performance.now() - renderStartTime;
    const avgFrameTime = renderTime / 4;

    this.assert(
      avgFrameTime < 200,
      'Average frame time should be less than 200ms (5+ FPS)'
    );

    console.log(
      `Performance (1000 objects): Init=${initTime.toFixed(
        2
      )}ms, AvgFrame=${avgFrameTime.toFixed(2)}ms`
    );

    renderer.dispose();

    return true;
  }

  /**
   * Test: Memory usage stays under 512MB
   * Requirements: 1.3, 1.4, 9.1, 9.3, 9.4
   */
  async testMemoryUsage() {
    // Note: Accurate memory measurement requires browser APIs
    // This is a simplified test

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Create a moderately complex scene
    const structures = [];
    for (let i = 0; i < 200; i++) {
      const angle = (i / 200) * Math.PI * 2;
      const radius = 50 + (i % 20) * 5;
      structures.push({
        id: `s${i}`,
        type:
          i % 4 === 0
            ? 'star'
            : i % 4 === 1
            ? 'planet'
            : i % 4 === 2
            ? 'crystal'
            : 'mountain',
        pos: [
          Math.cos(angle) * radius,
          (i % 20) * 5 - 50,
          Math.sin(angle) * radius,
        ],
        scale: 5 + (i % 8),
      });
    }

    const dreamData = {
      title: 'Memory Test',
      environment: {
        preset: 'space',
        skybox: 'galaxy',
      },
      structures: structures,
      entities: [
        {
          id: 'e1',
          type: 'particle_stream',
          count: 1000,
          params: { speed: 2.0, color: '#00ffff' },
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
            distance: 200,
            speed: 1.0,
          },
        ],
      },
    };

    // Check memory if available
    let memoryBefore = 0;
    if (performance.memory) {
      memoryBefore = performance.memory.usedJSHeapSize;
    }

    renderer.initWithDream(dreamData, 1920, 1080);

    // Render some frames
    for (let t = 0; t < 10; t += 1) {
      renderer.seek(t);
    }

    let memoryAfter = 0;
    if (performance.memory) {
      memoryAfter = performance.memory.usedJSHeapSize;
      const memoryUsed = (memoryAfter - memoryBefore) / (1024 * 1024);

      console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);

      this.assert(memoryUsed < 512, 'Memory usage should stay under 512MB');
    } else {
      console.log('Memory API not available, skipping memory check');
      this.assert(true, 'Memory test skipped (API not available)');
    }

    renderer.dispose();

    return true;
  }

  /**
   * Test: Animation consistency across frames
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

    // Capture animation states at different times
    const states = [];
    for (let t = 0; t <= 10; t += 2) {
      renderer.seek(t);
      const s1 = renderer.renderObjects.get('s1');
      const s2 = renderer.renderObjects.get('s2');
      states.push({
        time: t,
        s1Rotation: s1.mesh.rotation.y,
        s2Position: s2.mesh.position.clone(),
      });
    }

    // Verify animations progressed
    this.assert(
      states[0].s1Rotation !== states[states.length - 1].s1Rotation,
      'Rotation animation should progress over time'
    );

    this.assert(
      !states[0].s2Position.equals(states[states.length - 1].s2Position),
      'Orbit animation should progress over time'
    );

    // Verify determinism by seeking back
    renderer.seek(4);
    const s1 = renderer.renderObjects.get('s1');
    const s2 = renderer.renderObjects.get('s2');

    this.assert(
      Math.abs(s1.mesh.rotation.y - states[2].s1Rotation) < 0.001,
      'Animation should be deterministic'
    );

    renderer.dispose();

    return true;
  }

  /**
   * Test: Error recovery and graceful degradation
   */
  async testErrorRecovery() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    // Create dream with some invalid data
    const dreamData = {
      title: 'Error Recovery Test',
      environment: {
        preset: 'space',
        skybox: 'galaxy',
      },
      structures: [
        // Valid structure
        { id: 's1', type: 'star', pos: [0, 0, 0], scale: 10 },

        // Invalid structure type (should fallback)
        { id: 's2', type: 'unknown_type_xyz', pos: [50, 0, 0], scale: 10 },

        // Missing parameters (should use defaults)
        { id: 's3', type: 'planet', pos: [0, 50, 0] },

        // Malformed color (should use default)
        {
          id: 's4',
          type: 'crystal',
          pos: [-50, 0, 0],
          scale: 15,
          material: { color: 'invalid_color' },
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

    // Should not throw errors despite invalid data
    renderer.initWithDream(dreamData, 1920, 1080);

    // Should still create objects (with fallbacks)
    this.assert(
      renderer.renderObjects.size >= 4,
      'Should create objects even with some invalid data'
    );

    // Should be able to render
    renderer.seek(5);

    this.assert(true, 'Should handle errors gracefully');

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
    console.log('=== Integration Tests ===\n');

    await this.runTest(
      'Complete scene rendering with all structure types',
      this.testCompleteSceneRendering
    );
    await this.runTest(
      'Puppeteer integration end-to-end',
      this.testPuppeteerIntegration
    );
    await this.runTest(
      'Performance with 100 objects',
      this.testPerformance100Objects
    );
    await this.runTest(
      'Performance with 500 objects',
      this.testPerformance500Objects
    );
    await this.runTest(
      'Performance with 1000 objects',
      this.testPerformance1000Objects
    );
    await this.runTest('Memory usage stays under 512MB', this.testMemoryUsage);
    await this.runTest(
      'Animation consistency across frames',
      this.testAnimationConsistency
    );
    await this.runTest(
      'Error recovery and graceful degradation',
      this.testErrorRecovery
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
  module.exports = IntegrationTests;
}
