#!/usr/bin/env node

/**
 * Node.js Test Runner for Enhanced 3D Renderer
 * Runs all tests using Puppeteer in headless mode
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('='.repeat(70));
  console.log('Enhanced 3D Renderer - Comprehensive Test Suite');
  console.log('='.repeat(70));
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture console output
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        console.error(`❌ ${text}`);
      } else if (type === 'warning') {
        console.warn(`⚠️  ${text}`);
      } else {
        console.log(text);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      console.error(`Page Error: ${error.message}`);
    });

    // Load the test page
    const testPagePath = path.join(__dirname, 'run-all-tests.html');
    const testPageUrl = `file://${testPagePath}`;

    console.log(`Loading test page: ${testPageUrl}`);
    console.log('');

    await page.goto(testPageUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for page to be ready
    await page.waitForFunction(() => typeof runAllTests === 'function', {
      timeout: 10000,
    });

    console.log('Test page loaded successfully');
    console.log('');

    // Run all tests
    const results = await page.evaluate(async () => {
      // Run tests and capture results
      const startTime = Date.now();

      const suites = [
        { name: 'SceneRenderer', Class: SceneRendererTests },
        { name: 'AssetLibrary', Class: AssetLibraryTests },
        { name: 'MaterialSystem', Class: MaterialSystemTests },
        { name: 'AnimationController', Class: AnimationControllerTests },
        { name: 'CameraController', Class: CameraControllerTests },
        { name: 'Integration', Class: IntegrationTests },
        { name: 'VisualRegression', Class: VisualRegressionTests },
      ];

      const allResults = [];
      let totalPassed = 0;
      let totalFailed = 0;

      for (const suite of suites) {
        try {
          const tests = new suite.Class();
          const result = await tests.runAll();

          allResults.push({
            suite: suite.name,
            passed: result.passed,
            failed: result.failed,
            results: result.results,
          });

          totalPassed += result.passed;
          totalFailed += result.failed;
        } catch (error) {
          allResults.push({
            suite: suite.name,
            passed: 0,
            failed: 1,
            error: error.message,
            results: [],
          });
          totalFailed += 1;
        }
      }

      const duration = Date.now() - startTime;

      return {
        suites: allResults,
        totalPassed,
        totalFailed,
        duration,
      };
    });

    // Display results
    console.log('');
    console.log('='.repeat(70));
    console.log('Test Results Summary');
    console.log('='.repeat(70));
    console.log('');

    results.suites.forEach((suite) => {
      const status = suite.failed === 0 ? '✅' : '❌';
      console.log(
        `${status} ${suite.suite}: ${suite.passed} passed, ${suite.failed} failed`
      );

      if (suite.error) {
        console.error(`   Error: ${suite.error}`);
      }

      // Show failed tests
      if (suite.failed > 0) {
        suite.results
          .filter((r) => r.status === 'FAIL')
          .forEach((r) => {
            console.error(`   ✗ ${r.test}`);
            if (r.error) {
              console.error(`     ${r.error}`);
            }
          });
      }
    });

    console.log('');
    console.log('='.repeat(70));
    console.log(
      `Total: ${results.totalPassed + results.totalFailed} tests | ` +
        `✅ ${results.totalPassed} passed | ` +
        `❌ ${results.totalFailed} failed | ` +
        `⏱️  ${(results.duration / 1000).toFixed(2)}s`
    );
    console.log('='.repeat(70));
    console.log('');

    // Generate JSON report
    const reportPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Test report saved to: ${reportPath}`);
    console.log('');

    // Exit with appropriate code
    const exitCode = results.totalFailed > 0 ? 1 : 0;

    if (exitCode === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.error('💥 Some tests failed!');
    }

    await browser.close();
    process.exit(exitCode);
  } catch (error) {
    console.error('Fatal error running tests:', error);
    await browser.close();
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
