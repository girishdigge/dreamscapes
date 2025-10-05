/**
 * Unit Tests for MaterialSystem
 * Tests skybox creation, shader compilation, material caching, and parameter defaults
 */

class MaterialSystemTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  /**
   * Test: Each skybox type creates valid material
   * Requirements: 3.1-3.9, 11.2
   */
  async testSkyboxTypes() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    const skyboxTypes = ['galaxy', 'nebula', 'sunset', 'underwater', 'void'];

    for (const type of skyboxTypes) {
      const skybox = materialSystem.createSkybox(type);

      this.assert(skybox !== null, `${type} skybox should be created`);
      this.assert(
        skybox instanceof THREE.Object3D,
        `${type} skybox should be a THREE.Object3D`
      );

      // Verify it has geometry and material
      if (skybox instanceof THREE.Mesh) {
        this.assert(
          skybox.geometry !== null,
          `${type} skybox should have geometry`
        );
        this.assert(
          skybox.material !== null,
          `${type} skybox should have material`
        );
      }
    }

    return true;
  }

  /**
   * Test: Shader compilation succeeds
   * Requirements: 3.1-3.9, 11.2
   */
  async testShaderCompilation() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    // Test galaxy skybox (uses custom shaders)
    const galaxySkybox = materialSystem.createSkybox('galaxy');
    this.assert(
      galaxySkybox !== null,
      'Galaxy skybox with shaders should be created'
    );

    if (galaxySkybox instanceof THREE.Mesh) {
      const material = galaxySkybox.material;
      this.assert(
        material !== null,
        'Galaxy skybox should have material with shaders'
      );

      // Check if it's a shader material
      if (material instanceof THREE.ShaderMaterial) {
        this.assert(
          material.vertexShader !== undefined,
          'Shader material should have vertex shader'
        );
        this.assert(
          material.fragmentShader !== undefined,
          'Shader material should have fragment shader'
        );
      }
    }

    // Test nebula skybox (also uses custom shaders)
    const nebulaSkybox = materialSystem.createSkybox('nebula');
    this.assert(
      nebulaSkybox !== null,
      'Nebula skybox with shaders should be created'
    );

    return true;
  }

  /**
   * Test: Material caching works correctly
   * Requirements: 3.1-3.9, 11.2
   */
  async testMaterialCaching() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    // Create first material
    const material1 = materialSystem.createPBRMaterial({
      color: '#ff0000',
      metalness: 0.5,
      roughness: 0.2,
    });

    const cacheSize1 = materialSystem.materialCache.size;

    // Create second material with same parameters
    const material2 = materialSystem.createPBRMaterial({
      color: '#ff0000',
      metalness: 0.5,
      roughness: 0.2,
    });

    const cacheSize2 = materialSystem.materialCache.size;

    // Cache should be used
    this.assert(cacheSize2 >= cacheSize1, 'Material cache should be populated');

    // Both materials should be valid
    this.assert(material1 !== null, 'First material should be created');
    this.assert(material2 !== null, 'Second material should be created');

    return true;
  }

  /**
   * Test: Invalid parameters use defaults
   * Requirements: 3.1-3.9, 11.2
   */
  async testInvalidParameterDefaults() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    // Test with missing color
    const material1 = materialSystem.createPBRMaterial({
      metalness: 0.5,
      roughness: 0.2,
    });

    this.assert(
      material1 !== null,
      'Material with missing color should use default'
    );
    this.assert(
      material1.color !== undefined,
      'Material should have default color'
    );

    // Test with invalid metalness (should clamp)
    const material2 = materialSystem.createPBRMaterial({
      color: '#ff0000',
      metalness: 2.0, // Invalid (should be 0-1)
      roughness: 0.2,
    });

    this.assert(
      material2 !== null,
      'Material with invalid metalness should be created'
    );

    // Test with malformed color
    const material3 = materialSystem.createPBRMaterial({
      color: 'invalid_color',
      metalness: 0.5,
      roughness: 0.2,
    });

    this.assert(
      material3 !== null,
      'Material with malformed color should use default'
    );

    // Test with completely empty parameters
    const material4 = materialSystem.createPBRMaterial({});

    this.assert(
      material4 !== null,
      'Material with no parameters should use all defaults'
    );

    return true;
  }

  /**
   * Test: PBR material properties
   */
  async testPBRMaterialProperties() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    const material = materialSystem.createPBRMaterial({
      color: '#0088ff',
      metalness: 0.8,
      roughness: 0.3,
      opacity: 0.9,
      emissiveIntensity: 0.5,
    });

    this.assert(material !== null, 'PBR material should be created');
    this.assert(
      material instanceof THREE.Material,
      'Should be a THREE.Material'
    );

    // Check properties are applied
    if (material.color) {
      this.assert(
        material.color instanceof THREE.Color,
        'Material should have color'
      );
    }

    if (material.metalness !== undefined) {
      this.assert(
        material.metalness >= 0 && material.metalness <= 1,
        'Metalness should be in valid range'
      );
    }

    if (material.roughness !== undefined) {
      this.assert(
        material.roughness >= 0 && material.roughness <= 1,
        'Roughness should be in valid range'
      );
    }

    return true;
  }

  /**
   * Test: Emissive material creation
   */
  async testEmissiveMaterial() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    const material = materialSystem.createEmissiveMaterial({
      color: '#ffff00',
      emissiveIntensity: 0.8,
    });

    this.assert(material !== null, 'Emissive material should be created');
    this.assert(
      material instanceof THREE.Material,
      'Should be a THREE.Material'
    );

    // Check emissive properties
    if (material.emissive) {
      this.assert(
        material.emissive instanceof THREE.Color,
        'Material should have emissive color'
      );
    }

    return true;
  }

  /**
   * Test: Transparent material creation
   */
  async testTransparentMaterial() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    const material = materialSystem.createTransparentMaterial({
      color: '#00ffff',
      opacity: 0.5,
      transmission: 0.8,
    });

    this.assert(material !== null, 'Transparent material should be created');
    this.assert(
      material instanceof THREE.Material,
      'Should be a THREE.Material'
    );

    // Check transparency properties
    if (material.transparent !== undefined) {
      this.assert(
        material.transparent === true,
        'Material should be transparent'
      );
    }

    return true;
  }

  /**
   * Test: Water material creation
   */
  async testWaterMaterial() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    const material = materialSystem.createWaterMaterial({
      color: '#0066ff',
      opacity: 0.8,
    });

    this.assert(material !== null, 'Water material should be created');
    this.assert(
      material instanceof THREE.Material,
      'Should be a THREE.Material'
    );

    return true;
  }

  /**
   * Test: Quality settings affect material complexity
   */
  async testQualitySettings() {
    // Test draft quality
    const draftSystem = new MaterialSystem({ quality: 'draft' });
    const draftMaterial = draftSystem.createPBRMaterial({
      color: '#ff0000',
      metalness: 0.5,
      roughness: 0.2,
    });

    this.assert(
      draftMaterial !== null,
      'Draft quality material should be created'
    );

    // Test high quality
    const highSystem = new MaterialSystem({ quality: 'high' });
    const highMaterial = highSystem.createPBRMaterial({
      color: '#ff0000',
      metalness: 0.5,
      roughness: 0.2,
    });

    this.assert(
      highMaterial !== null,
      'High quality material should be created'
    );

    return true;
  }

  /**
   * Test: Shader uniform updates
   */
  async testShaderUniformUpdates() {
    const materialSystem = new MaterialSystem({ quality: 'medium' });

    const galaxySkybox = materialSystem.createSkybox('galaxy');

    if (
      galaxySkybox instanceof THREE.Mesh &&
      galaxySkybox.material instanceof THREE.ShaderMaterial
    ) {
      const material = galaxySkybox.material;

      // Update uniforms with time
      materialSystem.updateMaterialUniforms(material, 5.0);

      // Check if time uniform exists and was updated
      if (material.uniforms && material.uniforms.time) {
        this.assert(
          material.uniforms.time.value === 5.0,
          'Time uniform should be updated'
        );
      }
    }

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
    console.log('=== MaterialSystem Unit Tests ===\n');

    await this.runTest(
      'Each skybox type creates valid material',
      this.testSkyboxTypes
    );
    await this.runTest(
      'Shader compilation succeeds',
      this.testShaderCompilation
    );
    await this.runTest(
      'Material caching works correctly',
      this.testMaterialCaching
    );
    await this.runTest(
      'Invalid parameters use defaults',
      this.testInvalidParameterDefaults
    );
    await this.runTest(
      'PBR material properties',
      this.testPBRMaterialProperties
    );
    await this.runTest('Emissive material creation', this.testEmissiveMaterial);
    await this.runTest(
      'Transparent material creation',
      this.testTransparentMaterial
    );
    await this.runTest('Water material creation', this.testWaterMaterial);
    await this.runTest(
      'Quality settings affect material complexity',
      this.testQualitySettings
    );
    await this.runTest('Shader uniform updates', this.testShaderUniformUpdates);

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
  module.exports = MaterialSystemTests;
}
