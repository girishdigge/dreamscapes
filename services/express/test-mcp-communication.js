#!/usr/bin/env node

// Test script for MCP Gateway communication
// This script tests the enhanced fetch configuration and error handling

const fetch = require('node-fetch');
require('dotenv').config();

const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:8080';

async function testMCPGatewayHealth() {
  console.log('🔍 Testing MCP Gateway Health Check...');

  try {
    const response = await fetch(`${MCP_GATEWAY_URL}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Dreamscapes-Express-Test/1.0.0',
      },
      timeout: 5000,
    });

    console.log(
      `✅ Health Check Response: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const data = await response.text();
      console.log(
        `📄 Response: ${data.slice(0, 200)}${data.length > 200 ? '...' : ''}`
      );
    }

    return response.ok;
  } catch (error) {
    console.log(`❌ Health Check Failed: ${error.message}`);
    return false;
  }
}

async function testMCPGatewayParse() {
  console.log('🔍 Testing MCP Gateway Parse Endpoint...');

  const testPayload = {
    text: 'I dreamed of a spaceship orbiting the earth',
    style: 'ethereal',
    options: {},
  };

  try {
    const response = await fetch(`${MCP_GATEWAY_URL}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Dreamscapes-Express-Test/1.0.0',
        'X-Request-ID': 'test-' + Date.now(),
        'X-Request-Source': 'test-script',
      },
      body: JSON.stringify(testPayload),
      timeout: 30000,
    });

    console.log(`✅ Parse Response: ${response.status} ${response.statusText}`);
    console.log(`📊 Content-Type: ${response.headers.get('content-type')}`);
    console.log(`📏 Content-Length: ${response.headers.get('content-length')}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`📄 Response Structure:`);
      console.log(`   - Success: ${data.success}`);
      console.log(`   - Has Data: ${!!data.data}`);
      console.log(`   - Has Fallback: ${!!data.fallback}`);
      console.log(`   - Metadata: ${JSON.stringify(data.metadata)}`);

      const dreamJson = data.data || data.fallback;
      if (dreamJson) {
        console.log(`🎭 Dream Details:`);
        console.log(`   - ID: ${dreamJson.id}`);
        console.log(`   - Title: ${dreamJson.title}`);
        console.log(`   - Style: ${dreamJson.style}`);
        console.log(`   - Structures: ${dreamJson.structures?.length || 0}`);
        console.log(`   - Entities: ${dreamJson.entities?.length || 0}`);
      }

      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Parse Error: ${errorText.slice(0, 500)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Parse Request Failed: ${error.message}`);
    console.log(`   Error Type: ${error.constructor.name}`);
    console.log(`   Error Code: ${error.code}`);
    return false;
  }
}

async function testExpressHealthEndpoint() {
  console.log('🔍 Testing Express MCP Health Endpoint...');

  const EXPRESS_URL = process.env.EXPRESS_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${EXPRESS_URL}/api/mcp-gateway/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    console.log(
      `✅ Express Health Response: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`📄 Health Status:`);
      console.log(`   - Service: ${data.service}`);
      console.log(`   - Healthy: ${data.healthy}`);
      console.log(`   - Response Time: ${data.responseTime}`);
      console.log(`   - Circuit Breaker Open: ${data.circuitBreaker?.isOpen}`);
      console.log(`   - Failure Count: ${data.circuitBreaker?.failureCount}`);
    }

    return response.ok;
  } catch (error) {
    console.log(`❌ Express Health Check Failed: ${error.message}`);
    return false;
  }
}

async function testExpressParseDream() {
  console.log('🔍 Testing Express Parse Dream Endpoint...');

  const EXPRESS_URL = process.env.EXPRESS_URL || 'http://localhost:8000';

  const testPayload = {
    text: 'I dreamed of a spaceship orbiting the earth',
    style: 'ethereal',
  };

  try {
    const response = await fetch(`${EXPRESS_URL}/api/parse-dream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(testPayload),
      timeout: 60000,
    });

    console.log(
      `✅ Express Parse Response: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`📄 Parse Result:`);
      console.log(`   - Success: ${data.success}`);
      console.log(`   - Source: ${data.metadata?.source}`);
      console.log(`   - Processing Time: ${data.metadata?.processingTime}ms`);
      console.log(`   - Cached: ${data.cached}`);

      if (data.data) {
        console.log(`🎭 Dream Generated:`);
        console.log(`   - ID: ${data.data.id}`);
        console.log(`   - Title: ${data.data.title}`);
        console.log(`   - Style: ${data.data.style}`);
        console.log(`   - Source: ${data.data.source}`);
      }

      return data.metadata?.source !== 'safe_fallback';
    } else {
      const errorData = await response.json();
      console.log(`❌ Express Parse Error: ${errorData.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Express Parse Request Failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting MCP Gateway Communication Tests');
  console.log(`📍 MCP Gateway URL: ${MCP_GATEWAY_URL}`);
  console.log('='.repeat(60));

  const results = {
    mcpHealth: false,
    mcpParse: false,
    expressHealth: false,
    expressParse: false,
  };

  // Test 1: MCP Gateway Health
  console.log('\n1️⃣ MCP Gateway Health Check');
  console.log('-'.repeat(40));
  results.mcpHealth = await testMCPGatewayHealth();

  // Test 2: MCP Gateway Parse (only if health check passed)
  if (results.mcpHealth) {
    console.log('\n2️⃣ MCP Gateway Parse Test');
    console.log('-'.repeat(40));
    results.mcpParse = await testMCPGatewayParse();
  } else {
    console.log('\n2️⃣ Skipping MCP Gateway Parse Test (health check failed)');
  }

  // Test 3: Express Health Endpoint
  console.log('\n3️⃣ Express Health Endpoint Test');
  console.log('-'.repeat(40));
  results.expressHealth = await testExpressHealthEndpoint();

  // Test 4: Express Parse Dream
  console.log('\n4️⃣ Express Parse Dream Test');
  console.log('-'.repeat(40));
  results.expressParse = await testExpressParseDream();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(
    `MCP Gateway Health:     ${results.mcpHealth ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `MCP Gateway Parse:      ${results.mcpParse ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `Express Health:         ${results.expressHealth ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `Express Parse:          ${results.expressParse ? '✅ PASS' : '❌ FAIL'}`
  );

  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);

  if (results.expressParse) {
    console.log(
      '\n🎉 SUCCESS: Express service is properly communicating with MCP Gateway!'
    );
    console.log(
      '   The enhanced fetch configuration and error handling is working correctly.'
    );
  } else if (results.mcpParse && !results.expressParse) {
    console.log(
      '\n⚠️  PARTIAL: MCP Gateway works directly but Express integration has issues.'
    );
    console.log(
      '   Check Express service logs for detailed error information.'
    );
  } else {
    console.log('\n❌ FAILURE: MCP Gateway communication is not working.');
    console.log('   Check that MCP Gateway service is running and accessible.');
  }

  process.exit(passCount === totalCount ? 0 : 1);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testMCPGatewayHealth,
  testMCPGatewayParse,
  testExpressHealthEndpoint,
  testExpressParseDream,
  runTests,
};
