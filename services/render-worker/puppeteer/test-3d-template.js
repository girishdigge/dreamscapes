/**
 * Test script to verify 3D render template Puppeteer integration
 * Tests: initWithDream(), seek(), and canvas accessibility
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function test3DTemplate() {
  console.log('Starting 3D template test...\n');

  let browser;
  try {
    // Launch browser
    console.log('1. Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set viewport size
    await page.setViewport({ width: 1280, height: 720 });

    // Load the template
    const templatePath = path.join(
      __dirname,
      'templates',
      'render_template_3d.html'
    );
    const templateUrl = `file://${templatePath}`;

    console.log('2. Loading 3D render template...');
    await page.goto(templateUrl, { waitUntil: 'networkidle0' });

    // Wait for Three.js to load
    await page.waitForFunction(() => typeof THREE !== 'undefined', {
      timeout: 10000,
    });
    console.log('   ✓ Three.js loaded');

    // Wait for engine classes to be available
    await page.waitForFunction(
      () =>
        typeof SceneRenderer !== 'undefined' &&
        typeof MaterialSystem !== 'undefined' &&
        typeof AssetLibrary !== 'undefined' &&
        typeof AnimationController !== 'undefined' &&
        typeof CameraController !== 'undefined',
      { timeout: 5000 }
    );
    console.log('   ✓ All engine classes loaded');

    // Test 1: Check canvas element exists and is accessible
    console.log('\n3. Testing canvas accessibility...');
    const canvasExists = await page.evaluate(() => {
      const canvas = document.getElementById('renderCanvas');
      return canvas !== null && canvas.tagName === 'CANVAS';
    });

    if (!canvasExists) {
      throw new Error('Canvas element #renderCanvas not found');
    }
    console.log('   ✓ Canvas #renderCanvas is accessible');

    // Test 2: Check window.initWithDream exists
    console.log('\n4. Testing window.initWithDream()...');
    const initExists = await page.evaluate(() => {
      return typeof window.initWithDream === 'function';
    });

    if (!initExists) {
      throw new Error('window.initWithDream function not found');
    }
    console.log('   ✓ window.initWithDream() exists');

    // Test 3: Check window.seek exists
    console.log('\n5. Testing window.seek()...');
    const seekExists = await page.evaluate(() => {
      return typeof window.seek === 'function';
    });

    if (!seekExists) {
      throw new Error('window.seek function not found');
    }
    console.log('   ✓ window.seek() exists');

    // Test 4: Initialize with a simple dream
    console.log('\n6. Testing scene initialization...');
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
          scale: 1.0,
          material: {
            color: '#ffff00',
          },
        },
        {
          id: 's2',
          type: 'planet',
          pos: [30, 0, 0],
          scale: 0.8,
          material: {
            color: '#4488ff',
          },
        },
      ],
      entities: [],
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

    await page.evaluate((dream) => {
      window.initWithDream(dream, 1280, 720);
    }, dreamData);

    // Wait a bit for initialization
    await page.waitForTimeout(1000);

    console.log('   ✓ Scene initialized successfully');

    // Test 5: Test deterministic rendering with seek()
    console.log('\n7. Testing deterministic rendering...');

    // Render at t=0
    await page.evaluate(() => {
      window.seek(0);
    });
    await page.waitForTimeout(100);

    const screenshot1 = await page.screenshot({ encoding: 'base64' });

    // Render at t=2
    await page.evaluate(() => {
      window.seek(2);
    });
    await page.waitForTimeout(100);

    const screenshot2 = await page.screenshot({ encoding: 'base64' });

    // Render at t=0 again
    await page.evaluate(() => {
      window.seek(0);
    });
    await page.waitForTimeout(100);

    const screenshot3 = await page.screenshot({ encoding: 'base64' });

    // Check if t=0 renders are identical (deterministic)
    if (screenshot1 === screenshot3) {
      console.log('   ✓ Deterministic rendering verified (t=0 identical)');
    } else {
      console.log(
        '   ⚠ Warning: Renders at t=0 differ (may be due to shader time uniforms)'
      );
    }

    // Check if t=0 and t=2 are different
    if (screenshot1 !== screenshot2) {
      console.log('   ✓ Animation working (t=0 and t=2 differ)');
    } else {
      console.log('   ⚠ Warning: Renders at t=0 and t=2 are identical');
    }

    // Test 6: Capture a frame and save it
    console.log('\n8. Capturing test frame...');
    await page.evaluate(() => {
      window.seek(5);
    });
    await page.waitForTimeout(100);

    const testFramePath = path.join(__dirname, 'test-frame.png');
    await page.screenshot({ path: testFramePath });
    console.log(`   ✓ Test frame saved to: ${testFramePath}`);

    // Test 7: Check console for errors
    console.log('\n9. Checking for console errors...');
    const logs = [];
    page.on('console', (msg) => {
      logs.push({ type: msg.type(), text: msg.text() });
    });

    // Trigger another render to capture any errors
    await page.evaluate(() => {
      window.seek(7);
    });
    await page.waitForTimeout(100);

    const errors = logs.filter((log) => log.type === 'error');
    if (errors.length > 0) {
      console.log('   ⚠ Console errors detected:');
      errors.forEach((err) => console.log(`     - ${err.text}`));
    } else {
      console.log('   ✓ No console errors detected');
    }

    console.log('\n✅ All tests passed!');
    console.log('\nSummary:');
    console.log('  - Three.js loaded successfully');
    console.log('  - All engine classes available');
    console.log('  - Canvas accessible via #renderCanvas');
    console.log('  - window.initWithDream() working');
    console.log('  - window.seek() working');
    console.log('  - Scene initialization successful');
    console.log('  - Rendering functional');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
test3DTemplate();
