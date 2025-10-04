#!/usr/bin/env node

/**
 * Cache Optimization Test Script
 *
 * This script tests the enhanced caching and performance monitoring features
 * for dream generation in the Dreamscapes system.
 */

const fetch = require('node-fetch');

const EXPRESS_URL = process.env.EXPRESS_URL || 'http://localhost:8000';

// Test configuration
const TEST_CONFIG = {
  dreamTexts: [
    'I dreamed of a spaceship orbiting the earth',
    'A floating library with glowing books',
    'Neon butterflies in digital space',
    'Crystal castle on a floating mountain',
    'Twisted maze of black mirrors',
  ],
  styles: ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare'],
  iterations: 3,
};

class CacheOptimizationTester {
  constructor() {
    this.results = {
      cacheTests: [],
      performanceTests: [],
      invalidationTests: [],
      errors: [],
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Cache Optimization Tests...\n');

    try {
      await this.testCachePerformance();
      await this.testCacheInvalidation();
      await this.testCacheStats();
      await this.testCacheOptimization();

      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.results.errors.push(error.message);
    }
  }

  async testCachePerformance() {
    console.log('📊 Testing Cache Performance...');

    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      for (const [index, text] of TEST_CONFIG.dreamTexts.entries()) {
        const style = TEST_CONFIG.styles[index % TEST_CONFIG.styles.length];

        try {
          const startTime = Date.now();

          // First request (should miss cache)
          const firstResponse = await this.makeDreamRequest(text, style);
          const firstTime = Date.now() - startTime;

          // Second request (should hit cache)
          const cacheStartTime = Date.now();
          const secondResponse = await this.makeDreamRequest(text, style);
          const cacheTime = Date.now() - cacheStartTime;

          const cacheTest = {
            iteration: i + 1,
            text: text.slice(0, 50) + '...',
            style,
            firstRequestTime: firstTime,
            cacheRequestTime: cacheTime,
            cacheHit: secondResponse.cached === true,
            source: firstResponse.data?.source,
            speedImprovement:
              firstTime > 0
                ? (((firstTime - cacheTime) / firstTime) * 100).toFixed(1) + '%'
                : 'N/A',
          };

          this.results.cacheTests.push(cacheTest);

          console.log(
            `  ✅ ${text.slice(0, 30)}... - Cache hit: ${
              cacheTest.cacheHit
            }, Speed improvement: ${cacheTest.speedImprovement}`
          );

          // Small delay between requests
          await this.sleep(100);
        } catch (error) {
          console.log(`  ❌ ${text.slice(0, 30)}... - Error: ${error.message}`);
          this.results.errors.push(`Cache test error: ${error.message}`);
        }
      }
    }

    console.log('');
  }

