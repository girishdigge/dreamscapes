/**
 * Async Utility Helpers
 *
 * Provides utility functions for ensuring proper async/await handling
 * and preventing Promise leakage in the response processing pipeline.
 *
 * @module utils/asyncHelpers
 */

/**
 * Ensures a value is fully resolved (not a Promise).
 *
 * This function is critical for preventing Promise leakage in the response
 * processing pipeline. It handles both Promise and non-Promise values safely.
 *
 * @async
 * @param {*} value - Value that might be a Promise or a resolved value
 * @returns {Promise<*>} The resolved value
 *
 * @example
 * // With a Promise
 * const promise = Promise.resolve({ id: '123', data: 'test' });
 * const resolved = await ensureResolved(promise);
 * console.log(resolved); // { id: '123', data: 'test' }
 *
 * @example
 * // With a non-Promise value
 * const value = { id: '123', data: 'test' };
 * const resolved = await ensureResolved(value);
 * console.log(resolved); // { id: '123', data: 'test' }
 *
 * @example
 * // With nested Promises
 * const nested = Promise.resolve(Promise.resolve('data'));
 * const resolved = await ensureResolved(nested);
 * console.log(resolved); // 'data'
 */
async function ensureResolved(value) {
  if (value instanceof Promise) {
    return await value;
  }
  return value;
}

/**
 * Validates that an object doesn't contain any Promise values.
 *
 * This function performs a shallow inspection of an object to detect
 * any properties that are Promises. This is essential for catching
 * async/await bugs where Promises are not properly awaited.
 *
 * @param {*} obj - Object to validate (can be any type)
 * @param {string} [context='object'] - Context description for error messages
 * @param {Object} [metricsTracker=null] - Optional metrics tracker for recording Promise detections
 * @param {string} [provider='unknown'] - Provider name for metrics tracking
 * @throws {Error} If the value itself is a Promise or if any property is a Promise
 *
 * @example
 * // Valid object - no error
 * const validObj = {
 *   content: 'resolved data',
 *   tokens: { input: 100, output: 50 }
 * };
 * validateNoPromises(validObj, 'result'); // No error
 *
 * @example
 * // Invalid - object property is a Promise
 * const invalidObj = {
 *   content: Promise.resolve('data'),
 *   tokens: { input: 100 }
 * };
 * validateNoPromises(invalidObj, 'result');
 * // Throws: Error: result.content is a Promise and should be resolved
 *
 * @example
 * // Invalid - value itself is a Promise
 * const promise = Promise.resolve('data');
 * validateNoPromises(promise, 'response');
 * // Throws: Error: response is a Promise and should be resolved
 */
function validateNoPromises(
  obj,
  context = 'object',
  metricsTracker = null,
  provider = 'unknown'
) {
  // Check if the value itself is a Promise
  if (obj instanceof Promise) {
    // Record Promise detection in metrics
    if (
      metricsTracker &&
      typeof metricsTracker.recordPromiseDetection === 'function'
    ) {
      metricsTracker.recordPromiseDetection(context, provider, {
        type: 'value',
        timestamp: new Date().toISOString(),
      });
    }

    throw new Error(`${context} is a Promise and should be resolved`);
  }

  // Check object properties for Promises (shallow inspection)
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Promise) {
        const location = `${context}.${key}`;

        // Record Promise detection in metrics
        if (
          metricsTracker &&
          typeof metricsTracker.recordPromiseDetection === 'function'
        ) {
          metricsTracker.recordPromiseDetection(location, provider, {
            type: 'property',
            property: key,
            timestamp: new Date().toISOString(),
          });
        }

        throw new Error(`${location} is a Promise and should be resolved`);
      }
    }
  }
}

module.exports = {
  ensureResolved,
  validateNoPromises,
};
