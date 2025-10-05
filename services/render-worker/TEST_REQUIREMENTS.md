# Test Requirements for Enhanced 3D Renderer

## Prerequisites

### 1. Chromium Browser

The end-to-end tests require Chromium or Chrome to be installed for Puppeteer to work.

**Installation:**

- **Ubuntu/Debian:**

  ```bash
  sudo apt-get update
  sudo apt-get install chromium-browser
  ```

- **macOS:**

  ```bash
  brew install chromium
  ```

- **Windows:**
  Download from https://www.chromium.org/getting-involved/download-chromium/

**Configuration:**

Set the `CHROMIUM_PATH` or `PUPPETEER_EXECUTABLE_PATH` environment variable:

```bash
# Linux
export CHROMIUM_PATH=/usr/bin/chromium-browser

# macOS
export CHROMIUM_PATH=/Applications/Chromium.app/Contents/MacOS/Chromium

# Windows
set CHROMIUM_PATH=C:\Program Files\Chromium\Application\chromium.exe
```

Or update `services/render-worker/puppeteer/renderEngine.js` to point to your Chrome/Chromium installation.

### 2. FFmpeg (Optional, for video creation)

FFmpeg is required to assemble frames into videos.

**Installation:**

- **Ubuntu/Debian:**

  ```bash
  sudo apt-get install ffmpeg
  ```

- **macOS:**

  ```bash
  brew install ffmpeg
  ```

- **Windows:**
  Download from https://ffmpeg.org/download.html

**Verification:**

```bash
ffmpeg -version
```

## Running Tests

### End-to-End Tests

Tests complete workflow from JSON to video with various quality settings:

```bash
cd services/render-worker
node test-e2e-final.js
```

This will test:

- Multiple resolutions (640x480, 1280x720, 1920x1080, 2560x1440)
- Multiple quality levels (draft, medium, high)
- Multiple frame rates (15, 24, 30, 60 fps)
- Sample dreams from `sample_dreams/` directory
- Video creation (if FFmpeg is available)

### Performance Validation Tests

Tests rendering performance and memory usage:

```bash
cd services/render-worker
node test-performance-validation.js
```

### Cross-Browser Tests

Tests compatibility across different browsers:

```bash
cd services/render-worker
node test-cross-browser.js
```

### Production Readiness Tests

Tests error handling, edge cases, and resource cleanup:

```bash
cd services/render-worker
node test-production-readiness.js
```

## Test Output

All tests save output to `services/render-worker/test-output/`:

- `e2e-final/` - End-to-end test frames and videos
- `performance/` - Performance benchmark results
- `cross-browser/` - Browser compatibility test results
- `production/` - Production readiness test results

## Docker Testing

To run tests in a Docker environment (with Chromium pre-installed):

```bash
docker-compose -f docker-compose.dev.yml up render-worker
docker-compose -f docker-compose.dev.yml exec render-worker node test-e2e-final.js
```

## CI/CD Integration

For automated testing in CI/CD pipelines, ensure:

1. Chromium is installed in the CI environment
2. Set `CHROMIUM_PATH` environment variable
3. Run tests with `--no-sandbox` flag for Docker/CI environments
4. Allocate sufficient memory (minimum 2GB recommended)

Example GitHub Actions workflow:

```yaml
- name: Install Chromium
  run: sudo apt-get install -y chromium-browser

- name: Run E2E Tests
  run: |
    cd services/render-worker
    export CHROMIUM_PATH=/usr/bin/chromium-browser
    node test-e2e-final.js
```

## Troubleshooting

### "Browser was not found" Error

- Verify Chromium is installed: `which chromium` or `which chromium-browser`
- Set correct path in environment variable or `renderEngine.js`
- Try using Chrome instead: `export CHROMIUM_PATH=/usr/bin/google-chrome`

### Out of Memory Errors

- Increase Node.js memory limit: `node --max-old-space-size=4096 test-e2e-final.js`
- Reduce test resolution or duration
- Close other applications

### FFmpeg Not Found

- Install FFmpeg (see above)
- Tests will skip video creation but still validate frame generation

### Slow Performance

- Use draft quality for faster testing
- Reduce resolution and duration
- Run tests on a machine with dedicated GPU

## Expected Results

### Successful Test Run

```
Total Tests: 8
✓ Passed: 8
✗ Failed: 0

Performance Analysis:
  Average Render Time: 12.5s
  Average Frame Size: 85.3KB

  Rendering FPS (frames generated per second):
    Low Resolution - Draft Quality: 6.2 fps
    Medium Resolution - Medium Quality: 4.8 fps
    High Resolution - High Quality: 2.4 fps
```

### Performance Targets

- **Draft Quality (640x480):** 5-10 fps rendering speed
- **Medium Quality (1280x720):** 3-6 fps rendering speed
- **High Quality (1920x1080):** 2-4 fps rendering speed
- **Memory Usage:** < 512MB per render
- **Frame Quality:** 50-150KB per frame (varies by content)

## Manual Verification

After running tests, manually inspect:

1. **Frame Quality:** Open frames in `test-output/` to verify visual correctness
2. **Video Playback:** Play generated videos to verify smooth animation
3. **Console Output:** Check for warnings or errors in test logs
4. **Resource Cleanup:** Verify no memory leaks or orphaned processes
