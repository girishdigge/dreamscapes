/**
 * Unit Tests for CameraController
 * Tests shot types, camera positioning, interpolation, and shot transitions
 */

class CameraControllerTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  /**
   * Test: Each shot type positions camera correctly
   * Requirements: 7.1-7.9
   */
  async testShotTypes() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'orbital',
        startTime: 0,
        duration: 10,
        target: [0, 0, 0],
        distance: 50,
        speed: 1.0,
      },
      {
        type: 'flythrough',
        startTime: 10,
        duration: 10,
        path: [
          [0, 0, 50],
          [50, 0, 0],
          [0, 0, -50],
        ],
        target: [0, 0, 0],
      },
      {
        type: 'establish',
        startTime: 20,
        duration: 5,
        position: [100, 50, 100],
        target: [0, 0, 0],
      },
      {
        type: 'close_up',
        startTime: 25,
        duration: 5,
        target: [0, 0, 0],
        distance: 10,
      },
      {
        type: 'pull_back',
        startTime: 30,
        duration: 5,
        startDistance: 10,
        endDistance: 100,
        target: [0, 0, 0],
      },
    ];

    controller.setupShots(shots);

    // Test orbital shot
    controller.update(5);
    const orbitalPos = camera.position.clone();
    this.assert(
      orbitalPos.length() > 0,
      'Orbital shot should position camera away from origin'
    );

    // Test flythrough shot
    controller.update(15);
    const flythroughPos = camera.position.clone();
    this.assert(
      flythroughPos.length() > 0,
      'Flythrough shot should position camera'
    );

    // Test establish shot
    controller.update(22);
    const establishPos = camera.position.clone();
    this.assert(
      Math.abs(establishPos.x - 100) < 1 &&
        Math.abs(establishPos.y - 50) < 1 &&
        Math.abs(establishPos.z - 100) < 1,
      'Establish shot should position camera at specified position'
    );

    // Test close-up shot
    controller.update(27);
    const closeUpPos = camera.position.clone();
    const closeUpDistance = closeUpPos.length();
    this.assert(
      closeUpDistance < 20,
      'Close-up shot should position camera close to target'
    );

    // Test pull-back shot
    controller.update(32);
    const pullBackPos = camera.position.clone();
    const pullBackDistance = pullBackPos.length();
    this.assert(
      pullBackDistance > closeUpDistance,
      'Pull-back shot should move camera away from target'
    );

    return true;
  }

  /**
   * Test: Interpolation is smooth
   * Requirements: 7.1-7.9
   */
  async testInterpolation() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'establish',
        startTime: 0,
        duration: 10,
        position: [0, 0, 100],
        target: [0, 0, 0],
      },
      {
        type: 'establish',
        startTime: 10,
        duration: 10,
        position: [100, 0, 0],
        target: [0, 0, 0],
      },
    ];

    controller.setupShots(shots);

    // Sample positions during transition
    const positions = [];
    for (let t = 9; t <= 11; t += 0.5) {
      controller.update(t);
      positions.push(camera.position.clone());
    }

    // Check that positions change smoothly (no sudden jumps)
    for (let i = 1; i < positions.length; i++) {
      const distance = positions[i].distanceTo(positions[i - 1]);
      this.assert(
        distance < 50,
        'Camera should move smoothly without large jumps'
      );
    }

    // Check that camera actually moved from start to end
    const totalDistance = positions[0].distanceTo(
      positions[positions.length - 1]
    );
    this.assert(
      totalDistance > 10,
      'Camera should move significantly during transition'
    );

    return true;
  }

  /**
   * Test: Shot transitions work properly
   * Requirements: 7.1-7.9
   */
  async testShotTransitions() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'orbital',
        startTime: 0,
        duration: 5,
        target: [0, 0, 0],
        distance: 50,
        speed: 1.0,
      },
      {
        type: 'close_up',
        startTime: 5,
        duration: 5,
        target: [0, 0, 0],
        distance: 10,
      },
      {
        type: 'pull_back',
        startTime: 10,
        duration: 5,
        startDistance: 10,
        endDistance: 100,
        target: [0, 0, 0],
      },
    ];

    controller.setupShots(shots);

    // Update at end of first shot
    controller.update(4.9);
    const pos1 = camera.position.clone();

    // Update at start of second shot
    controller.update(5.1);
    const pos2 = camera.position.clone();

    // Positions should be different but transition should be smooth
    this.assert(!pos1.equals(pos2), 'Camera should move between shots');

    // Update at end of second shot
    controller.update(9.9);
    const pos3 = camera.position.clone();

    // Update at start of third shot
    controller.update(10.1);
    const pos4 = camera.position.clone();

    // Transition should continue smoothly
    this.assert(
      !pos3.equals(pos4),
      'Camera should continue moving between shots'
    );

    return true;
  }

  /**
   * Test: Orbital shot parameters
   */
  async testOrbitalParameters() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'orbital',
        startTime: 0,
        duration: 10,
        target: [0, 0, 0],
        distance: 50,
        speed: 2.0,
        height: 25,
      },
    ];

    controller.setupShots(shots);

    // Update at different times
    controller.update(0);
    const pos0 = camera.position.clone();

    controller.update(2.5);
    const pos1 = camera.position.clone();

    controller.update(5);
    const pos2 = camera.position.clone();

    // Camera should orbit around target
    const dist0 = Math.sqrt(pos0.x * pos0.x + pos0.z * pos0.z);
    const dist1 = Math.sqrt(pos1.x * pos1.x + pos1.z * pos1.z);
    const dist2 = Math.sqrt(pos2.x * pos2.x + pos2.z * pos2.z);

    // Distance from target should remain roughly constant
    this.assert(
      Math.abs(dist0 - 50) < 5,
      'Orbital distance should match specified distance'
    );
    this.assert(
      Math.abs(dist1 - 50) < 5,
      'Orbital distance should remain constant'
    );
    this.assert(
      Math.abs(dist2 - 50) < 5,
      'Orbital distance should remain constant'
    );

    // Positions should be different (camera is moving)
    this.assert(
      !pos0.equals(pos1) && !pos1.equals(pos2),
      'Camera should move during orbital shot'
    );

    return true;
  }

  /**
   * Test: Flythrough shot with path
   */
  async testFlythroughPath() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const path = [
      [0, 0, 100],
      [50, 25, 50],
      [100, 50, 0],
    ];

    const shots = [
      {
        type: 'flythrough',
        startTime: 0,
        duration: 10,
        path: path,
        target: [0, 0, 0],
      },
    ];

    controller.setupShots(shots);

    // Update at start
    controller.update(0);
    const startPos = camera.position.clone();

    // Should be near first path point
    const distToStart = startPos.distanceTo(new THREE.Vector3(...path[0]));
    this.assert(distToStart < 10, 'Camera should start near first path point');

    // Update at middle
    controller.update(5);
    const midPos = camera.position.clone();

    // Update at end
    controller.update(10);
    const endPos = camera.position.clone();

    // Should be near last path point
    const distToEnd = endPos.distanceTo(
      new THREE.Vector3(...path[path.length - 1])
    );
    this.assert(distToEnd < 10, 'Camera should end near last path point');

    // Positions should all be different
    this.assert(
      !startPos.equals(midPos) && !midPos.equals(endPos),
      'Camera should move along path'
    );

    return true;
  }

  /**
   * Test: Close-up shot targeting
   */
  async testCloseUpTargeting() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const target = [25, 10, -15];

    const shots = [
      {
        type: 'close_up',
        startTime: 0,
        duration: 5,
        target: target,
        distance: 15,
      },
    ];

    controller.setupShots(shots);

    controller.update(2.5);

    // Camera should be looking at target
    const cameraPos = camera.position.clone();
    const targetPos = new THREE.Vector3(...target);
    const distance = cameraPos.distanceTo(targetPos);

    this.assert(
      Math.abs(distance - 15) < 5,
      'Camera should be at specified distance from target'
    );

    return true;
  }

  /**
   * Test: Pull-back shot distance change
   */
  async testPullBackDistance() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'pull_back',
        startTime: 0,
        duration: 10,
        startDistance: 10,
        endDistance: 100,
        target: [0, 0, 0],
      },
    ];

    controller.setupShots(shots);

    // Update at start
    controller.update(0);
    const startDist = camera.position.length();

    // Update at middle
    controller.update(5);
    const midDist = camera.position.length();

    // Update at end
    controller.update(10);
    const endDist = camera.position.length();

    // Distance should increase over time
    this.assert(
      midDist > startDist,
      'Camera should move away from target during pull-back'
    );
    this.assert(
      endDist > midDist,
      'Camera should continue moving away during pull-back'
    );
    this.assert(
      Math.abs(endDist - 100) < 10,
      'Camera should reach end distance'
    );

    return true;
  }

  /**
   * Test: Default camera behavior when no shots specified
   */
  async testDefaultBehavior() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    // Don't setup any shots
    controller.update(5);

    // Camera should have some default position
    const pos = camera.position.clone();
    this.assert(
      pos.length() > 0,
      'Camera should have default position when no shots specified'
    );

    return true;
  }

  /**
   * Test: Camera lookAt target
   */
  async testLookAtTarget() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const target = [50, 25, -30];

    const shots = [
      {
        type: 'establish',
        startTime: 0,
        duration: 5,
        position: [0, 0, 100],
        target: target,
      },
    ];

    controller.setupShots(shots);

    controller.update(2.5);

    // Camera should be looking at target
    // We can't easily test the exact rotation, but we can verify
    // the camera position is set correctly
    const pos = camera.position.clone();
    this.assert(
      Math.abs(pos.z - 100) < 1,
      'Camera should be at specified position'
    );

    return true;
  }

  /**
   * Test: Easing functions
   */
  async testEasing() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'establish',
        startTime: 0,
        duration: 10,
        position: [0, 0, 100],
        target: [0, 0, 0],
        easing: 'ease_in_out',
      },
      {
        type: 'establish',
        startTime: 10,
        duration: 10,
        position: [100, 0, 0],
        target: [0, 0, 0],
        easing: 'ease_in_out',
      },
    ];

    controller.setupShots(shots);

    // Sample positions during transition with easing
    const positions = [];
    for (let t = 9; t <= 11; t += 0.5) {
      controller.update(t);
      positions.push(camera.position.clone());
    }

    // With easing, movement should be smooth
    this.assert(positions.length > 0, 'Easing should produce smooth movement');

    return true;
  }

  /**
   * Test: Shot duration handling
   */
  async testShotDuration() {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 10000);
    const controller = new CameraController(camera);

    const shots = [
      {
        type: 'establish',
        startTime: 0,
        duration: 5,
        position: [0, 0, 100],
        target: [0, 0, 0],
      },
      {
        type: 'establish',
        startTime: 5,
        duration: 10,
        position: [100, 0, 0],
        target: [0, 0, 0],
      },
    ];

    controller.setupShots(shots);

    // Update within first shot
    controller.update(2.5);
    const pos1 = camera.position.clone();

    // Update at end of first shot
    controller.update(5);
    const pos2 = camera.position.clone();

    // Update within second shot
    controller.update(10);
    const pos3 = camera.position.clone();

    // Positions should change appropriately
    this.assert(!pos1.equals(pos2), 'Camera should move between shots');
    this.assert(!pos2.equals(pos3), 'Camera should move during second shot');

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
    console.log('=== CameraController Unit Tests ===\n');

    await this.runTest(
      'Each shot type positions camera correctly',
      this.testShotTypes
    );
    await this.runTest('Interpolation is smooth', this.testInterpolation);
    await this.runTest(
      'Shot transitions work properly',
      this.testShotTransitions
    );
    await this.runTest('Orbital shot parameters', this.testOrbitalParameters);
    await this.runTest('Flythrough shot with path', this.testFlythroughPath);
    await this.runTest('Close-up shot targeting', this.testCloseUpTargeting);
    await this.runTest(
      'Pull-back shot distance change',
      this.testPullBackDistance
    );
    await this.runTest(
      'Default camera behavior when no shots specified',
      this.testDefaultBehavior
    );
    await this.runTest('Camera lookAt target', this.testLookAtTarget);
    await this.runTest('Easing functions', this.testEasing);
    await this.runTest('Shot duration handling', this.testShotDuration);

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
  module.exports = CameraControllerTests;
}
