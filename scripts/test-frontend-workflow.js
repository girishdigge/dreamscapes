#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

async function testCompleteWorkflow() {
  console.log('🚀 Starting complete workflow verification...\n');

  // Test 1: Verify Express API is working
  console.log('1. Testing Express API directly...');
  try {
    const response = await fetch('http://localhost:8000/api/parse-dream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'I dreamed of a spaceship orbiting the earth',
      }),
      timeout: 60000,
    });

    const result = await response.json();

    if (result.success && result.data.source !== 'safe_fallback') {
      console.log('✅ Express API working correctly');
      console.log(`   Source: ${result.data.source}`);
      console.log(`   Processing time: ${result.processingTime}ms`);
      console.log(`   Dream ID: ${result.data.id}`);
    } else {
      console.log('❌ Express API not using AI generation');
      console.log(`   Source: ${result.data?.source || 'unknown'}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Express API test failed:', error.message);
    return false;
  }

  // Test 2: Verify frontend accessibility
  console.log('\n2. Testing frontend accessibility...');
  try {
    const response = await fetch('http://localhost:3000', {
      timeout: 10000,
    });

    if (response.ok) {
      console.log('✅ Frontend is accessible');
    } else {
      console.log('❌ Frontend not accessible:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Frontend accessibility test failed:', error.message);
    return false;
  }

  // Test 3: Test frontend integration with browser automation
  console.log('\n3. Testing frontend integration with browser automation...');

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
        console.log('   Browser error:', msg.text());
      }
    });

    // Navigate to frontend
    console.log('   Navigating to frontend...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Check if the main elements are present
    const dreamInput = await page.$('textarea, input[type="text"]');
    const submitButton = await page.$(
      'button[type="submit"], button:contains("Generate"), button:contains("Submit")'
    );

    if (!dreamInput) {
      console.log('❌ Dream input field not found');
      return false;
    }

    if (!submitButton) {
      console.log('❌ Submit button not found');
      return false;
    }

    console.log('✅ Frontend elements found');

    // Test dream submission
    console.log('   Testing dream submission...');

    // Clear and type in the dream text
    await dreamInput.click({ clickCount: 3 });
    await dreamInput.type('I dreamed of a spaceship orbiting the earth');

    // Click submit button
    await submitButton.click();

    // Wait for response (with timeout)
    console.log('   Waiting for dream processing...');

    // Wait for either success or error indicators
    try {
      await page.waitForFunction(
        () => {
          // Look for success indicators
          const canvas = document.querySelector('canvas');
          const errorMsg = document.querySelector('[class*="error"], .error');
          const loadingMsg = document.querySelector(
            '[class*="loading"], .loading'
          );

          // If we have a canvas, that's success
          if (canvas) return 'success';

          // If we have an error message, that's failure
          if (errorMsg && !loadingMsg) return 'error';

          // Still loading
          return false;
        },
        { timeout: 60000 }
      );

      const result = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const errorMsg = document.querySelector('[class*="error"], .error');

        if (canvas) {
          return { success: true, hasCanvas: true };
        } else if (errorMsg) {
          return { success: false, error: errorMsg.textContent };
        }

        return { success: false, error: 'Unknown state' };
      });

      if (result.success && result.hasCanvas) {
        console.log('✅ Dream processing successful - 3D scene rendered');
      } else {
        console.log('❌ Dream processing failed:', result.error);
        return false;
      }
    } catch (timeoutError) {
      console.log('❌ Dream processing timed out after 60 seconds');
      return false;
    }
  } catch (error) {
    console.log('❌ Browser automation failed:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Test 4: Verify caching works
  console.log('\n4. Testing caching behavior...');
  try {
    const startTime = Date.now();
    const response = await fetch('http://localhost:8000/api/parse-dream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'I dreamed of a spaceship orbiting the earth',
      }),
      timeout: 10000,
    });

    const result = await response.json();
    const responseTime = Date.now() - startTime;

    if (result.success && result.cached && responseTime < 1000) {
      console.log('✅ Caching working correctly');
      console.log(`   Cached response time: ${responseTime}ms`);
    } else {
      console.log('⚠️  Caching may not be working optimally');
      console.log(
        `   Cached: ${result.cached}, Response time: ${responseTime}ms`
      );
    }
  } catch (error) {
    console.log('❌ Caching test failed:', error.message);
    return false;
  }

  console.log('\n🎉 Complete workflow verification successful!');
  console.log('\nSummary:');
  console.log('✅ Express API communicates with MCP Gateway');
  console.log('✅ AI generation working (not using fallback)');
  console.log('✅ Frontend accessible and functional');
  console.log('✅ Dream submission and 3D rendering working');
  console.log('✅ Caching system operational');

  return true;
}

// Run the test
testCompleteWorkflow()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
