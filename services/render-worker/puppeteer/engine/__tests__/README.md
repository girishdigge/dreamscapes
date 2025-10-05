# Enhanced 3D Renderer - Test Suite

Comprehensive test suite for the Enhanced 3D Renderer engine, covering all modules and integration scenarios.

## Test Coverage

### 12.1 SceneRenderer Tests (`SceneRenderer.test.js`)

- ✅ Initialization creates scene, camera, renderer
- ✅ initWithDream() parses JSON correctly
- ✅ seek() renders at correct time
- ✅ dispose() cleans up resources
- ✅ Quality levels affect rendering configuration
- ✅ Resize handling

**Requirements Covered:** 1.1, 1.3, 1.7

### 12.2 AssetLibrary Tests (`AssetLibrary.test.js`)

- ✅ Each structure type creates valid geometry (16 types)
- ✅ Geometry caching works correctly
- ✅ Features are applied properly (glowing_edges, emissive, animated, etc.)
- ✅ Unknown types fall back gracefully
- ✅ Material properties are applied correctly
- ✅ Rotation is applied correctly
- ✅ Entity creation (particle systems)
- ✅ Quality settings affect geometry detail

**Requirements Covered:** 2.1-2.13, 11.1

### 12.3 MaterialSystem Tests (`MaterialSystem.test.js`)

- ✅ Each skybox type creates valid material (5 types)
- ✅ Shader compilation succeeds
- ✅ Material caching works correctly
- ✅ Invalid parameters use defaults
- ✅ PBR material properties
- ✅ Emissive material creation
- ✅ Transparent material creation
- ✅ Water material creation
- ✅ Quality settings affect material complexity
- ✅ Shader uniform updates

**Requirements Covered:** 3.1-3.9, 11.2

### 12.4 AnimationController Tests (`AnimationController.test.js`)

- ✅ Each animation type produces correct transforms (orbit, float, pulse, rotate)
- ✅ Animations are deterministic
- ✅ Multiple animations combine correctly
- ✅ Orbit animation with different axes
- ✅ Float animation parameters
- ✅ Pulse animation parameters
- ✅ Rotate animation with different axes
- ✅ Animation removal
- ✅ Particle system updates

**Requirements Covered:** 6.1-6.8

### 12.5 CameraController Tests (`CameraController.test.js`)

- ✅ Each shot type positions camera correctly (orbital, flythrough, establish, close_up, pull_back)
- ✅ Interpolation is smooth
- ✅ Shot transitions work properly
- ✅ Orbital shot parameters
- ✅ Flythrough shot with path
- ✅ Close-up shot targeting
- ✅ Pull-back shot distance change
- ✅ Default camera behavior when no shots specified
- ✅ Camera lookAt target
- ✅ Easing functions
- ✅ Shot duration handling

**Requirements Covered:** 7.1-7.9

### 12.6 Integration Tests (`integration.test.js`)

- ✅ Complete scene rendering with all structure types
- ✅ Puppeteer integration end-to-end
- ✅ Performance with 100 objects
- ✅ Performance with 500 objects
- ✅ Performance with 1000 objects
- ✅ Memory usage stays under 512MB
- ✅ Animation consistency across frames
- ✅ Error recovery and graceful degradation

**Requirements Covered:** 1.3, 1.4, 9.1, 9.3, 9.4

### 12.7 Visual Regression Tests (`visual-regression.test.js`)

- ✅ Generate reference frames for standard scenes
- ✅ Compare new renders against references
- ✅ Animation consistency at different time points
- ✅ Different skybox types render consistently
- ✅ Complex scene visual consistency
- ✅ Camera shot transitions are smooth

**Requirements Covered:** 10.7

## Running Tests

### Browser-Based Tests (Recommended for Development)

1. Open `run-all-tests.html` in a web browser:

   ```bash
   # Windows
   start services/render-worker/puppeteer/engine/__tests__/run-all-tests.html

   # macOS
   open services/render-worker/puppeteer/engine/__tests__/run-all-tests.html

   # Linux
   xdg-open services/render-worker/puppeteer/engine/__tests__/run-all-tests.html
   ```

2. Click "▶ Run All Tests" to execute the complete test suite

3. Use the other buttons to run specific test categories:
   - **Run Unit Tests Only** - Runs tests for individual modules
   - **Run Integration Tests** - Runs integration and visual regression tests
   - **Clear Results** - Clears the test output

### Command-Line Tests (CI/CD)

Run tests via Node.js with Puppeteer:

```bash
cd services/render-worker/puppeteer/engine/__tests__
node run-tests.js
```

This will:

- Launch a headless browser
- Run all test suites
- Display results in the console
- Generate a `test-results.json` report
- Exit with code 0 (success) or 1 (failure)

### Individual Test Files

You can also run individual test files by including them in a custom HTML page:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="../SceneRenderer.js"></script>
<script src="./SceneRenderer.test.js"></script>
<script>
  const tests = new SceneRendererTests();
  tests.runAll();
</script>
```

## Test Structure

Each test file follows this structure:

```javascript
class TestSuiteTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  async testSomething() {
    // Test implementation
    this.assert(condition, 'Error message');
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  async runTest(testName, testFn) {
    // Test runner logic
  }

  async runAll() {
    // Run all tests and return results
  }
}
```

## Performance Benchmarks

The integration tests include performance benchmarks:

- **100 objects**: < 5s initialization, < 100ms per frame (10+ FPS)
- **500 objects**: < 10s initialization, < 150ms per frame (6+ FPS)
- **1000 objects**: < 20s initialization, < 200ms per frame (5+ FPS)
- **Memory usage**: < 512MB for complex scenes

## Continuous Integration

To integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run 3D Renderer Tests
  run: |
    cd services/render-worker/puppeteer/engine/__tests__
    node run-tests.js
```

The test runner will:

- Exit with code 0 if all tests pass
- Exit with code 1 if any tests fail
- Generate `test-results.json` for further analysis

## Test Results Format

The `test-results.json` file contains:

```json
{
  "suites": [
    {
      "suite": "SceneRenderer",
      "passed": 6,
      "failed": 0,
      "results": [
        {
          "test": "Initialization creates scene, camera, renderer",
          "status": "PASS"
        }
      ]
    }
  ],
  "totalPassed": 50,
  "totalFailed": 0,
  "duration": 12345
}
```

## Troubleshooting

### Tests fail to load in browser

- Ensure all engine files are in the correct location
- Check browser console for JavaScript errors
- Verify Three.js CDN is accessible

### Puppeteer tests fail

- Install Puppeteer: `npm install puppeteer`
- Ensure Chrome/Chromium is installed
- Check for sufficient system resources

### Performance tests fail

- Performance benchmarks may vary by hardware
- Adjust thresholds in test files if needed
- Run tests on dedicated hardware for consistent results

### Memory tests show "API not available"

- `performance.memory` is only available in Chrome
- Tests will skip memory checks in other browsers
- This is expected behavior

## Contributing

When adding new features:

1. Add corresponding tests to the appropriate test file
2. Update this README with new test coverage
3. Ensure all tests pass before submitting PR
4. Add performance benchmarks for new features if applicable

## License

Same as parent project.
