// Validate sample dream files against the schema
const fs = require('fs');
const path = require('path');

// Load DreamSchema from shared module
const DreamSchema = require('../../shared/schemas/DreamSchema');

const sampleDir = path.join(__dirname, '../../sample_dreams');
const sampleFiles = fs
  .readdirSync(sampleDir)
  .filter((f) => f.endsWith('.json'));

console.log('=== Validating Sample Dream Files ===\n');

let allValid = true;

sampleFiles.forEach((filename) => {
  const filepath = path.join(sampleDir, filename);
  console.log(`Validating: ${filename}`);

  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const dream = JSON.parse(content);

    // Validate against schema
    const result = DreamSchema.validate(dream);

    if (result.valid) {
      console.log(`  ✓ Valid (${result.errorCount} errors)`);
    } else {
      console.log(`  ✗ Invalid (${result.errorCount} errors):`);
      result.errors.forEach((error) => {
        console.log(`    - ${error.field}: ${error.message}`);
        if (error.repairSuggestion) {
          console.log(`      Suggestion: ${error.repairSuggestion}`);
        }
      });
      allValid = false;
    }

    // Check for 3D renderMode
    if (dream.renderMode === '3d') {
      console.log(`  ℹ 3D rendering enabled`);
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    allValid = false;
  }

  console.log('');
});

if (allValid) {
  console.log('✓ All sample dreams are valid!');
  process.exit(0);
} else {
  console.log('✗ Some sample dreams have validation errors');
  process.exit(1);
}
