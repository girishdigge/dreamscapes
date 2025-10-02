#!/usr/bin/env node

// Debug script to test validation
const fetch = require('node-fetch');

async function testValidation() {
  try {
    console.log('Testing MCP Gateway validation...');

    const response = await fetch('http://localhost:8080/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'debug validation test',
        style: 'cyberpunk',
      }),
      timeout: 30000,
    });

    const result = await response.json();

    console.log('Response received:');
    console.log(JSON.stringify(result, null, 2));

    if (result.metadata && result.metadata.validation) {
      console.log('\nValidation details:');
      console.log('Valid:', result.metadata.validation.valid);
      console.log('Errors found:', result.metadata.validation.errorsFound);
      console.log('Warnings found:', result.metadata.validation.warningsFound);
      console.log('Repair applied:', result.metadata.validation.repairApplied);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testValidation();
