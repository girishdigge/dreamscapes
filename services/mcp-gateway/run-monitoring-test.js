#!/usr/bin/env node

// run-monitoring-test.js
// Script to run the enhanced monitoring integration test

const path = require('path');

// Ensure we're in the right directory
process.chdir(__dirname);

console.log('🚀 Starting Enhanced Provider Monitoring Integration Test');
console.log('📁 Working directory:', process.cwd());
console.log('⏰ Test start time:', new Date().toISOString());
console.log('='.repeat(80));

// Import and run the test
const {
  runMonitoringIntegrationTest,
} = require('./tests/monitoring-integration.test.js');

runMonitoringIntegrationTest()
  .then((success) => {
    console.log('='.repeat(80));
    console.log('⏰ Test end time:', new Date().toISOString());

    if (success) {
      console.log('🎉 All tests passed successfully!');
      console.log('\n📋 Test Results Summary:');
      console.log('   ✅ Provider registration and configuration');
      console.log('   ✅ Health monitoring system');
      console.log('   ✅ Metrics collection and aggregation');
      console.log('   ✅ Real-time metrics tracking');
      console.log('   ✅ Automated alerting system');
      console.log('   ✅ Provider failure detection and recovery');
      console.log('   ✅ Comprehensive reporting');
      console.log('   ✅ Data export functionality');

      console.log('\n🔧 Implementation Status:');
      console.log(
        '   ✅ Task 2.2: Provider health monitoring and metrics collection - COMPLETED'
      );
      console.log('   ✅ Enhanced ProviderManager with monitoring integration');
      console.log('   ✅ Comprehensive HealthMonitor with detailed checks');
      console.log('   ✅ Advanced MetricsCollector with real-time tracking');
      console.log('   ✅ Automated AlertingSystem with reporting');

      process.exit(0);
    } else {
      console.log('❌ Some tests failed. Please check the output above.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