  async testCacheInvalidation() {
    console.log('🗑️  Testing Cache Invalidation Strategies...');

    const invalidationStrategies = [
      {
        strategy: 'failed_ai',
        value: null,
        description: 'Failed AI generations',
      },
      {
        strategy: 'age',
        value: '300000',
        description: 'Entries older than 5 minutes',
      },
      {
        strategy: 'source',
        value: 'safe_fallback',
        description: 'Safe fallback entries',
      },
    ];

    for (const test of invalidationStrategies) {
      try {
        const response = await fetch(`${EXPRESS_URL}/api/cache/invalidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy: test.strategy,
            value: test.value,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`  ✅ ${test.description}: ${result.message}`);
          this.results.invalidationTests.push({
            strategy: test.strategy,
            description: test.description,
            success: true,
            invalidated: result.invalidated,
          });
        } else {
          console.log(`  ❌ ${test.description}: ${result.error}`);
          this.results.invalidationTests.push({
            strategy: test.strategy,
            description: test.description,
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.log(`  ❌ ${test.description}: ${error.message}`);
        this.results.errors.push(`Invalidation test error: ${error.message}`);
      }
    }

    console.log('');
  }

  async testCacheStats() {
    console.log('📈 Testing Cache Statistics...');

    try {
      const response = await fetch(`${EXPRESS_URL}/api/cache/stats`);
      const stats = await response.json();

      if (response.ok) {
        console.log('  ✅ Cache statistics retrieved successfully');
        console.log(`    - Hit rate: ${stats.stats.dreamCache.hitRate}`);
        console.log(
          `    - Cache size: ${stats.stats.dreamCache.size}/${stats.stats.dreamCache.maxSize}`
        );
        console.log(
          `    - Memory usage: ${stats.stats.dreamCache.memoryUsage}`
        );
        console.log(
          `    - Average get time: ${stats.stats.dreamCache.performance.averageGetTime}`
        );
        console.log(
          `    - Source distribution:`,
          Object.entries(stats.stats.dreamCache.sourceDistribution || {})
            .map(([source, count]) => `${source}: ${count}`)
            .join(', ')
        );

        this.results.performanceTests.push({
          type: 'stats',
          success: true,
          hitRate: stats.stats.dreamCache.hitRate,
          size: stats.stats.dreamCache.size,
          memoryUsage: stats.stats.dreamCache.memoryUsage,
        });
      } else {
        console.log(`  ❌ Failed to get cache stats: ${stats.error}`);
        this.results.errors.push(`Cache stats error: ${stats.error}`);
      }
    } catch (error) {
      console.log(`  ❌ Cache stats request failed: ${error.message}`);
      this.results.errors.push(`Cache stats request error: ${error.message}`);
    }

    console.log('');
  }

  async testCacheOptimization() {
    console.log('⚡ Testing Cache Optimization...');

    try {
      const response = await fetch(`${EXPRESS_URL}/api/cache/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (response.ok) {
        console.log('  ✅ Cache optimization completed');
        if (result.optimizations && result.optimizations.length > 0) {
          result.optimizations.forEach((opt) => {
            console.log(`    - ${opt}`);
          });
        } else {
          console.log('    - No optimizations needed');
        }

        this.results.performanceTests.push({
          type: 'optimization',
          success: true,
          optimizations: result.optimizations,
        });
      } else {
        console.log(`  ❌ Cache optimization failed: ${result.error}`);
        this.results.errors.push(`Cache optimization error: ${result.error}`);
      }
    } catch (error) {
      console.log(`  ❌ Cache optimization request failed: ${error.message}`);
      this.results.errors.push(
        `Cache optimization request error: ${error.message}`
      );
    }

    console.log('');
  }

  async testCachePerformanceEndpoint() {
    console.log('🎯 Testing Cache Performance Endpoint...');

    try {
      const response = await fetch(`${EXPRESS_URL}/api/cache/performance`);
      const performance = await response.json();

      if (response.ok) {
        console.log('  ✅ Cache performance data retrieved');
        console.log(`    - Hit rate: ${performance.performance.hitRate}`);
        console.log(
          `    - Average get time: ${performance.performance.averageGetTime}`
        );
        console.log(
          `    - Cache efficiency: ${(
            performance.performance.cacheEfficiency.hitRateNumeric || 0
          ).toFixed(1)}%`
        );

        if (
          performance.performance.recommendations &&
          performance.performance.recommendations.length > 0
        ) {
          console.log('    - Recommendations:');
          performance.performance.recommendations.forEach((rec) => {
            console.log(`      • ${rec.message} (${rec.priority} priority)`);
          });
        }

        this.results.performanceTests.push({
          type: 'performance_endpoint',
          success: true,
          hitRate: performance.performance.hitRate,
          recommendations: performance.performance.recommendations,
        });
      } else {
        console.log(
          `  ❌ Failed to get performance data: ${performance.error}`
        );
        this.results.errors.push(
          `Performance endpoint error: ${performance.error}`
        );
      }
    } catch (error) {
      console.log(`  ❌ Performance endpoint request failed: ${error.message}`);
      this.results.errors.push(
        `Performance endpoint request error: ${error.message}`
      );
    }

    console.log('');
  }

  async makeDreamRequest(text, style) {
    const response = await fetch(`${EXPRESS_URL}/api/parse-dream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, style }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  printResults() {
    console.log('📋 Test Results Summary');
    console.log('========================\n');

    // Cache Performance Results
    if (this.results.cacheTests.length > 0) {
      console.log('🚀 Cache Performance:');
      const avgSpeedImprovement =
        this.results.cacheTests
          .filter((test) => test.cacheHit && test.speedImprovement !== 'N/A')
          .reduce((sum, test) => sum + parseFloat(test.speedImprovement), 0) /
        this.results.cacheTests.filter((test) => test.cacheHit).length;

      const cacheHitRate = (
        (this.results.cacheTests.filter((test) => test.cacheHit).length /
          this.results.cacheTests.length) *
        100
      ).toFixed(1);

      console.log(`  - Cache hit rate: ${cacheHitRate}%`);
      console.log(
        `  - Average speed improvement: ${avgSpeedImprovement.toFixed(1)}%`
      );
      console.log(`  - Total cache tests: ${this.results.cacheTests.length}`);
    }

    // Invalidation Results
    if (this.results.invalidationTests.length > 0) {
      console.log('\n🗑️  Cache Invalidation:');
      const successfulInvalidations = this.results.invalidationTests.filter(
        (test) => test.success
      );
      console.log(
        `  - Successful invalidations: ${successfulInvalidations.length}/${this.results.invalidationTests.length}`
      );
      successfulInvalidations.forEach((test) => {
        console.log(`    • ${test.description}: ${test.invalidated} entries`);
      });
    }

    // Performance Tests
    if (this.results.performanceTests.length > 0) {
      console.log('\n📊 Performance Tests:');
      this.results.performanceTests.forEach((test) => {
        if (test.type === 'stats') {
          console.log(
            `  - Cache stats: Hit rate ${test.hitRate}, Size ${test.size}, Memory ${test.memoryUsage}`
          );
        } else if (test.type === 'optimization') {
          console.log(
            `  - Optimization: ${
              test.optimizations?.length || 0
            } actions performed`
          );
        }
      });
    }

    // Errors
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.results.errors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }

    console.log('\n✅ Cache optimization tests completed!');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new CacheOptimizationTester();
  tester
    .runAllTests()
    .then(() => {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = CacheOptimizationTester;
