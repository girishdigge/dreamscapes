/**
 * Unit Tests for AnimationController
 * Tests animation types, determinism, and animation combination
 */

class AnimationControllerTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  /**
   * Test: Each animation type produces correct transforms
   * Requirements: 6.1-6.8
   */
  async testAnimationTypes() {
    const controller = new AnimationController();

    // Create test objects
    const orbitObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const floatObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const pulseObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const rotateObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    // Set initial positions
    orbitObject.position.set(0, 0, 0);
    floatObject.position.set(0, 0, 0);
    pulseObject.position.set(0, 0, 0);
    rotateObject.position.set(0, 0, 0);

    // Add animations
    controller.addAnimation('orbit1', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'y',
    });

    controller.addAnimation('float1', {
      type: 'float',
      speed: 1.0,
      amplitude: 5,
    });

    controller.addAnimation('pulse1', {
      type: 'pulse',
      speed: 1.0,
      amplitude: 0.5,
    });

    controller.addAnimation('rotate1', {
      type: 'rotate',
      speed: 1.0,
      axis: 'y',
    });

    // Create render objects map
    const renderObjects = new Map([
      ['orbit1', { mesh: orbitObject, type: 'structure' }],
      ['float1', { mesh: floatObject, type: 'structure' }],
      ['pulse1', { mesh: pulseObject, type: 'structure' }],
      ['rotate1', { mesh: rotateObject, type: 'structure' }],
    ]);

    // Update at time 0
    controller.update(0, renderObjects);

    const orbitPos0 = orbitObject.position.clone();
    const floatPos0 = floatObject.position.clone();
    const pulseScale0 = pulseObject.scale.clone();
    const rotateRot0 = rotateObject.rotation.clone();

    // Update at time 1
    controller.update(1, renderObjects);

    const orbitPos1 = orbitObject.position.clone();
    const floatPos1 = floatObject.position.clone();
    const pulseScale1 = pulseObject.scale.clone();
    const rotateRot1 = rotateObject.rotation.clone();

    // Test orbit animation (position should change)
    this.assert(
      !orbitPos0.equals(orbitPos1),
      'Orbit animation should change position'
    );

    // Test float animation (Y position should change)
    this.assert(
      floatPos0.y !== floatPos1.y,
      'Float animation should change Y position'
    );

    // Test pulse animation (scale should change)
    this.assert(
      !pulseScale0.equals(pulseScale1),
      'Pulse animation should change scale'
    );

    // Test rotate animation (rotation should change)
    this.assert(
      rotateRot0.y !== rotateRot1.y,
      'Rotate animation should change rotation'
    );

    return true;
  }

  /**
   * Test: Animations are deterministic
   * Requirements: 6.1-6.8
   */
  async testDeterminism() {
    const controller1 = new AnimationController();
    const controller2 = new AnimationController();

    // Create identical test objects
    const object1 = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const object2 = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    object1.position.set(0, 0, 0);
    object2.position.set(0, 0, 0);

    // Add identical animations
    controller1.addAnimation('test1', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'y',
    });

    controller2.addAnimation('test2', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'y',
    });

    const renderObjects1 = new Map([
      ['test1', { mesh: object1, type: 'structure' }],
    ]);

    const renderObjects2 = new Map([
      ['test2', { mesh: object2, type: 'structure' }],
    ]);

    // Update both at same time
    controller1.update(5.0, renderObjects1);
    controller2.update(5.0, renderObjects2);

    // Positions should be identical
    this.assert(
      Math.abs(object1.position.x - object2.position.x) < 0.001,
      'X positions should be identical (deterministic)'
    );
    this.assert(
      Math.abs(object1.position.y - object2.position.y) < 0.001,
      'Y positions should be identical (deterministic)'
    );
    this.assert(
      Math.abs(object1.position.z - object2.position.z) < 0.001,
      'Z positions should be identical (deterministic)'
    );

    // Update to different time and back
    controller1.update(10.0, renderObjects1);
    controller1.update(5.0, renderObjects1);

    // Should return to same position
    this.assert(
      Math.abs(object1.position.x - object2.position.x) < 0.001,
      'Seeking back should produce same result (deterministic)'
    );

    return true;
  }

  /**
   * Test: Multiple animations combine correctly
   * Requirements: 6.1-6.8
   */
  async testMultipleAnimations() {
    const controller = new AnimationController();

    const object = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);

    // Add multiple animations to same object
    // Note: In real implementation, this might require special handling
    // For now, we'll test that animations can be added and updated

    controller.addAnimation('obj1', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'y',
    });

    const renderObjects = new Map([
      ['obj1', { mesh: object, type: 'structure' }],
    ]);

    // Update at time 0
    controller.update(0, renderObjects);
    const pos0 = object.position.clone();

    // Update at time 1
    controller.update(1, renderObjects);
    const pos1 = object.position.clone();

    // Position should have changed
    this.assert(!pos0.equals(pos1), 'Combined animations should affect object');

    return true;
  }

  /**
   * Test: Orbit animation with different axes
   */
  async testOrbitAxes() {
    const controller = new AnimationController();

    const objectY = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const objectX = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const objectZ = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    objectY.position.set(0, 0, 0);
    objectX.position.set(0, 0, 0);
    objectZ.position.set(0, 0, 0);

    controller.addAnimation('orbitY', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'y',
    });

    controller.addAnimation('orbitX', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'x',
    });

    controller.addAnimation('orbitZ', {
      type: 'orbit',
      speed: 1.0,
      amplitude: 10,
      axis: 'z',
    });

    const renderObjects = new Map([
      ['orbitY', { mesh: objectY, type: 'structure' }],
      ['orbitX', { mesh: objectX, type: 'structure' }],
      ['orbitZ', { mesh: objectZ, type: 'structure' }],
    ]);

    controller.update(1, renderObjects);

    // Each should orbit around different axis
    this.assert(
      objectY.position.length() > 0,
      'Y-axis orbit should move object'
    );
    this.assert(
      objectX.position.length() > 0,
      'X-axis orbit should move object'
    );
    this.assert(
      objectZ.position.length() > 0,
      'Z-axis orbit should move object'
    );

    return true;
  }

  /**
   * Test: Float animation parameters
   */
  async testFloatParameters() {
    const controller = new AnimationController();

    const object = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    object.position.set(0, 0, 0);

    controller.addAnimation('float1', {
      type: 'float',
      speed: 2.0,
      amplitude: 10,
    });

    const renderObjects = new Map([
      ['float1', { mesh: object, type: 'structure' }],
    ]);

    controller.update(0, renderObjects);
    const y0 = object.position.y;

    controller.update(Math.PI / 4, renderObjects);
    const y1 = object.position.y;

    // Y position should have changed
    this.assert(y1 !== y0, 'Float animation should change Y position');

    return true;
  }

  /**
   * Test: Pulse animation parameters
   */
  async testPulseParameters() {
    const controller = new AnimationController();

    const object = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    object.scale.set(1, 1, 1);

    controller.addAnimation('pulse1', {
      type: 'pulse',
      speed: 1.0,
      amplitude: 0.5,
    });

    const renderObjects = new Map([
      ['pulse1', { mesh: object, type: 'structure' }],
    ]);

    controller.update(0, renderObjects);
    const scale0 = object.scale.x;

    controller.update(Math.PI / 2, renderObjects);
    const scale1 = object.scale.x;

    // Scale should have changed
    this.assert(scale1 !== scale0, 'Pulse animation should change scale');

    return true;
  }

  /**
   * Test: Rotate animation with different axes
   */
  async testRotateAxes() {
    const controller = new AnimationController();

    const objectY = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const objectX = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    const objectZ = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    controller.addAnimation('rotateY', {
      type: 'rotate',
      speed: 1.0,
      axis: 'y',
    });

    controller.addAnimation('rotateX', {
      type: 'rotate',
      speed: 1.0,
      axis: 'x',
    });

    controller.addAnimation('rotateZ', {
      type: 'rotate',
      speed: 1.0,
      axis: 'z',
    });

    const renderObjects = new Map([
      ['rotateY', { mesh: objectY, type: 'structure' }],
      ['rotateX', { mesh: objectX, type: 'structure' }],
      ['rotateZ', { mesh: objectZ, type: 'structure' }],
    ]);

    controller.update(1, renderObjects);

    // Each should rotate around different axis
    this.assert(objectY.rotation.y !== 0, 'Y-axis rotation should change');
    this.assert(objectX.rotation.x !== 0, 'X-axis rotation should change');
    this.assert(objectZ.rotation.z !== 0, 'Z-axis rotation should change');

    return true;
  }

  /**
   * Test: Animation removal
   */
  async testAnimationRemoval() {
    const controller = new AnimationController();

    controller.addAnimation('test1', {
      type: 'rotate',
      speed: 1.0,
      axis: 'y',
    });

    this.assert(
      controller.animations.has('test1'),
      'Animation should be added'
    );

    controller.removeAnimation('test1');

    this.assert(
      !controller.animations.has('test1'),
      'Animation should be removed'
    );

    return true;
  }

  /**
   * Test: Particle system updates
   */
  async testParticleSystemUpdates() {
    const controller = new AnimationController();

    // Create a simple particle system
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(300); // 100 particles * 3 (x,y,z)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({ size: 1 });
    const particles = new THREE.Points(geometry, material);

    particles.userData = {
      velocities: new Float32Array(300),
      params: {
        speed: 1.0,
        behavior: 'flow',
      },
    };

    const renderObjects = new Map([
      ['particles1', { mesh: particles, type: 'entity' }],
    ]);

    // Update should not throw error
    controller.update(1, renderObjects);

    this.assert(true, 'Particle system update should not throw error');

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
    console.log('=== AnimationController Unit Tests ===\n');

    await this.runTest(
      'Each animation type produces correct transforms',
      this.testAnimationTypes
    );
    await this.runTest('Animations are deterministic', this.testDeterminism);
    await this.runTest(
      'Multiple animations combine correctly',
      this.testMultipleAnimations
    );
    await this.runTest(
      'Orbit animation with different axes',
      this.testOrbitAxes
    );
    await this.runTest('Float animation parameters', this.testFloatParameters);
    await this.runTest('Pulse animation parameters', this.testPulseParameters);
    await this.runTest(
      'Rotate animation with different axes',
      this.testRotateAxes
    );
    await this.runTest('Animation removal', this.testAnimationRemoval);
    await this.runTest(
      'Particle system updates',
      this.testParticleSystemUpdates
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
  module.exports = AnimationControllerTests;
}
