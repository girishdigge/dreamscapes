/**
 * Build script to embed engine modules into render_template_3d.html
 * This creates a standalone HTML file with all dependencies inlined
 */

const fs = require('fs');
const path = require('path');

// Read engine modules
const engineDir = path.join(__dirname, 'engine');
const templatesDir = path.join(__dirname, 'templates');

const modules = [
  'MaterialSystem.js',
  'AnimationController.js',
  'CameraController.js',
  'AssetLibrary.js',
  'SceneRenderer.js',
];

console.log('Building 3D render template...');

// Read each module and extract the class code (remove export statements)
const moduleCode = modules
  .map((moduleName) => {
    const modulePath = path.join(engineDir, moduleName);
    console.log(`Reading ${moduleName}...`);
    let code = fs.readFileSync(modulePath, 'utf8');

    // Remove the export statement at the end
    code = code.replace(
      /\/\/ Export for browser environment[\s\S]*?window\.\w+ = \w+;[\s\S]*?}/g,
      ''
    );

    return `\n        // ========================================================================\n        // ${moduleName.replace(
      '.js',
      ''
    )}\n        // ========================================================================\n${code}`;
  })
  .join('\n');

// Read the base template
const templatePath = path.join(templatesDir, 'render_template_3d.html');
let template = fs.readFileSync(templatePath, 'utf8');

// Find the insertion point (after the engine modules comment)
const insertionMarker =
  '// ENGINE MODULES - Embedded inline for browser execution';

if (!template.includes(insertionMarker)) {
  console.error('ERROR: Could not find insertion marker in template');
  console.error('Template includes:', template.substring(0, 500));
  process.exit(1);
}

// Insert the module code after the marker line
const lines = template.split('\n');
const markerIndex = lines.findIndex((line) => line.includes(insertionMarker));

if (markerIndex === -1) {
  console.error('ERROR: Marker not found in lines');
  process.exit(1);
}

// Insert after the closing comment line
lines.splice(markerIndex + 2, 0, moduleCode);
template = lines.join('\n');

// Write the updated template
fs.writeFileSync(templatePath, template, 'utf8');

console.log('✓ Successfully embedded all engine modules');
console.log(`✓ Template size: ${(template.length / 1024).toFixed(2)} KB`);
console.log('✓ Build complete!');
