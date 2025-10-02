// tests/testSequencer.js
// Custom test sequencer to optimize test execution order

const Sequencer = require('@jest/test-sequencer').default;

class CustomTestSequencer extends Sequencer {
  sort(tests) {
    // Define test priority order (lower number = higher priority)
    const testPriorities = {
      unit: 1, // Run unit tests first (fastest)
      mocks: 2, // Run mock tests early
      integration: 3, // Run integration tests after unit tests
      quality: 4, // Run quality tests after core functionality
      monitoring: 5, // Run monitoring tests after main features
      performance: 6, // Run performance tests last (slowest)
    };

    // Sort tests by priority, then by file path for consistency
    return tests.sort((testA, testB) => {
      // Determine test type from path
      const getTestType = (testPath) => {
        for (const [type, priority] of Object.entries(testPriorities)) {
          if (
            testPath.includes(`/${type}/`) ||
            testPath.includes(`${type}.test.js`)
          ) {
            return { type, priority };
          }
        }
        return { type: 'other', priority: 99 };
      };

      const typeA = getTestType(testA.path);
      const typeB = getTestType(testB.path);

      // First, sort by priority
      if (typeA.priority !== typeB.priority) {
        return typeA.priority - typeB.priority;
      }

      // Then, sort by file path for consistency
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomTestSequencer;
