/**
 * Diagnostic script to check API route file access
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing API Route File Access\n');

// Get current directory
const cwd = process.cwd();
console.log('Current working directory:', cwd);
console.log('');

// Check if sample_dreams directory exists
const sampleDreamsPath = path.join(cwd, 'sample_dreams');
console.log('Checking sample_dreams directory...');
console.log('Path:', sampleDreamsPath);

if (fs.existsSync(sampleDreamsPath)) {
  console.log('✅ sample_dreams directory exists\n');

  // List all JSON files
  const files = fs
    .readdirSync(sampleDreamsPath)
    .filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} JSON files:`);
  files.forEach((file) => {
    const filePath = path.join(sampleDreamsPath, file);
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
} else {
  console.log('❌ sample_dreams directory NOT FOUND\n');
}

// Test path resolution from different starting points
console.log('\n📍 Testing Path Resolution:\n');

const testPaths = [
  {
    name: 'From project root',
    path: path.join(cwd, 'sample_dreams', 'star_collision.json'),
  },
  {
    name: 'From services/frontend/next-app',
    path: path.join(
      cwd,
      'services',
      'frontend',
      'next-app',
      '..',
      '..',
      '..',
      'sample_dreams',
      'star_collision.json'
    ),
  },
];

testPaths.forEach(({ name, path: testPath }) => {
  const exists = fs.existsSync(testPath);
  console.log(`${name}:`);
  console.log(`  Path: ${testPath}`);
  console.log(`  ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  console.log('');
});

// Check Next.js API route file
console.log('📄 Checking API Route File:\n');
const apiRoutePath = path.join(
  cwd,
  'services',
  'frontend',
  'next-app',
  'app',
  'api',
  'sample-dreams',
  '[filename]',
  'route.ts'
);
console.log('Path:', apiRoutePath);

if (fs.existsSync(apiRoutePath)) {
  console.log('✅ API route file exists');
  const content = fs.readFileSync(apiRoutePath, 'utf8');

  // Check if it has the multi-path logic
  if (content.includes('possiblePaths')) {
    console.log('✅ Multi-path logic present');
  } else {
    console.log('⚠️  Multi-path logic NOT found - may need update');
  }

  if (content.includes('console.log')) {
    console.log('✅ Logging enabled for debugging');
  }
} else {
  console.log('❌ API route file NOT FOUND');
}

console.log('\n' + '='.repeat(60));
console.log('💡 Recommendations:\n');

if (fs.existsSync(sampleDreamsPath)) {
  console.log('1. ✅ Files are in correct location');
  console.log('2. 🔄 Restart Next.js dev server to pick up route changes');
  console.log('3. 🌐 Test in browser: http://localhost:3000');
  console.log('4. 👀 Check Next.js terminal for path resolution logs');
  console.log(
    '5. 🧪 Test API directly: curl http://localhost:3000/api/sample-dreams/star_collision.json'
  );
} else {
  console.log('❌ sample_dreams directory not found!');
  console.log('   Make sure you are running this from the project root');
  console.log('   Expected structure:');
  console.log('   project-root/');
  console.log('   ├── sample_dreams/');
  console.log('   │   ├── star_collision.json');
  console.log('   │   └── ...');
  console.log('   └── services/');
  console.log('       └── frontend/');
  console.log('           └── next-app/');
}

console.log('='.repeat(60));
