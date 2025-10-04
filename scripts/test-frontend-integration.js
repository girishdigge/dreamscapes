#!/usr/bin/env node

// Use built-in fetch for Node.js 18+ or fallback to a simple HTTP test
const fetch = global.fetch || require('http');

// Test configuration
const FRONTEND_URL = 'http://localhost:3000';
const EXPRESS_API_URL = 'http://localhost:8000';
const TEST_DREAM = 'I dreamed of a spaceship orbiting the earth';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testFrontendAccessibility() {
  log('\n=== Testing Frontend Accessibility ===', colors.blue);

  try {
    const response = await fetch(FRONTEND_URL);
    if (response.ok) {
      log('✓ Frontend is accessible at localhost:3000', colors.green);
      return true;
    } else {
      log(`✗ Frontend returned status: ${response.status}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Frontend accessibility test failed: ${error.message}`, colors.red);
    return false;
  }
}

async function testExpressAPI() {
  log('\n=== Testing Express API ===', colors.blue);

  try {
    const response = await fetch(`${EXPRESS_API_URL}/api/parse-dream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: TEST_DREAM }),
    });

    if (!response.ok) {
      log(`✗ Express API returned status: ${response.status}`, colors.red);
      return false;
    }

    const result = await response.json();

    if (result.success) {
      log('✓ Express API is responding successfully', colors.green);
      log(`  Source: ${result.data.source}`, colors.yellow);
      log(`  Processing time: ${result.processingTime}ms`, colors.yellow);

      // Check if using AI instead of fallback
      if (result.data.source && result.data.source !== 'safe_fallback') {
        log('✓ Using AI generation (not fallback)', colors.green);
      } else {
        log('⚠ Using fallback generation', colors.yellow);
      }

      // Check for spaceship content
      const dreamData = JSON.stringify(result.data).toLowerCase();
      if (dreamData.includes('spaceship') || dreamData.includes('space')) {
        log('✓ Dream contains spaceship-related content', colors.green);
      } else {
        log(
          '⚠ Dream may not contain expected spaceship content',
          colors.yellow
        );
      }

      return result;
    } else {
      log(`✗ Express API returned error: ${result.error}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Express API test failed: ${error.message}`, colors.red);
    return false;
  }
}

async function testFrontendIntegration() {
  log('\n=== Testing Frontend Integration with Puppeteer ===', colors.blue);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Set up console logging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        log(`Browser Error: ${msg.text()}`, colors.red);
      }
    });

    // Navigate to frontend
    log('Navigating to frontend...', colors.yellow);
    await page.goto(FRONTEND_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Check if the page loaded successfully
    const title = await page.title();
    log(`✓ Page loaded with title: ${title}`, colors.green);

    // Look for dream input elements
    const dreamInput = await page.$('input[type="text"], textarea');
    if (dreamInput) {
      log('✓ Found dream input element', colors.green);

      // Try to submit a dream
      log('Attempting to submit test dream...', colors.yellow);
      await dreamInput.type(TEST_DREAM);

      // Look for submit button
      const submitButton = await page.$(
        'button[type="submit"], button:contains("Submit"), button:contains("Generate")'
      );
      if (submitButton) {
        log('✓ Found submit button', colors.green);

        // Click submit and wait for response
        await submitButton.click();
        log('✓ Submitted dream request', colors.green);

        // Wait for processing
        await page.waitForTimeout(5000);

        // Check for 3D scene or results
        const canvas = await page.$('canvas');
        if (canvas) {
          log('✓ Found canvas element (likely 3D scene)', colors.green);
        } else {
          log('⚠ No canvas element found', colors.yellow);
        }

        // Check for any error messages
        const errorElements = await page.$$(
          '[class*="error"], [class*="Error"]'
        );
        if (errorElements.length === 0) {
          log('✓ No error messages visible', colors.green);
        } else {
          log(
            `⚠ Found ${errorElements.length} potential error elements`,
            colors.yellow
          );
        }
      } else {
        log('⚠ Could not find submit button', colors.yellow);
      }
    } else {
      log('⚠ Could not find dream input element', colors.yellow);
    }

    return true;
  } catch (error) {
    log(`✗ Frontend integration test failed: ${error.message}`, colors.red);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function testCompleteWorkflow() {
  log('\n=== Testing Complete Workflow ===', colors.blue);

  // Test multiple dream texts to verify consistency
  const testDreams = [
    'I dreamed of a spaceship orbiting the earth',
    'I dreamed of a magical forest with glowing trees',
    'I dreamed of a futuristic city floating in the clouds',
  ];

  let successCount = 0;

  for (const dreamText of testDreams) {
    log(`\nTesting dream: "${dreamText}"`, colors.yellow);

    try {
      const response = await fetch(`${EXPRESS_API_URL}/api/parse-dream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: dreamText }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          log(
            `✓ Dream processed successfully (source: ${result.data.source})`,
            colors.green
          );
          successCount++;
        } else {
          log(`✗ Dream processing failed: ${result.error}`, colors.red);
        }
      } else {
        log(`✗ API request failed with status: ${response.status}`, colors.red);
      }
    } catch (error) {
      log(`✗ Dream test failed: ${error.message}`, colors.red);
    }
  }

  log(
    `\nWorkflow test results: ${successCount}/${testDreams.length} dreams processed successfully`,
    successCount === testDreams.length ? colors.green : colors.yellow
  );

  return successCount === testDreams.length;
}

async function runAllTests() {
  log(
    '🚀 Starting Frontend Integration and Complete Workflow Tests',
    colors.blue
  );
  log('='.repeat(60), colors.blue);

  const results = {
    frontendAccessible: false,
    expressAPI: false,
    frontendIntegration: false,
    completeWorkflow: false,
  };

  // Test 1: Frontend Accessibility
  results.frontendAccessible = await testFrontendAccessibility();

  // Test 2: Express API
  results.expressAPI = await testExpressAPI();

  // Test 3: Frontend Integration (only if frontend is accessible)
  if (results.frontendAccessible) {
    results.frontendIntegration = await testFrontendIntegration();
  }

  // Test 4: Complete Workflow
  results.completeWorkflow = await testCompleteWorkflow();

  // Summary
  log('\n' + '='.repeat(60), colors.blue);
  log('📊 TEST SUMMARY', colors.blue);
  log('='.repeat(60), colors.blue);

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✓ PASS' : '✗ FAIL';
    const color = passed ? colors.green : colors.red;
    log(`${status} ${test}`, color);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  log(
    `\nOverall: ${passedTests}/${totalTests} tests passed`,
    passedTests === totalTests ? colors.green : colors.yellow
  );

  if (passedTests === totalTests) {
    log(
      '\n🎉 All tests passed! Frontend integration and complete workflow verified.',
      colors.green
    );
  } else {
    log(
      '\n⚠️  Some tests failed. Please check the issues above.',
      colors.yellow
    );
  }

  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      log(`Fatal error: ${error.message}`, colors.red);
      process.exit(1);
    });
}

module.exports = { runAllTests };
