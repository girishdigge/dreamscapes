// test-integration.js
// Simple test to verify the content repair integration works

const axios = require('axios');

async function testContentRepairIntegration() {
  console.log('🧪 Testing Content Repair Integration\n');

  const baseUrl = 'http://localhost:8080';

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log(`✅ Health check: ${healthResponse.data.status}`);

    // Test 2: Validation metrics (should be empty initially)
    console.log('\n2. Testing validation metrics...');
    const metricsResponse = await axios.get(`${baseUrl}/metrics/validation`);
    console.log('✅ Validation metrics retrieved');
    console.log(
      `   Total validations: ${metricsResponse.data.data.validation.totalValidations}`
    );
    console.log(
      `   Repair attempts: ${metricsResponse.data.data.repair.totalRepairAttempts}`
    );

    // Test 3: Dream parsing with content that might need repair
    console.log('\n3. Testing dream parsing with validation and repair...');
    const parseResponse = await axios.post(`${baseUrl}/parse`, {
      text: 'I dreamed of a magical forest with floating books',
      style: 'ethereal',
      options: {
        quality: 'high',
      },
    });

    if (parseResponse.data.success) {
      console.log('✅ Dream parsing successful');
      console.log(`   Source: ${parseResponse.data.metadata.source}`);
      console.log(
        `   Processing time: ${parseResponse.data.metadata.processingTimeMs}ms`
      );

      if (parseResponse.data.metadata.validation) {
        console.log(
          `   Validation applied: ${
            parseResponse.data.metadata.validation.valid ? 'Valid' : 'Invalid'
          }`
        );
        console.log(
          `   Errors found: ${parseResponse.data.metadata.validation.errorsFound}`
        );
        console.log(
          `   Warnings found: ${parseResponse.data.metadata.validation.warningsFound}`
        );
        console.log(
          `   Repair applied: ${parseResponse.data.metadata.validation.repairApplied}`
        );
        console.log(
          `   Repair strategies: ${parseResponse.data.metadata.validation.repairStrategies}`
        );
        console.log(
          `   Validation time: ${parseResponse.data.metadata.validation.validationTime}ms`
        );
      }

      // Check if the response has the expected structure
      const data = parseResponse.data.data;
      console.log('\n   Response structure check:');
      console.log(`   - Has success field: ${data.success !== undefined}`);
      console.log(`   - Has data.id: ${data.data?.id !== undefined}`);
      console.log(`   - Has data.title: ${data.data?.title !== undefined}`);
      console.log(
        `   - Has data.description: ${data.data?.description !== undefined}`
      );
      console.log(`   - Has data.scenes: ${Array.isArray(data.data?.scenes)}`);
      console.log(`   - Number of scenes: ${data.data?.scenes?.length || 0}`);
      console.log(`   - Has metadata: ${data.metadata !== undefined}`);
    } else {
      console.log('❌ Dream parsing failed:', parseResponse.data.error);
    }

    // Test 4: Check updated metrics
    console.log('\n4. Testing updated validation metrics...');
    const updatedMetricsResponse = await axios.get(
      `${baseUrl}/metrics/validation`
    );
    console.log('✅ Updated validation metrics retrieved');
    console.log(
      `   Total validations: ${updatedMetricsResponse.data.data.validation.totalValidations}`
    );
    console.log(
      `   Success rate: ${updatedMetricsResponse.data.data.validation.successRate.toFixed(
        1
      )}%`
    );
    console.log(
      `   Repair attempts: ${updatedMetricsResponse.data.data.repair.totalRepairAttempts}`
    );
    console.log(
      `   Repair success rate: ${updatedMetricsResponse.data.data.repair.successRate.toFixed(
        1
      )}%`
    );

    if (
      Object.keys(updatedMetricsResponse.data.data.repair.repairsByStrategy)
        .length > 0
    ) {
      console.log('\n   Most used repair strategies:');
      Object.entries(updatedMetricsResponse.data.data.repair.repairsByStrategy)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .forEach(([strategy, count]) => {
          console.log(`     ${strategy}: ${count} times`);
        });
    }

    console.log('\n🎉 Content repair integration test completed successfully!');
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the MCP Gateway is running on port 8080');
      console.error('   Run: npm start');
    }
  }
}

// Run the test
if (require.main === module) {
  testContentRepairIntegration().catch(console.error);
}

module.exports = { testContentRepairIntegration };
