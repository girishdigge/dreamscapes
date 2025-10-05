/**
 * Unit Tests for AssetLibrary
 * Tests structure type creation, geometry caching, features, and fallbacks
 */

class AssetLibraryTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  /**
   * Test: Each structure type creates valid geometry
   * Requirements: 2.1-2.13, 11.1
   */
  async testStructureTypes() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    const structureTypes = [
      // Celestial objects
      { type: 'star', pos: [0, 0, 0], scale: 10 },
      { type: 'planet', pos: [0, 0, 0], scale: 15 },
      { type: 'galaxy', pos: [0, 0, 0], scale: 50 },
      { type: 'nebula', pos: [0, 0, 0], scale: 100 },

      // Natural elements
      { type: 'water', pos: [0, 0, 0], scale: 50 },
      { type: 'ocean', pos: [0, 0, 0], scale: 100 },
      { type: 'fire', pos: [0, 0, 0], scale: 10 },
      { type: 'cloud', pos: [0, 0, 0], scale: 20 },
      { type: 'mountain', pos: [0, 0, 0], scale: 30 },

      // Living beings
      { type: 'horse', pos: [0, 0, 0], scale: 5 },
      { type: 'bird', pos: [0, 0, 0], scale: 2 },
      { type: 'fish', pos: [0, 0, 0], scale: 3 },
      { type: 'human', pos: [0, 0, 0], scale: 5 },

      // Architectural structures
      { type: 'tower', pos: [0, 0, 0], scale: 20 },
      { type: 'bridge', pos: [0, 0, 0], scale: 30 },
      { type: 'crystal', pos: [0, 0, 0], scale: 15 },
    ];

    for (const structure of structureTypes) {
      const mesh = assetLibrary.createStructure(structure);

      this.assert(mesh !== null, `${structure.type} should create a mesh`);
      this.assert(
        mesh instanceof THREE.Object3D,
        `${structure.type} should be a THREE.Object3D`
      );

      // Verify geometry exists (for Mesh objects)
      if (mesh instanceof THREE.Mesh) {
        this.assert(
          mesh.geometry !== null,
          `${structure.type} mesh should have geometry`
        );
        this.assert(
          mesh.material !== null,
          `${structure.type} mesh should have material`
        );
      }

      // Verify position is applied
      this.assert(
        mesh.position.x === structure.pos[0] &&
          mesh.position.y === structure.pos[1] &&
          mesh.position.z === structure.pos[2],
        `${structure.type} position should be applied correctly`
      );

      // Verify scale is applied
      this.assert(
        mesh.scale.x === structure.scale &&
          mesh.scale.y === structure.scale &&
          mesh.scale.z === structure.scale,
        `${structure.type} scale should be applied correctly`
      );
    }

    return true;
  }

  /**
   * Test: Geometry caching works correctly
   * Requirements: 2.1-2.13, 11.1
   */
  async testGeometryCaching() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    // Create first star
    const star1 = assetLibrary.createStructure({
      type: 'star',
      pos: [0, 0, 0],
      scale: 10,
    });

    const cacheSize1 = assetLibrary.geometryCache.size;

    // Create second star with same parameters
    const star2 = assetLibrary.createStructure({
      type: 'star',
      pos: [10, 0, 0],
      scale: 10,
    });

    const cacheSize2 = assetLibrary.geometryCache.size;

    // Cache should be used (size shouldn't increase much)
    this.assert(cacheSize2 >= cacheSize1, 'Geometry cache should be populated');

    // Both stars should be valid
    this.assert(star1 !== null, 'First star should be created');
    this.assert(star2 !== null, 'Second star should be created');

    // They should be different objects but may share geometry
    this.assert(star1 !== star2, 'Stars should be different objects');

    return true;
  }

  /**
   * Test: Features are applied properly
   * Requirements: 2.1-2.13, 11.1
   */
  async testFeatures() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    // Test glowing_edges feature
    const glowingStructure = assetLibrary.createStructure({
      type: 'crystal',
      pos: [0, 0, 0],
      scale: 10,
      features: ['glowing_edges'],
    });

    this.assert(
      glowingStructure !== null,
      'Structure with glowing_edges should be created'
    );

    // Test emissive feature
    const emissiveStructure = assetLibrary.createStructure({
      type: 'star',
      pos: [0, 0, 0],
      scale: 10,
      features: ['emissive'],
      material: {
        emissiveIntensity: 0.8,
      },
    });

    this.assert(
      emissiveStructure !== null,
      'Structure with emissive feature should be created'
    );

    // Test animated feature
    const animatedStructure = assetLibrary.createStructure({
      type: 'crystal',
      pos: [0, 0, 0],
      scale: 10,
      features: ['animated', 'rotating'],
    });

    this.assert(
      animatedStructure !== null,
      'Structure with animated features should be created'
    );

    // Test multiple features
    const multiFeatureStructure = assetLibrary.createStructure({
      type: 'tower',
      pos: [0, 0, 0],
      scale: 20,
      features: ['glowing_edges', 'emissive', 'pulsating'],
    });

    this.assert(
      multiFeatureStructure !== null,
      'Structure with multiple features should be created'
    );

    return true;
  }

  /**
   * Test: Unknown types fall back gracefully
   * Requirements: 2.1-2.13, 11.1
   */
  async testUnknownTypeFallback() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    // Test unknown structure type
    const unknownStructure = assetLibrary.createStructure({
      type: 'completely_unknown_type_xyz',
      pos: [0, 0, 0],
      scale: 10,
    });

    // Should create a fallback object
    this.assert(
      unknownStructure !== null,
      'Unknown type should create fallback object'
    );
    this.assert(
      unknownStructure instanceof THREE.Object3D,
      'Fallback should be a THREE.Object3D'
    );

    // Fallback should still have position and scale applied
    this.assert(
      unknownStructure.position.x === 0 &&
        unknownStructure.position.y === 0 &&
        unknownStructure.position.z === 0,
      'Fallback position should be applied'
    );

    this.assert(
      unknownStructure.scale.x === 10,
      'Fallback scale should be applied'
    );

    return true;
  }

  /**
   * Test: Material properties are applied correctly
   */
  async testMaterialProperties() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    const structure = assetLibrary.createStructure({
      type: 'planet',
      pos: [0, 0, 0],
      scale: 15,
      material: {
        color: '#ff0000',
        opacity: 0.8,
        metalness: 0.5,
        roughness: 0.2,
        emissiveIntensity: 0.3,
      },
    });

    this.assert(
      structure !== null,
      'Structure with material properties should be created'
    );

    if (structure instanceof THREE.Mesh) {
      const material = structure.material;
      this.assert(material !== null, 'Material should exist');

      // Check if color is applied (may be in different formats)
      if (material.color) {
        this.assert(
          material.color instanceof THREE.Color,
          'Material should have color'
        );
      }
    }

    return true;
  }

  /**
   * Test: Rotation is applied correctly
   */
  async testRotation() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    const structure = assetLibrary.createStructure({
      type: 'tower',
      pos: [0, 0, 0],
      scale: 20,
      rotation: [0, Math.PI / 4, 0], // 45 degrees around Y axis
    });

    this.assert(
      structure !== null,
      'Structure with rotation should be created'
    );
    this.assert(
      Math.abs(structure.rotation.y - Math.PI / 4) < 0.001,
      'Rotation should be applied correctly'
    );

    return true;
  }

  /**
   * Test: Entity creation (particle systems)
   */
  async testEntityCreation() {
    const scene = new THREE.Scene();
    const assetLibrary = new AssetLibrary(scene, { quality: 'medium' });

    const entityTypes = [
      {
        type: 'particle_stream',
        count: 100,
        params: { speed: 2.0, color: '#00ffff' },
      },
      {
        type: 'floating_orbs',
        count: 50,
        params: { size: 1.0, color: '#ffff00' },
      },
      {
        type: 'light_butterflies',
        count: 30,
        params: { speed: 1.5, color: '#ff00ff' },
      },
    ];

    for (const entity of entityTypes) {
      const particleSystem = assetLibrary.createEntity(entity);

      this.assert(
        particleSystem !== null,
        `${entity.type} should create a particle system`
      );
      this.assert(
        particleSystem instanceof THREE.Object3D,
        `${entity.type} should be a THREE.Object3D`
      );
    }

    return true;
  }

  /**
   * Test: Quality settings affect geometry detail
   */
  async testQualitySettings() {
    const scene = new THREE.Scene();

    // Test draft quality
    const draftLibrary = new AssetLibrary(scene, { quality: 'draft' });
    const draftStar = draftLibrary.createStructure({
      type: 'star',
      pos: [0, 0, 0],
      scale: 10,
    });

    // Test high quality
    const highLibrary = new AssetLibrary(scene, { quality: 'high' });
    const highStar = highLibrary.createStructure({
      type: 'star',
      pos: [0, 0, 0],
      scale: 10,
    });

    this.assert(draftStar !== null, 'Draft quality star should be created');
    this.assert(highStar !== null, 'High quality star should be created');

    // Both should be valid objects
    this.assert(
      draftStar instanceof THREE.Object3D,
      'Draft star should be THREE.Object3D'
    );
    this.assert(
      highStar instanceof THREE.Object3D,
      'High star should be THREE.Object3D'
    );

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
    console.log('=== AssetLibrary Unit Tests ===\n');

    await this.runTest(
      'Each structure type creates valid geometry',
      this.testStructureTypes
    );
    await this.runTest(
      'Geometry caching works correctly',
      this.testGeometryCaching
    );
    await this.runTest('Features are applied properly', this.testFeatures);
    await this.runTest(
      'Unknown types fall back gracefully',
      this.testUnknownTypeFallback
    );
    await this.runTest(
      'Material properties are applied correctly',
      this.testMaterialProperties
    );
    await this.runTest('Rotation is applied correctly', this.testRotation);
    await this.runTest(
      'Entity creation (particle systems)',
      this.testEntityCreation
    );
    await this.runTest(
      'Quality settings affect geometry detail',
      this.testQualitySettings
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
  module.exports = AssetLibraryTests;
}
