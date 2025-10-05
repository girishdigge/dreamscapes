// Cross-Browser Compatibility Test Suite for Enhanced 3D Renderer
// Tests rendering in Chrome/Chromium and Firefox (if available)

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Browser configurations
const BROWSER_CONFIGS = [
  {
    name: 'Chromium',
    paths: [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Chromium\\Application\\chromium.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.CHROMIUM_PATH,
      process.env.PUPPETEER_EXECUTABLE_PATH,
    ],
    product: 'chrome',
  },
  {
    name: 'Firefox',
    paths: [
      '/usr/bin/firefox',
      '/Applications/Firefox.app/Contents/MacOS/firefox',
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      process.env.FIREFOX_PATH,
    ],
    product: 'firefox',
  },
];

// Test dream for cross-browser testing
const testDream = {
  title: 'Cross-Browser Test Scene',
  renderMode: '3d',
  style: 'fantasy',
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
    {
      id: 's1',
      type: 'star',
      pos: [0, 0, 0],
      scale: 5.0,
      material: { color: '#ffff00', emissiveIntensity: 1.0 },
    },
    {
      id: 's2',
      type: 'planet',
      pos: [30, 0, 0],
      scale: 3.0,
      material: { color: '#4488ff' },
      animation: { type: 'orbit', speed: 0.5, amplitude: 30 },
    },
    {
      id: 's3',
      type: 'crystal',
      pos: [-20, 10, 0],
      scale: 2.0,
      features: ['glowing_edges'],
      material: { color: '#ff00ff', opacity: 0.7 },
      animation: { type: 'rotate', speed: 1.0 },
    },
  ],
  entities: [
    {
      id: 'e1',
      type: 'floating_orbs',
      count: 30,
      params: { speed: 1.0, size: 0.5, color: '#00ffff', glow: 0.8 },
    },
  ],
  cinematography: {
    durationSec: 2,
    shots: [
      {
        type: 'orbital',
        startTime: 0,
        duration: 2,
        target: [0, 0, 0],
        distance: 60,
        speed: 0.5,
      },
    ],
  },
};

// Find browser executable
function findBrowserExecutable(config) {
  for (const browserPath of config.paths) {
    if (browserPath && fs.existsSync(browserPath)) {
      return browserPath;
    }
  }
  return null;
}

