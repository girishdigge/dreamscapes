/**
 * Test script for /metrics/extraction endpoint
 *
 * This script tests the extraction metrics endpoint to ensure it returns
 * the expected data structure with extraction, validation, and repair metrics.
 */

const axios = require('axios');

const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:8080';

async function testExtractionMetricsEndpoint() {
  console.log('Testing /metrics/extraction endpoint...\n');

  try {
    const response = await axios.get(`${MCP_GATEWAY_URL}/metrics/extraction`);

    console.log('✓ Endpoint responded successfully');
    console.log(`Status: ${response.status}`);
    console.log(`\nResponse structure:`);

    const data = response.data;

    // Check top-level structure
    console.log(`- success: ${data.success}`);
    console.log(`- timestamp: ${data.timestamp}`);

    // Check extraction metrics
    if (data.extraction) {
      console.log(`\nExtraction Metrics:`);
      console.log(
        `- Total attempts: ${data.extraction.overall?.totalAttempts || 0}`
      );
      console.log(
        `- Successful: ${data.extraction.overall?.successfulExtractions || 0}`
      );
      console.log(
        `- Failed: ${data.extraction.overall?.failedExtractions || 0}`
      );
      console.log(
        `- Success rate: ${
          data.extraction.overall?.successRate?.toFixed(2) || 0
        }%`
      );

      if (data.extraction.byProvider) {
        console.log(
          `\nProviders tracked: ${
            Object.keys(data.extraction.byProvider).length
          }`
        );
        Object.keys(data.extraction.byProvider).forEach((provider) => {
          const providerMetrics = data.extraction.byProvider[provider];
          console.log(
            `  - ${provider}: ${
              providerMetrics.totalAttempts
            } attempts, ${providerMetrics.successRate?.toFixed(2)}% success`
          );
        });
      }

      if (data.extraction.byPattern) {
        console.log(
          `\nPatterns tracked: ${Object.keys(data.extraction.byPattern).length}`
        );
      }

      if (data.extraction.failurePatterns) {
        console.log(
          `\nFailure patterns: ${data.extraction.failurePatterns.length}`
        );
      }
    }

    // Check validation metrics
    if (data.validation) {
      console.log(`\nValidation Metrics:`);
      console.log(
        `- Total validations: ${data.validation.overall?.totalValidations || 0}`
      );
      console.log(
        `- Success rate: ${
          data.validation.overall?.successRate?.toFixed(2) || 0
        }%`
      );
    }

    // Check repair metrics
    if (data.repair) {
      console.log(`\nRepair Metrics:`);
      console.log(`- Total repairs: ${data.repair.total || 0}`);
      console.log(`- Successful: ${data.repair.successful || 0}`);
      console.log(
        `- Success rate: ${data.repair.successRate?.toFixed(2) || 0}%`
      );
    }

    // Check summary
    if (data.summary) {
      console.log(`\nSummary:`);
      console.log(
        `- Extraction success rate: ${
          data.summary.extractionSuccessRate?.toFixed(2) || 0
        }%`
      );
      console.log(
        `- Validation success rate: ${
          data.summary.validationSuccessRate?.toFixed(2) || 'N/A'
        }%`
      );
      console.log(
        `- Repair success rate: ${
          data.summary.repairSuccessRate?.toFixed(2) || 'N/A'
        }%`
      );
    }

    console.log('\n✓ All checks passed!');
    console.log('\nFull response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('✗ Test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the MCP Gateway running?');
      console.error(`URL: ${MCP_GATEWAY_URL}`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Run the test
testExtractionMetricsEndpoint();
