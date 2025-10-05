/**
 * Test script to verify cinematic scenes are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🎬 Testing Cinematic Scenes Implementation\n');

// Test 1: Verify all JSON files exist and are valid
console.log('Test 1: Validating JSON files...');
const sceneFiles = [
  'star_collision.json',
  'titanic_ocean_voyage.json',
  'volcano_eruption.json',
  'floating_library_books.json',
  'growing_house_tree.json',
];

let allValid = true;

sceneFiles.forEach((filename) => {
  const filePath = path.join(__dirname, 'sample_dreams', filename);

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Check required fields
    const hasId = !!data.id;
    const hasTitle = !!data.title;
    const hasStyle = !!data.style;
    const hasCamera = Array.isArray(data.camera);
    const hasStructures = Array.isArray(data.structures);
    const hasEnvironment = !!data.environment;
    const hasRender = !!data.render;

    // Check for entity attachment
    const entitiesWithAttachment =
      data.entities?.filter((e) => e.motion?.attachTo).length || 0;

    // Check for camera tracking
    const camerasWithTarget = data.camera?.filter((c) => c.target).length || 0;

    console.log(`  ✅ ${filename}`);
    console.log(`     - ID: ${data.id}`);
    console.log(`     - Title: ${data.title}`);
    console.log(`     - Style: ${data.style}`);
    console.log(
      `     - Camera shots: ${
        data.camera?.length || 0
      } (${camerasWithTarget} with tracking)`
    );
    console.log(`     - Structures: ${data.structures?.length || 0}`);
    console.log(
      `     - Entities: ${
        data.entities?.length || 0
      } (${entitiesWithAttachment} attached)`
    );
    console.log(`     - Events: ${data.events?.length || 0}`);

    if (
      !hasId ||
      !hasTitle ||
      !hasStyle ||
      !hasCamera ||
      !hasStructures ||
      !hasEnvironment ||
      !hasRender
    ) {
      console.log(`     ⚠️  Missing required fields`);
      allValid = false;
    }
  } catch (error) {
    console.log(`  ❌ ${filename}: ${error.message}`);
    allValid = false;
  }

  console.log('');
});

// Test 2: Verify engine files exist
console.log('\nTest 2: Verifying engine files...');
const engineFiles = [
  'services/render-worker/puppeteer/engine/EntityRenderer.js',
  'services/render-worker/puppeteer/engine/StructureRenderer.js',
  'services/render-worker/puppeteer/engine/SceneRenderer.js',
  'services/render-worker/puppeteer/engine/MaterialSystem.js',
  'services/render-worker/puppeteer/engine/AnimationController.js',
  'services/render-worker/puppeteer/engine/CameraController.js',
  'services/render-worker/puppeteer/engine/AssetLibrary.js',
];

engineFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(
      `  ✅ ${path.basename(file)} (${(stats.size / 1024).toFixed(2)} KB)`
    );
  } else {
    console.log(`  ❌ ${path.basename(file)} - NOT FOUND`);
    allValid = false;
  }
});

// Test 3: Verify template was rebuilt
console.log('\nTest 3: Verifying render template...');
const templatePath = path.join(
  __dirname,
  'services/render-worker/puppeteer/templates/render_template_3d.html'
);

if (fs.existsSync(templatePath)) {
  const content = fs.readFileSync(templatePath, 'utf8');
  const hasEntityRenderer = content.includes('EntityRenderer');
  const hasStructureRenderer = content.includes('StructureRenderer');
  const hasSceneRenderer = content.includes('SceneRenderer');

  console.log(
    `  ✅ Template exists (${(content.length / 1024).toFixed(2)} KB)`
  );
  console.log(`     - EntityRenderer: ${hasEntityRenderer ? '✅' : '❌'}`);
  console.log(
    `     - StructureRenderer: ${hasStructureRenderer ? '✅' : '❌'}`
  );
  console.log(`     - SceneRenderer: ${hasSceneRenderer ? '✅' : '❌'}`);

  if (!hasEntityRenderer || !hasStructureRenderer || !hasSceneRenderer) {
    console.log(
      `     ⚠️  Template may need to be rebuilt: node services/render-worker/puppeteer/build-template.js`
    );
    allValid = false;
  }
} else {
  console.log(`  ❌ Template not found`);
  allValid = false;
}

// Test 4: Verify frontend integration
console.log('\nTest 4: Verifying frontend integration...');
const frontendFiles = [
  'services/frontend/next-app/app/components/SampleDreams.tsx',
  'services/frontend/next-app/app/api/sample-dreams/[filename]/route.ts',
  'services/frontend/next-app/app/types/dream.ts',
];

frontendFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${path.basename(file)}`);
  } else {
    console.log(`  ❌ ${path.basename(file)} - NOT FOUND`);
    allValid = false;
  }
});

// Test 5: Check for specific features in scenes
console.log('\nTest 5: Verifying scene features...');

const featureTests = [
  {
    file: 'star_collision.json',
    tests: [
      {
        name: 'Stars with motion',
        check: (d) => d.structures?.some((s) => s.motion?.type === 'move_to'),
      },
      {
        name: 'Particle flow between',
        check: (d) =>
          d.entities?.some((e) => e.motion?.type === 'flow_between'),
      },
      {
        name: 'Explosion event',
        check: (d) => d.events?.some((e) => e.type === 'explosion'),
      },
      {
        name: 'Camera tracking',
        check: (d) => d.camera?.some((c) => c.target),
      },
    ],
  },
  {
    file: 'titanic_ocean_voyage.json',
    tests: [
      {
        name: 'Ship with move_along',
        check: (d) =>
          d.structures?.some((s) => s.motion?.type === 'move_along'),
      },
      {
        name: 'Entities attached to ship',
        check: (d) =>
          d.entities?.some((e) => e.motion?.attachTo === 'titanic_ship'),
      },
      {
        name: 'Trail motion',
        check: (d) => d.entities?.some((e) => e.motion?.type === 'trail'),
      },
      {
        name: 'Camera tracking ship',
        check: (d) => d.camera?.some((c) => c.target === 'titanic_ship'),
      },
    ],
  },
  {
    file: 'volcano_eruption.json',
    tests: [
      {
        name: 'Entities attached to volcano',
        check: (d) =>
          d.entities?.some((e) => e.motion?.attachTo === 'volcano_main'),
      },
      { name: 'Multiple events', check: (d) => d.events?.length >= 3 },
      {
        name: 'Environment change event',
        check: (d) => d.events?.some((e) => e.type === 'environment_change'),
      },
      {
        name: 'Camera tracking volcano',
        check: (d) => d.camera?.every((c) => c.target === 'volcano_main'),
      },
    ],
  },
  {
    file: 'floating_library_books.json',
    tests: [
      {
        name: 'Book swarm',
        check: (d) => d.entities?.some((e) => e.type === 'book_swarm'),
      },
      {
        name: 'Swarm attached to library',
        check: (d) =>
          d.entities?.some((e) => e.motion?.attachTo === 'library_main'),
      },
      {
        name: 'Split behavior',
        check: (d) => d.entities?.some((e) => e.motion?.behaviors),
      },
      {
        name: 'Camera tracking library',
        check: (d) => d.camera?.every((c) => c.target === 'library_main'),
      },
    ],
  },
  {
    file: 'growing_house_tree.json',
    tests: [
      {
        name: 'Scale animation',
        check: (d) => d.structures?.some((s) => s.animation?.type === 'scale'),
      },
      {
        name: 'Spawn events',
        check: (d) => d.events?.some((e) => e.type === 'spawn_entity'),
      },
      {
        name: 'Butterflies attach to house',
        check: (d) =>
          d.events?.some((e) => e.params?.motion?.attachTo === 'growing_house'),
      },
      {
        name: 'Camera tracking house',
        check: (d) => d.camera?.every((c) => c.target === 'growing_house'),
      },
    ],
  },
];

featureTests.forEach(({ file, tests }) => {
  const filePath = path.join(__dirname, 'sample_dreams', file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`  ${file}:`);
  tests.forEach(({ name, check }) => {
    const passed = check(data);
    console.log(`     ${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allValid = false;
  });
});

// Final summary
console.log('\n' + '='.repeat(60));
if (allValid) {
  console.log('✅ All tests passed! Cinematic scenes are ready to use.');
  console.log('\nNext steps:');
  console.log('1. Start render-worker: cd services/render-worker && npm start');
  console.log(
    '2. Start frontend: cd services/frontend/next-app && npm run dev'
  );
  console.log('3. Open http://localhost:3000');
  console.log('4. Click on any sample dream in "Try These Cinematic Dreams"');
} else {
  console.log('❌ Some tests failed. Please review the errors above.');
  process.exit(1);
}
console.log('='.repeat(60));
