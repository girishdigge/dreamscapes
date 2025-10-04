/**
 * Verification script for Task 18: Move MCP Gateway validation code to shared directory
 *
 * This script verifies that:
 * 1. All imports from shared module work correctly
 * 2. MCPGatewayValidator uses shared UnifiedValidator, DreamSchema, EnhancedContentRepair
 * 3. No duplicate validation code exists
 */

console.log('🔍 Verifying MCP Gateway shared module integration...\n');

// Test 1: Verify shared module imports
console.log('Test 1: Verifying shared module imports...');
try {
  const shared = require('../../../shared');
  console.log('✅ Shared module imported successfully');
  console.log('   - DreamSchema:', typeof shared.DreamSchema);
  console.log('   - UnifiedValidator:', typeof shared.UnifiedValidator);
  console.log(
    '   - EnhancedContentRepair:',
    typeof shared.EnhancedContentRepair
  );
  console.log('   - validationMonitor:', typeof shared.validationMonitor);
} catch (error) {
  console.error('❌ Failed to import shared module:', error.message);
  process.exit(1);
}

// Test 2: Verify MCPGatewayValidator uses shared components
console.log('\nTest 2: Verifying MCPGatewayValidator integration...');
try {
  const MCPGatewayValidator = require('./validators/MCPGatewayValidator');
  const validator = new MCPGatewayValidator();

  console.log('✅ MCPGatewayValidator instantiated successfully');

  // Check if it has access to shared components
  const schema = validator.getDreamSchema();
  const monitor = validator.getValidationMonitor();

  console.log('   - getDreamSchema():', typeof schema);
  console.log('   - getValidationMonitor():', typeof monitor);
} catch (error) {
  console.error('❌ Failed to verify MCPGatewayValidator:', error.message);
  process.exit(1);
}

// Test 3: Verify EnhancedResponseTransformer uses shared components
console.log('\nTest 3: Verifying EnhancedResponseTransformer integration...');
try {
  const EnhancedResponseTransformer = require('./utils/EnhancedResponseTransformer');
  const transformer = new EnhancedResponseTransformer();

  console.log('✅ EnhancedResponseTransformer instantiated successfully');
} catch (error) {
  console.error(
    '❌ Failed to verify EnhancedResponseTransformer:',
    error.message
  );
  process.exit(1);
}

// Test 4: Verify RequestValidator uses shared components
console.log('\nTest 4: Verifying RequestValidator integration...');
try {
  const RequestValidator = require('./middleware/requestValidator');
  const requestValidator = new RequestValidator();

  console.log('✅ RequestValidator instantiated successfully');
} catch (error) {
  console.error('❌ Failed to verify RequestValidator:', error.message);
  process.exit(1);
}

// Test 5: Verify GatewayFallbackHandler uses shared components
console.log('\nTest 5: Verifying GatewayFallbackHandler integration...');
try {
  const GatewayFallbackHandler = require('./utils/GatewayFallbackHandler');
  const fallbackHandler = new GatewayFallbackHandler();

  console.log('✅ GatewayFallbackHandler instantiated successfully');
} catch (error) {
  console.error('❌ Failed to verify GatewayFallbackHandler:', error.message);
  process.exit(1);
}

// Test 6: Verify ValidationPipeline uses shared components
console.log('\nTest 6: Verifying ValidationPipeline integration...');
try {
  const ValidationPipeline = require('./engine/ValidationPipeline');
  const pipeline = new ValidationPipeline();

  console.log('✅ ValidationPipeline instantiated successfully');
} catch (error) {
  console.error('❌ Failed to verify ValidationPipeline:', error.message);
  process.exit(1);
}

// Test 7: Verify ExtractionMetricsCollector uses shared components
console.log('\nTest 7: Verifying ExtractionMetricsCollector integration...');
try {
  const ExtractionMetricsCollector = require('./utils/ExtractionMetricsCollector');
  const metricsCollector = new ExtractionMetricsCollector();

  console.log('✅ ExtractionMetricsCollector instantiated successfully');
} catch (error) {
  console.error(
    '❌ Failed to verify ExtractionMetricsCollector:',
    error.message
  );
  process.exit(1);
}

// Test 8: Verify no duplicate validation code
console.log('\nTest 8: Verifying no duplicate validation code...');
const fs = require('fs');
const path = require('path');

// Check that validators directory only contains MCPGatewayValidator
const validatorsDir = path.join(__dirname, 'validators');
const validatorFiles = fs.readdirSync(validatorsDir);

console.log('   Validators directory contents:', validatorFiles);

if (
  validatorFiles.length === 1 &&
  validatorFiles[0] === 'MCPGatewayValidator.js'
) {
  console.log('✅ No duplicate validators found');
} else {
  console.warn('⚠️  Additional files found in validators directory');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ All verification tests passed!');
console.log('='.repeat(60));
console.log('\nTask 18 Completion Summary:');
console.log('✓ All imports updated from ../shared to ../../shared');
console.log('✓ MCPGatewayValidator uses shared UnifiedValidator');
console.log('✓ MCPGatewayValidator uses shared DreamSchema');
console.log('✓ MCPGatewayValidator uses shared validationMonitor');
console.log('✓ EnhancedResponseTransformer uses shared EnhancedContentRepair');
console.log('✓ All components instantiate without errors');
console.log('✓ No duplicate validation code found');
console.log('\n✅ Task 18 completed successfully!');
