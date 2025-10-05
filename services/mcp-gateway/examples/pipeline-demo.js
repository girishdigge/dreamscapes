/**
 * CreativeDreamPipeline Demo
 * Demonstrates how to use the integrated pipeline
 */

const CreativeDreamPipeline = require('../integration/CreativeDreamPipeline');
const PipelineConfig = require('../integration/PipelineConfig');

// Example prompts to demonstrate different features
const examplePrompts = [
  'a dragon flying over mountains at sunset',
  'two ships sailing through stormy seas',
  'a volcano erupting with lava flowing',
  'three birds circling above a forest',
  'a spaceship hovering in deep space',
];

async function runDemo() {
  console.log('='.repeat(80));
  console.log('CreativeDreamPipeline Demo');
  console.log('='.repeat(80));
  console.log();

  // Demo 1: Default Configuration
  console.log('Demo 1: Default Configuration');
  console.log('-'.repeat(80));
  const pipeline1 = new CreativeDreamPipeline();
  const result1 = await pipeline1.process(examplePrompts[0]);

  console.log(`Prompt: "${result1.prompt}"`);
  console.log(`Entities: ${result1.entities.length}`);
  console.log(`Events: ${result1.events.length}`);
  console.log(`Camera Shots: ${result1.camera.length}`);
  console.log(`Processing Time: ${result1.metadata.processingTime}ms`);
  console.log(`Confidence: ${(result1.metadata.confidence * 100).toFixed(1)}%`);
  console.log();

  // Demo 2: Performance Preset
  console.log('Demo 2: Performance Preset');
  console.log('-'.repeat(80));
  const perfConfig = PipelineConfig.getPreset('performance');
  const pipeline2 = new CreativeDreamPipeline(perfConfig);
  const result2 = await pipeline2.process(examplePrompts[1]);

  console.log(`Prompt: "${result2.prompt}"`);
  console.log(`Processing Time: ${result2.metadata.processingTime}ms`);
  console.log(`Events Enabled: ${perfConfig.enableEvents}`);
  console.log();

  // Demo 3: Full Creative Preset
  console.log('Demo 3: Full Creative Preset');
  console.log('-'.repeat(80));
  const fullConfig = PipelineConfig.getPreset('full');
  const pipeline3 = new CreativeDreamPipeline(fullConfig);
  const result3 = await pipeline3.process(examplePrompts[2]);

  console.log(`Prompt: "${result3.prompt}"`);
  console.log(`Duration: ${fullConfig.duration}s`);
  console.log(`Enhancements: ${result3.metadata.enhancements.length}`);
  console.log(`Assumptions: ${result3.metadata.assumptions.length}`);
  console.log();

  // Demo 4: Custom Configuration
  console.log('Demo 4: Custom Configuration');
  console.log('-'.repeat(80));
  const customConfig = {
    enableMotion: true,
    enableEvents: false,
    enableCamera: true,
    duration: 20,
  };
  const pipeline4 = new CreativeDreamPipeline(customConfig);
  const result4 = await pipeline4.process(examplePrompts[3]);

  console.log(`Prompt: "${result4.prompt}"`);
  console.log(`Custom Duration: ${customConfig.duration}s`);
  console.log(`Events: ${result4.events.length} (disabled)`);
  console.log();

  // Demo 5: Batch Processing with Cache
  console.log('Demo 5: Batch Processing with Cache');
  console.log('-'.repeat(80));
  const pipeline5 = new CreativeDreamPipeline();

  console.log('Processing 5 prompts...');
  const startTime = Date.now();

  for (const prompt of examplePrompts) {
    await pipeline5.process(prompt);
  }

  const firstRunTime = Date.now() - startTime;
  console.log(`First run (no cache): ${firstRunTime}ms`);
  console.log(`Cache size: ${pipeline5.getStats().cacheSize}`);

  // Process again (should be faster due to cache)
  const cacheStartTime = Date.now();

  for (const prompt of examplePrompts) {
    await pipeline5.process(prompt);
  }

  const cacheRunTime = Date.now() - cacheStartTime;
  console.log(`Second run (with cache): ${cacheRunTime}ms`);
  console.log(`Speedup: ${(firstRunTime / cacheRunTime).toFixed(1)}x faster`);
  console.log();

  // Demo 6: Detailed Output Inspection
  console.log('Demo 6: Detailed Output Inspection');
  console.log('-'.repeat(80));
  const pipeline6 = new CreativeDreamPipeline();
  const result6 = await pipeline6.process('a dragon flying over mountains');

  console.log(`Prompt: "${result6.prompt}"`);
  console.log();

  console.log('Entities:');
  result6.entities.forEach((entity, i) => {
    console.log(`  ${i + 1}. ${entity.name}`);
    console.log(`     Type: ${entity.type}`);
    console.log(`     Motion: ${entity.motion || 'none'}`);
    console.log(
      `     Position: (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`
    );
  });
  console.log();

  console.log('Environment:');
  console.log(`  Time: ${result6.environment.time}`);
  console.log(`  Weather: ${result6.environment.weather}`);
  console.log(`  Location: ${result6.environment.location}`);
  console.log();

  console.log('Camera Shots:');
  result6.camera.forEach((shot, i) => {
    console.log(
      `  ${i + 1}. ${shot.type} (${shot.startTime}s - ${
        shot.startTime + shot.duration
      }s)`
    );
  });
  console.log();

  console.log('Metadata:');
  console.log(`  Assumptions: ${result6.metadata.assumptions.length}`);
  console.log(`  Enhancements: ${result6.metadata.enhancements.length}`);
  console.log(`  Warnings: ${result6.metadata.warnings.length}`);
  console.log(
    `  Confidence: ${(result6.metadata.confidence * 100).toFixed(1)}%`
  );
  console.log(`  Processing Time: ${result6.metadata.processingTime}ms`);
  console.log();

  // Demo 7: Error Handling
  console.log('Demo 7: Error Handling');
  console.log('-'.repeat(80));
  const pipeline7 = new CreativeDreamPipeline();

  // Test with empty prompt
  const errorResult = await pipeline7.process('');
  console.log(`Empty prompt handled gracefully`);
  console.log(`Warnings: ${errorResult.metadata.warnings.length}`);
  console.log(`Error message: ${errorResult.metadata.error || 'none'}`);
  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('Demo Complete!');
  console.log('='.repeat(80));
  console.log();
  console.log('Key Features Demonstrated:');
  console.log('  ✓ Default configuration');
  console.log('  ✓ Configuration presets (performance, full creative)');
  console.log('  ✓ Custom configuration');
  console.log('  ✓ Batch processing with caching');
  console.log('  ✓ Detailed output inspection');
  console.log('  ✓ Error handling');
  console.log();
  console.log('The CreativeDreamPipeline is ready for production use!');
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };
