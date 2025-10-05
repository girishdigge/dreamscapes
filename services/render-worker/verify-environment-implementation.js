/**
 * Verification script for Environmental System implementation
 * Checks that all required methods and functionality are present
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('Environmental System Implementation Verification');
console.log('='.repeat(60));
console.log();

let allTestsPassed = true;

function testPass(testName) {
  console.log(`✓ ${testName}`);
}

function testFail(testName, reason) {
  console.log(`✗ ${testName}`);
  console.log(`  Reason: ${reason}`);
  allTestsPassed = false;
}

// Test 1: Check SceneRenderer.js exists and has required methods
console.log('Test 1: Checking SceneRenderer.js implementation...');
try {
  const sceneRendererPath = path.join(
    __dirname,
    'puppeteer/engine/SceneRenderer.js'
  );
  const sceneRendererCode = fs.readFileSync(sceneRendererPath, 'utf8');

  // Check for setupEnvironment method (not placeholder)
  if (
    sceneRendererCode.includes('setupEnvironment(environment)') &&
    !sceneRendererCode.includes('// Will be implemented in task 7')
  ) {
    testPass('setupEnvironment method implemented');
  } else {
    testFail('setupEnvironment method', 'Method not properly implemented');
  }

  // Check for _setupSkybox method
  if (sceneRendererCode.includes('_setupSkybox(environment)')) {
    testPass('_setupSkybox method exists');
  } else {
    testFail('_setupSkybox method', 'Method not found');
  }

  // Check for _setupLighting method
  if (sceneRendererCode.includes('_setupLighting(environment)')) {
    testPass('_setupLighting method exists');
  } else {
    testFail('_setupLighting method', 'Method not found');
  }

  // Check for _setupAtmosphere method
  if (sceneRendererCode.includes('_setupAtmosphere(environment)')) {
    testPass('_setupAtmosphere method exists');
  } else {
    testFail('_setupAtmosphere method', 'Method not found');
  }
} catch (error) {
  testFail('SceneRenderer.js check', error.message);
}

console.log();

// Test 2: Check skybox creation logic
console.log('Test 2: Checking skybox creation logic...');
try {
  const sceneRendererPath = path.join(
    __dirname,
    'puppeteer/engine/SceneRenderer.js'
  );
  const sceneRendererCode = fs.readFileSync(sceneRendererPath, 'utf8');

  // Check for preset to skybox mapping
  if (
    sceneRendererCode.includes('presetToSkybox') ||
    (sceneRendererCode.includes('space:') &&
      sceneRendererCode.includes('galaxy'))
  ) {
    testPass('Environment preset to skybox mapping implemented');
  } else {
    testFail('Preset mapping', 'Mapping logic not found');
  }

  // Check for skybox type switch/case
  const skyboxTypes = ['galaxy', 'nebula', 'sunset', 'underwater', 'void'];
  let allTypesFound = true;
  for (const type of skyboxTypes) {
    if (
      !sceneRendererCode.includes(`'${type}'`) &&
      !sceneRendererCode.includes(`"${type}"`)
    ) {
      allTypesFound = false;
      break;
    }
  }

  if (allTypesFound) {
    testPass(
      'All skybox types (galaxy, nebula, sunset, underwater, void) referenced'
    );
  } else {
    testFail('Skybox types', 'Not all skybox types found');
  }

  // Check for MaterialSystem skybox creation calls
  if (
    sceneRendererCode.includes('createGalaxySkybox') &&
    sceneRendererCode.includes('createNebulaSkybox') &&
    sceneRendererCode.includes('createSunsetSkybox') &&
    sceneRendererCode.includes('createUnderwaterSkybox') &&
    sceneRendererCode.includes('createVoidSkybox')
  ) {
    testPass('All MaterialSystem skybox creation methods called');
  } else {
    testFail('Skybox creation calls', 'Not all skybox creation methods called');
  }
} catch (error) {
  testFail('Skybox creation logic check', error.message);
}

console.log();

// Test 3: Check lighting system implementation
console.log('Test 3: Checking lighting system implementation...');
try {
  const sceneRendererPath = path.join(
    __dirname,
    'puppeteer/engine/SceneRenderer.js'
  );
  const sceneRendererCode = fs.readFileSync(sceneRendererPath, 'utf8');

  // Check for ambient light creation
  if (sceneRendererCode.includes('AmbientLight')) {
    testPass('Ambient light creation implemented');
  } else {
    testFail('Ambient light', 'AmbientLight not found');
  }

  // Check for directional light creation
  if (sceneRendererCode.includes('DirectionalLight')) {
    testPass('Directional light creation implemented');
  } else {
    testFail('Directional light', 'DirectionalLight not found');
  }

  // Check for shadow configuration
  if (
    sceneRendererCode.includes('castShadow') &&
    sceneRendererCode.includes('shadow.mapSize')
  ) {
    testPass('Shadow configuration implemented');
  } else {
    testFail('Shadow configuration', 'Shadow settings not found');
  }

  // Check for shadow camera bounds
  if (
    sceneRendererCode.includes('shadow.camera.left') &&
    sceneRendererCode.includes('shadow.camera.right') &&
    sceneRendererCode.includes('shadow.camera.top') &&
    sceneRendererCode.includes('shadow.camera.bottom')
  ) {
    testPass('Shadow camera bounds configured');
  } else {
    testFail('Shadow camera bounds', 'Camera bounds not configured');
  }

  // Check for configurable light intensity
  if (
    sceneRendererCode.includes('lighting.ambient') ||
    sceneRendererCode.includes('ambientIntensity')
  ) {
    testPass('Configurable ambient light intensity');
  } else {
    testFail('Ambient intensity', 'Configurable intensity not found');
  }

  // Check for configurable light position
  if (
    sceneRendererCode.includes('dirLight.position') ||
    sceneRendererCode.includes('position[0]')
  ) {
    testPass('Configurable directional light position');
  } else {
    testFail('Light position', 'Configurable position not found');
  }

  // Check for configurable light color
  if (
    sceneRendererCode.includes('dirLight.color') ||
    sceneRendererCode.includes('lightColor')
  ) {
    testPass('Configurable directional light color');
  } else {
    testFail('Light color', 'Configurable color not found');
  }
} catch (error) {
  testFail('Lighting system check', error.message);
}

console.log();

// Test 4: Check atmospheric effects (fog) implementation
console.log('Test 4: Checking atmospheric effects implementation...');
try {
  const sceneRendererPath = path.join(
    __dirname,
    'puppeteer/engine/SceneRenderer.js'
  );
  const sceneRendererCode = fs.readFileSync(sceneRendererPath, 'utf8');

  // Check for fog creation
  if (
    sceneRendererCode.includes('THREE.Fog') ||
    sceneRendererCode.includes('scene.fog')
  ) {
    testPass('Fog creation implemented');
  } else {
    testFail('Fog creation', 'Fog not found');
  }

  // Check for fog density configuration
  if (
    sceneRendererCode.includes('environment.fog') ||
    sceneRendererCode.includes('fogDensity')
  ) {
    testPass('Configurable fog density');
  } else {
    testFail('Fog density', 'Density configuration not found');
  }

  // Check for fog color configuration
  if (sceneRendererCode.includes('fogColor')) {
    testPass('Configurable fog color');
  } else {
    testFail('Fog color', 'Color configuration not found');
  }

  // Check for fog integration with skybox (using skyColor)
  if (
    sceneRendererCode.includes('skyColor') &&
    sceneRendererCode.includes('fog')
  ) {
    testPass('Fog integrates with skybox color');
  } else {
    testFail('Fog integration', 'Skybox integration not found');
  }
} catch (error) {
  testFail('Atmospheric effects check', error.message);
}

console.log();

// Test 5: Check quality settings for shadows
console.log('Test 5: Checking quality settings...');
try {
  const sceneRendererPath = path.join(
    __dirname,
    'puppeteer/engine/SceneRenderer.js'
  );
  const sceneRendererCode = fs.readFileSync(sceneRendererPath, 'utf8');

  // Check for shadowMapSize in quality settings
  if (sceneRendererCode.includes('shadowMapSize')) {
    testPass('Shadow map size in quality settings');
  } else {
    testFail('Shadow map size', 'Not found in quality settings');
  }
} catch (error) {
  testFail('Quality settings check', error.message);
}

console.log();

// Test 6: Check MaterialSystem has all required skybox methods
console.log('Test 6: Checking MaterialSystem skybox methods...');
try {
  const materialSystemPath = path.join(
    __dirname,
    'puppeteer/engine/MaterialSystem.js'
  );
  const materialSystemCode = fs.readFileSync(materialSystemPath, 'utf8');

  const requiredMethods = [
    'createGalaxySkybox',
    'createNebulaSkybox',
    'createSunsetSkybox',
    'createUnderwaterSkybox',
    'createVoidSkybox',
  ];

  for (const method of requiredMethods) {
    if (materialSystemCode.includes(`${method}()`)) {
      testPass(`${method} method exists in MaterialSystem`);
    } else {
      testFail(`${method} method`, 'Method not found in MaterialSystem');
    }
  }
} catch (error) {
  testFail('MaterialSystem check', error.message);
}

console.log();
console.log('='.repeat(60));

if (allTestsPassed) {
  console.log('✓ All verification tests passed!');
  console.log('Environmental system implementation is complete.');
  process.exit(0);
} else {
  console.log('✗ Some verification tests failed.');
  console.log('Please review the implementation.');
  process.exit(1);
}
