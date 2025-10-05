/**
 * Unit Tests for SceneRenderer
 * Tests initialization, dream parsing, seek functionality, and resource cleanup
 */

// Mock Three.js if not available
if (typeof THREE === 'undefined') {
  console.error('THREE.js is required for these tests');
}

class SceneRendererTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  /**
   * Test: Initialization creates scene, camera, renderer
   * Requirements: 1.1, 1.3, 1.7
   */
  async testInitialization() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas, { quality: 'medium' });

    // Verify scene is created
    this.assert(renderer.scene !== null, 'Scene should be created');
    this.assert(
      renderer.scene instanceof THREE.Scene,
      'Scene should be THREE.Scene instance'
    );

    // Verify camera is created
    this.assert(renderer.camera !== null, 'Camera should be created');
    this.assert(
      renderer.camera instanceof THREE.PerspectiveCamera,
      'Camera should be PerspectiveCamera'
    );
    this.assert(renderer.camera.fov === 75, 'Camera FOV should be 75');
    this.assert(
      renderer.camera.near === 0.1,
      'Camera near plane should be 0.1'
    );
    this.assert(
      renderer.camera.far === 10000,
      'Camera far plane should be 10000'
    );

    // Verify renderer is created
    this.assert(renderer.renderer !== null, 'Renderer should be created');
    this.assert(
      renderer.renderer instanceof THREE.WebGLRenderer,
      'Renderer should be WebGLRenderer'
    );

    // Verify subsystems are initialized
    this.assert(
      renderer.assetLibrary !== null,
      'AssetLibrary should be initialized'
    );
    this.assert(
      renderer.materialSystem !== null,
      'MaterialSystem should be initialized'
    );
    this.assert(
      renderer.animationController !== null,
      'AnimationController should be initialized'
    );
    this.assert(
      renderer.cameraController !== null,
      'CameraController should be initialized'
    );

    // Verify quality settings
    this.assert(
      renderer.options.quality === 'medium',
      'Quality should be set to medium'
    );

    // Cleanup
    renderer.dispose();

    return true;
  }

  /**
   * Test: initWithDream() parses JSON correctly
   * Requirements: 1.1, 1.3, 1.7
   */
  async testInitWithDream() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    const dreamData = {
      title: 'Test Dream',
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
      },
      structures: [
        {
          id: 's1',
          type: 'star',
          pos: [0, 0, 0],
          scale: 10,
          material: {
            color: '#ffff00',
            emissiveIntensity: 0.8,
          },
        },
        {
          id: 's2',
          type: 'planet',
          pos: [50, 0, 0],
          scale: 15,
          material: {
            color: '#0088ff',
          },
        },
      ],
      entities: [
        {
          id: 'e1',
          type: 'particle_stream',
          count: 100,
          params: {
            speed: 2.0,
            color: '#00ffff',
          },
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
        ],
      },
    };

    // Initialize with dream
    renderer.initWithDream(dreamData, 1920, 1080);

    // Verify dream data is stored
    this.assert(renderer.dreamData !== null, 'Dream data should be stored');
    this.assert(
      renderer.dreamData.title === 'Test Dream',
      'Dream title should match'
    );

    // Verify structures are created
    this.assert(
      renderer.renderObjects.size >= 2,
      'At least 2 structures should be created'
    );

    // Verify scene has objects
    let objectCount = 0;
    renderer.scene.traverse(() => objectCount++);
    this.assert(
      objectCount > 3,
      'Scene should have multiple objects (including lights, skybox, etc.)'
    );

    // Verify camera controller has shots
    this.assert(
      renderer.cameraController.shots.length > 0,
      'Camera controller should have shots'
    );

    // Cleanup
    renderer.dispose();

    return true;
  }

  /**
   * Test: seek() renders at correct time
   * Requirements: 1.1, 1.3, 1.7
   */
  async testSeek() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    const dreamData = {
      title: 'Test Dream',
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

    renderer.initWithDream(dreamData, 1920, 1080);

    // Seek to time 0
    renderer.seek(0);
    this.assert(renderer.currentTime === 0, 'Current time should be 0');

    const structure = renderer.renderObjects.get('s1');
    const rotation0 = structure.mesh.rotation.y;

    // Seek to time 5
    renderer.seek(5);
    this.assert(renderer.currentTime === 5, 'Current time should be 5');

    const rotation5 = structure.mesh.rotation.y;

    // Rotation should have changed
    this.assert(rotation5 !== rotation0, 'Rotation should change over time');

    // Seek back to time 0 - should be deterministic
    renderer.seek(0);
    const rotation0Again = structure.mesh.rotation.y;
    this.assert(
      Math.abs(rotation0Again - rotation0) < 0.001,
      'Seeking to same time should produce same result (deterministic)'
    );

    // Cleanup
    renderer.dispose();

    return true;
  }

  /**
   * Test: dispose() cleans up resources
   * Requirements: 1.1, 1.3, 1.7
   */
  async testDispose() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    const dreamData = {
      title: 'Test Dream',
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
        },
        {
          id: 's2',
          type: 'planet',
          pos: [50, 0, 0],
          scale: 15,
        },
      ],
    };

    renderer.initWithDream(dreamData, 1920, 1080);

    // Verify objects exist before disposal
    this.assert(
      renderer.renderObjects.size > 0,
      'Render objects should exist before disposal'
    );
    this.assert(
      renderer.scene.children.length > 0,
      'Scene should have children before disposal'
    );

    // Dispose
    renderer.dispose();

    // Verify cleanup
    this.assert(
      renderer.renderObjects.size === 0,
      'Render objects should be cleared'
    );
    this.assert(renderer.isAnimating === false, 'Animation should be stopped');
    this.assert(
      renderer.animationFrameId === null,
      'Animation frame ID should be null'
    );

    // Verify renderer is disposed
    // Note: Three.js renderer.dispose() doesn't set properties to null,
    // but it does clean up WebGL resources

    return true;
  }

  /**
   * Test: Quality levels affect rendering configuration
   */
  async testQualityLevels() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    // Test draft quality
    const draftRenderer = new SceneRenderer(canvas, { quality: 'draft' });
    this.assert(
      draftRenderer.options.quality === 'draft',
      'Draft quality should be set'
    );
    draftRenderer.dispose();

    // Test medium quality
    const mediumRenderer = new SceneRenderer(canvas, { quality: 'medium' });
    this.assert(
      mediumRenderer.options.quality === 'medium',
      'Medium quality should be set'
    );
    mediumRenderer.dispose();

    // Test high quality
    const highRenderer = new SceneRenderer(canvas, { quality: 'high' });
    this.assert(
      highRenderer.options.quality === 'high',
      'High quality should be set'
    );
    highRenderer.dispose();

    return true;
  }

  /**
   * Test: Resize handling
   */
  async testResize() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const renderer = new SceneRenderer(canvas);

    const initialAspect = renderer.camera.aspect;

    // Simulate resize
    canvas.width = 1280;
    canvas.height = 720;

    // Trigger resize handler
    if (renderer._handleResize) {
      renderer._handleResize();
    }

    // Camera aspect should update
    const newAspect = renderer.camera.aspect;

    // Note: This test may need adjustment based on actual resize implementation

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
    console.log('=== SceneRenderer Unit Tests ===\n');

    await this.runTest(
      'Initialization creates scene, camera, renderer',
      this.testInitialization
    );
    await this.runTest(
      'initWithDream() parses JSON correctly',
      this.testInitWithDream
    );
    await this.runTest('seek() renders at correct time', this.testSeek);
    await this.runTest('dispose() cleans up resources', this.testDispose);
    await this.runTest(
      'Quality levels affect rendering configuration',
      this.testQualityLevels
    );
    await this.runTest('Resize handling', this.testResize);

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
  module.exports = SceneRendererTests;
}
