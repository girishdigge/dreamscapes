#!/usr/bin/env node

// Health Check Verification Script for Dreamscapes Services
// This script tests all service health endpoints and inter-service communication

const https = require('https');
const http = require('http');

// Service endpoints to test
const services = [
  {
    name: 'Express Orchestrator',
    url: 'http://localhost:8000/health',
    expectedFields: ['service', 'status', 'timestamp', 'uptime', 'checks'],
  },
  {
    name: 'MCP Gateway Health',
    url: 'http://localhost:8080/health',
    expectedFields: [
      'service',
      'status',
      'version',
      'environment',
      'timestamp',
    ],
  },
  {
    name: 'MCP Gateway Status',
    url: 'http://localhost:8080/status',
    expectedFields: ['service', 'timestamp', 'services'],
  },
  {
    name: 'Llama Stylist',
    url: 'http://localhost:8002/health',
    expectedFields: ['service', 'status', 'timestamp', 'version'],
  },
];

// Inter-service communication tests
const communicationTests = [
  {
    name: 'Express API Info',
    url: 'http://localhost:8000/api',
    method: 'GET',
    expectedFields: ['name', 'version', 'endpoints', 'status'],
  },
  {
    name: 'Express Samples',
    url: 'http://localhost:8000/api/samples',
    method: 'GET',
    expectedFields: ['samples', 'count', 'usage'],
  },
];

async function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dreamscapes-Health-Check/1.0',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            parseError: e.message,
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function checkFields(obj, expectedFields, serviceName) {
  const missing = [];
  const present = [];

  expectedFields.forEach((field) => {
    if (obj.hasOwnProperty(field)) {
      present.push(field);
    } else {
      missing.push(field);
    }
  });

  return { missing, present };
}

async function testHealthEndpoints() {
  console.log('🏥 Testing Service Health Endpoints\n');
  console.log('='.repeat(60));

  const results = [];

  for (const service of services) {
    console.log(`\n🔍 Testing ${service.name}...`);
    console.log(`   URL: ${service.url}`);

    try {
      const response = await makeRequest(service.url);

      if (response.statusCode === 200) {
        console.log(`   ✅ Status: ${response.statusCode} OK`);

        const fieldCheck = checkFields(
          response.body,
          service.expectedFields,
          service.name
        );

        if (fieldCheck.missing.length === 0) {
          console.log(
            `   ✅ All expected fields present: ${fieldCheck.present.join(
              ', '
            )}`
          );
        } else {
          console.log(
            `   ⚠️  Missing fields: ${fieldCheck.missing.join(', ')}`
          );
          console.log(`   ✅ Present fields: ${fieldCheck.present.join(', ')}`);
        }

        // Show key health info
        if (response.body.status) {
          console.log(`   📊 Service Status: ${response.body.status}`);
        }
        if (response.body.uptime) {
          console.log(`   ⏱️  Uptime: ${Math.round(response.body.uptime)}s`);
        }

        results.push({
          service: service.name,
          status: 'healthy',
          statusCode: response.statusCode,
          missingFields: fieldCheck.missing,
          response: response.body,
        });
      } else {
        console.log(`   ❌ Status: ${response.statusCode}`);
        console.log(
          `   📄 Response: ${JSON.stringify(response.body, null, 2)}`
        );

        results.push({
          service: service.name,
          status: 'unhealthy',
          statusCode: response.statusCode,
          error: response.body,
        });
      }
    } catch (error) {
      console.log(`   ❌ Connection failed: ${error.message}`);
      results.push({
        service: service.name,
        status: 'unreachable',
        error: error.message,
      });
    }
  }

  return results;
}