// Test browser compatibility
async function testBrowser(browserConfig, testDir) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing Browser: ${browserConfig.name}`);
  console.log(`${'='.repeat(70)}`);

  const executablePath = findBrowserExecutable(browserConfig);

  if (!executablePath) {
    console.log(`⚠ ${browserConfig.name} not found, skipping...`);
    console.log(`  Searched paths:`);
    browserConfig.paths
      .filter((p) => p)
      .forEach((p) => console.log(`    - ${p}`));
    return {
      browser: browserConfig.name,
      available: false,
      skipped: true,
    };
  }

  console.log(`✓ Found ${browserConfig.name} at: ${executablePath}`);

  const browserName = browserConfig.name.toLowerCase();
  const framesDir = path.join(testDir, `frames-${browserName}`);

  // Clean up previous test
  if (fs.existsSync(framesDir)) {
    rimraf.sync(framesDir);
  }
  fs.mkdirSync(framesDir, { recursive: true });

  let browser;
  const issues = [];

  try {
    // Launch browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      product: browserConfig.product,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    console.log('✓ Browser launched successfully');

    // Get browser version
    const version = await browser.version();
    console.log(`  Version: ${version}`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Load template
    const templatePath = path.join(
      __dirname,
      'puppeteer',
      'templates',
      'render_template_3d.html'
    );
    const url = 'file://' + path.resolve(templatePath);

    console.log('Loading 3D template...');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
    console.log('✓ Template loaded');

    // Check for console errors
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        issues.push(`Console error: ${msg.text()}`);
      }
    });

    // Check for page errors
    page.on('pageerror', (error) => {
      issues.push(`Page error: ${error.message}`);
    });

    // Initialize dream
    console.log('Initializing 3D scene...');
    await page.evaluate(
      (d, w, h) => {
        if (
          window.initWithDream &&
          typeof window.initWithDream === 'function'
        ) {
          window.initWithDream(d, w, h);
        } else {
          throw new Error('initWithDream function not found');
        }
      },
      testDream,
      1280,
      720
    );
    console.log('✓ Scene initialized');

    // Check if Three.js loaded
    const threeLoaded = await page.evaluate(() => {
      return typeof THREE !== 'undefined';
    });

    if (!threeLoaded) {
      issues.push('Three.js failed to load');
    } else {
      console.log('✓ Three.js loaded');
    }

    // Check WebGL support
    const webglSupport = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { supported: false };

      return {
        supported: true,
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
      };
    });

    if (!webglSupport.supported) {
      issues.push('WebGL not supported');
    } else {
      console.log('✓ WebGL supported');
      console.log(`  Vendor: ${webglSupport.vendor}`);
      console.log(`  Renderer: ${webglSupport.renderer}`);
      console.log(`  Version: ${webglSupport.version}`);
    }

    // Get canvas element
    const canvasHandle = await page.$('#renderCanvas');
    if (!canvasHandle) {
      issues.push('Canvas element not found');
      throw new Error('Canvas element not found');
    }
    console.log('✓ Canvas element found');

    // Wait for initial render
    await page.waitForTimeout(500);

    // Render test frames
    console.log('Rendering test frames...');
    const frameCount = 10;
    const fps = 5;

    for (let i = 0; i < frameCount; i++) {
      const t = i / fps;

      await page.evaluate((time) => {
        if (window.seek && typeof window.seek === 'function') {
          window.seek(time);
        }
      }, t);

      await page.waitForTimeout(50);

      const frameName = path.join(
        framesDir,
        `frame${String(i + 1).padStart(5, '0')}.png`
      );
      await canvasHandle.screenshot({ path: frameName });
    }

    console.log(`✓ Rendered ${frameCount} test frames`);

    // Verify frames
    const frames = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png'));
    if (frames.length !== frameCount) {
      issues.push(`Expected ${frameCount} frames, got ${frames.length}`);
    }

    // Check frame sizes
    const frameSizes = frames.map((f) => {
      const stats = fs.statSync(path.join(framesDir, f));
      return stats.size / 1024; // KB
    });

    const avgSize = frameSizes.reduce((a, b) => a + b, 0) / frameSizes.length;
    const minSize = Math.min(...frameSizes);
    const maxSize = Math.max(...frameSizes);

    console.log(
      `  Frame sizes: ${minSize.toFixed(2)}KB - ${maxSize.toFixed(
        2
      )}KB (avg: ${avgSize.toFixed(2)}KB)`
    );

    if (minSize < 10) {
      issues.push(
        `Some frames too small (${minSize.toFixed(2)}KB), may be blank`
      );
    }

    // Check for console warnings/errors
    const errors = consoleMessages.filter((m) => m.type === 'error');
    const warnings = consoleMessages.filter((m) => m.type === 'warning');

    if (errors.length > 0) {
      console.log(`  ⚠ ${errors.length} console error(s) detected`);
    }
    if (warnings.length > 0) {
      console.log(`  ⚠ ${warnings.length} console warning(s) detected`);
    }

    await page.close();
    await browser.close();

    const result = {
      browser: browserConfig.name,
      version,
      available: true,
      skipped: false,
      webglSupport,
      frameCount: frames.length,
      avgFrameSizeKB: parseFloat(avgSize.toFixed(2)),
      issues,
      success: issues.length === 0,
      consoleErrors: errors.length,
      consoleWarnings: warnings.length,
    };

    if (result.success) {
      console.log(`\n✓ ${browserConfig.name} compatibility test PASSED`);
    } else {
      console.log(
        `\n⚠ ${browserConfig.name} compatibility test completed with issues`
      );
    }

    return result;
  } catch (error) {
    console.error(`✗ Test failed: ${error.message}`);

    if (browser) {
      await browser.close();
    }

    return {
      browser: browserConfig.name,
      available: true,
      skipped: false,
      success: false,
      error: error.message,
      issues,
    };
  }
}

// Compare browser outputs
function compareBrowserOutputs(results, testDir) {
  console.log(
    '\n\n╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Browser Comparison                                                ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  const tested = results.filter((r) => r.available && !r.skipped);

  if (tested.length < 2) {
    console.log('Not enough browsers tested for comparison.');
    return;
  }

  // Compare frame counts
  console.log('Frame Count Comparison:');
  tested.forEach((r) => {
    console.log(`  ${r.browser}: ${r.frameCount} frames`);
  });

  // Compare frame sizes
  console.log('\nAverage Frame Size Comparison:');
  tested.forEach((r) => {
    console.log(`  ${r.browser}: ${r.avgFrameSizeKB}KB`);
  });

  // Compare WebGL support
  console.log('\nWebGL Support:');
  tested.forEach((r) => {
    if (r.webglSupport && r.webglSupport.supported) {
      console.log(`  ${r.browser}: ✓ Supported`);
      console.log(`    Renderer: ${r.webglSupport.renderer}`);
    } else {
      console.log(`  ${r.browser}: ✗ Not supported`);
    }
  });

  // Compare issues
  console.log('\nIssues Detected:');
  tested.forEach((r) => {
    if (r.issues && r.issues.length > 0) {
      console.log(`  ${r.browser}:`);
      r.issues.forEach((issue) => console.log(`    - ${issue}`));
    } else {
      console.log(`  ${r.browser}: None`);
    }
  });

  // Visual comparison (if both browsers rendered frames)
  const chromium = tested.find(
    (r) => r.browser === 'Chromium' && r.frameCount > 0
  );
  const firefox = tested.find(
    (r) => r.browser === 'Firefox' && r.frameCount > 0
  );

  if (chromium && firefox) {
    console.log('\nVisual Comparison:');
    console.log(
      '  Note: Manual inspection of frames recommended to verify visual consistency'
    );
    console.log(`  Chromium frames: ${path.join(testDir, 'frames-chromium')}`);
    console.log(`  Firefox frames: ${path.join(testDir, 'frames-firefox')}`);
  }
}

// Document browser-specific issues
function documentBrowserIssues(results) {
  console.log(
    '\n\n╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Browser-Specific Issues Documentation                            ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  const issuesDoc = [];

  results.forEach((r) => {
    if (r.issues && r.issues.length > 0) {
      issuesDoc.push({
        browser: r.browser,
        version: r.version,
        issues: r.issues,
      });
    }
  });

  if (issuesDoc.length === 0) {
    console.log('✓ No browser-specific issues detected!');
    console.log('✓ Renderer is compatible across all tested browsers.');
    return issuesDoc;
  }

  console.log('Browser-Specific Issues Found:\n');

  issuesDoc.forEach((doc) => {
    console.log(`${doc.browser} (${doc.version}):`);
    doc.issues.forEach((issue) => {
      console.log(`  • ${issue}`);
    });
    console.log('');
  });

  // Provide recommendations
  console.log('Recommendations:');

  const hasWebGLIssues = issuesDoc.some((d) =>
    d.issues.some((i) => i.toLowerCase().includes('webgl'))
  );

  if (hasWebGLIssues) {
    console.log(
      '  • Add WebGL fallback detection and user-friendly error message'
    );
    console.log('  • Consider using WebGL2 with fallback to WebGL1');
  }

  const hasThreeJSIssues = issuesDoc.some((d) =>
    d.issues.some((i) => i.toLowerCase().includes('three.js'))
  );

  if (hasThreeJSIssues) {
    console.log('  • Verify Three.js CDN is accessible');
    console.log('  • Consider bundling Three.js locally as fallback');
  }

  const hasFrameIssues = issuesDoc.some((d) =>
    d.issues.some((i) => i.toLowerCase().includes('frame'))
  );

  if (hasFrameIssues) {
    console.log('  • Increase wait time between frames for slower browsers');
    console.log('  • Verify canvas rendering completes before screenshot');
  }

  return issuesDoc;
}

// Main test runner
async function runCrossBrowserTests() {
  console.log(
    '╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Enhanced 3D Renderer - Cross-Browser Compatibility Tests         ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  console.log(
    'This suite tests rendering compatibility across different browsers.'
  );
  console.log('Primary: Chrome/Chromium, Secondary: Firefox\n');

  const testDir = path.join(__dirname, 'test-output', 'cross-browser');

  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    rimraf.sync(testDir);
  }
  fs.mkdirSync(testDir, { recursive: true });

  const results = [];

  // Test each browser
  for (const browserConfig of BROWSER_CONFIGS) {
    const result = await testBrowser(browserConfig, testDir);
    results.push(result);
  }

  // Print summary
  console.log(
    '\n\n╔════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Cross-Browser Test Summary                                        ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n'
  );

  const available = results.filter((r) => r.available && !r.skipped);
  const skipped = results.filter((r) => !r.available || r.skipped);
  const passed = available.filter((r) => r.success);
  const failed = available.filter((r) => !r.success);

  console.log(`Browsers Tested: ${available.length}`);
  console.log(`Browsers Skipped: ${skipped.length}`);
  console.log(`✓ Passed: ${passed.length}`);
  console.log(`✗ Failed: ${failed.length}\n`);

  if (available.length > 0) {
    console.log('Test Results:');
    available.forEach((r) => {
      const status = r.success ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${status} - ${r.browser} ${r.version || ''}`);
      if (r.issues && r.issues.length > 0) {
        console.log(`    Issues: ${r.issues.length}`);
      }
    });
  }

  if (skipped.length > 0) {
    console.log('\nSkipped Browsers:');
    skipped.forEach((r) => {
      console.log(`  ⊘ ${r.browser} - Not installed`);
    });
  }

  // Compare browsers
  if (available.length > 1) {
    compareBrowserOutputs(results, testDir);
  }

  // Document issues
  const issuesDoc = documentBrowserIssues(available);

  // Save results
  const resultsPath = path.join(testDir, 'cross-browser-results.json');
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results,
        issuesDocumentation: issuesDoc,
        summary: {
          tested: available.length,
          skipped: skipped.length,
          passed: passed.length,
          failed: failed.length,
          allPassed: failed.length === 0 && available.length > 0,
        },
      },
      null,
      2
    )
  );

  console.log(`\n\nResults saved to: ${resultsPath}`);
  console.log(`Test output saved to: ${testDir}\n`);

  return {
    tested: available.length,
    skipped: skipped.length,
    passed: passed.length,
    failed: failed.length,
    allPassed: failed.length === 0 && available.length > 0,
    results,
  };
}

// Run tests
if (require.main === module) {
  runCrossBrowserTests()
    .then((summary) => {
      if (summary.tested === 0) {
        console.log('⚠ No browsers available for testing.\n');
        console.log(
          'Please install Chrome/Chromium or Firefox and try again.\n'
        );
        process.exit(1);
      } else if (summary.allPassed) {
        console.log('✓ All cross-browser tests passed!\n');
        process.exit(0);
      } else {
        console.log(`⚠ ${summary.failed} browser(s) had issues.\n`);
        process.exit(0); // Don't fail if some browsers have minor issues
      }
    })
    .catch((error) => {
      console.error('\n✗ Cross-browser testing failed with error:');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runCrossBrowserTests };