async function testInterServiceCommunication() {
  console.log('\n\n🔗 Testing Inter-Service Communication\n');
  console.log('='.repeat(60));

  const results = [];

  for (const test of communicationTests) {
    console.log(`\n🔍 Testing ${test.name}...`);
    console.log(`   URL: ${test.url}`);

    try {
      const response = await makeRequest(test.url, test.method);

      if (response.statusCode === 200) {
        console.log(`   ✅ Status: ${response.statusCode} OK`);

        const fieldCheck = checkFields(
          response.body,
          test.expectedFields,
          test.name
        );

        if (fieldCheck.missing.length === 0) {
          console.log(
            `   ✅ All expected fields present: ${fieldCheck.present.join(
              ', '
            )}`
          );
        } else {
          console.log(
            `   ⚠️  Missing fields: ${fieldCheck.missing.join(', ')}`
          );
        }

        // Show specific info for different endpoints
        if (test.name === 'Express Samples' && response.body.count) {
          console.log(`   📚 Sample dreams available: ${response.body.count}`);
        }

        results.push({
          test: test.name,
          status: 'success',
          statusCode: response.statusCode,
          missingFields: fieldCheck.missing,
        });
      } else {
        console.log(`   ❌ Status: ${response.statusCode}`);
        results.push({
          test: test.name,
          status: 'failed',
          statusCode: response.statusCode,
          error: response.body,
        });
      }
    } catch (error) {
      console.log(`   ❌ Connection failed: ${error.message}`);
      results.push({
        test: test.name,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return results;
}

async function generateSummaryReport(healthResults, commResults) {
  console.log('\n\n📊 HEALTH CHECK SUMMARY REPORT\n');
  console.log('='.repeat(60));

  // Health endpoints summary
  console.log('\n🏥 Service Health Status:');
  const healthyServices = healthResults.filter(
    (r) => r.status === 'healthy'
  ).length;
  const totalServices = healthResults.length;

  healthResults.forEach((result) => {
    const icon =
      result.status === 'healthy'
        ? '✅'
        : result.status === 'unhealthy'
        ? '⚠️'
        : '❌';
    console.log(`   ${icon} ${result.service}: ${result.status.toUpperCase()}`);
  });

  console.log(
    `\n   Overall Health: ${healthyServices}/${totalServices} services healthy`
  );

  // Communication tests summary
  console.log('\n🔗 Inter-Service Communication:');
  const successfulComm = commResults.filter(
    (r) => r.status === 'success'
  ).length;
  const totalComm = commResults.length;

  commResults.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`   ${icon} ${result.test}: ${result.status.toUpperCase()}`);
  });

  console.log(
    `\n   Communication Status: ${successfulComm}/${totalComm} tests passed`
  );

  // Overall status
  const overallHealthy = healthyServices === totalServices;
  const overallComm = successfulComm === totalComm;
  const overallStatus = overallHealthy && overallComm;

  console.log('\n🎯 OVERALL STATUS:');
  console.log(
    `   ${overallStatus ? '✅ ALL SYSTEMS OPERATIONAL' : '⚠️  ISSUES DETECTED'}`
  );

  if (!overallStatus) {
    console.log('\n🔧 RECOMMENDED ACTIONS:');

    healthResults.forEach((result) => {
      if (result.status !== 'healthy') {
        console.log(
          `   • Fix ${result.service}: ${result.error || 'Service unhealthy'}`
        );
      }
    });

    commResults.forEach((result) => {
      if (result.status !== 'success') {
        console.log(
          `   • Fix ${result.test}: ${result.error || 'Communication failed'}`
        );
      }
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Health check completed at ${new Date().toISOString()}`);
}

async function main() {
  console.log('🚀 Dreamscapes Service Health Check Verification');
  console.log(`Started at ${new Date().toISOString()}\n`);

  try {
    const healthResults = await testHealthEndpoints();
    const commResults = await testInterServiceCommunication();

    await generateSummaryReport(healthResults, commResults);

    // Exit with appropriate code
    const allHealthy = healthResults.every((r) => r.status === 'healthy');
    const allComm = commResults.every((r) => r.status === 'success');

    process.exit(allHealthy && allComm ? 0 : 1);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testHealthEndpoints, testInterServiceCommunication };
