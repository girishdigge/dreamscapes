# CI/CD Integration Guide

This guide shows how to integrate the Enhanced 3D Renderer test suite into various CI/CD pipelines.

## GitHub Actions

Create `.github/workflows/test-3d-renderer.yml`:

```yaml
name: 3D Renderer Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd services/render-worker
          npm ci

      - name: Run 3D Renderer Tests
        run: |
          cd services/render-worker/puppeteer/engine/__tests__
          node run-tests.js

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: services/render-worker/puppeteer/engine/__tests__/test-results.json

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(
              fs.readFileSync('services/render-worker/puppeteer/engine/__tests__/test-results.json', 'utf8')
            );

            const body = `## 🧪 3D Renderer Test Results

            - ✅ Passed: ${results.totalPassed}
            - ❌ Failed: ${results.totalFailed}
            - ⏱️ Duration: ${(results.duration / 1000).toFixed(2)}s

            ${results.totalFailed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed. Please review.'}`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

## GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test

test-3d-renderer:
  stage: test
  image: node:18
  before_script:
    - cd services/render-worker
    - npm ci
  script:
    - cd puppeteer/engine/__tests__
    - node run-tests.js
  artifacts:
    when: always
    paths:
      - services/render-worker/puppeteer/engine/__tests__/test-results.json
    reports:
      junit: services/render-worker/puppeteer/engine/__tests__/test-results.json
  only:
    - main
    - develop
    - merge_requests
```

## Jenkins

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any

    stages {
        stage('Install Dependencies') {
            steps {
                dir('services/render-worker') {
                    sh 'npm ci'
                }
            }
        }

        stage('Run 3D Renderer Tests') {
            steps {
                dir('services/render-worker/puppeteer/engine/__tests__') {
                    sh 'node run-tests.js'
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'services/render-worker/puppeteer/engine/__tests__/test-results.json',
                             allowEmptyArchive: true
        }
        success {
            echo '✅ All 3D Renderer tests passed!'
        }
        failure {
            echo '❌ Some 3D Renderer tests failed!'
        }
    }
}
```

## CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1

jobs:
  test-3d-renderer:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "services/render-worker/package-lock.json" }}
      - run:
          name: Install Dependencies
          command: |
            cd services/render-worker
            npm ci
      - save_cache:
          paths:
            - services/render-worker/node_modules
          key: v1-dependencies-{{ checksum "services/render-worker/package-lock.json" }}
      - run:
          name: Run 3D Renderer Tests
          command: |
            cd services/render-worker/puppeteer/engine/__tests__
            node run-tests.js
      - store_artifacts:
          path: services/render-worker/puppeteer/engine/__tests__/test-results.json
      - store_test_results:
          path: services/render-worker/puppeteer/engine/__tests__/test-results.json

workflows:
  version: 2
  test:
    jobs:
      - test-3d-renderer
```

## Azure Pipelines

Create `azure-pipelines.yml`:

```yaml
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'
    displayName: 'Install Node.js'

  - script: |
      cd services/render-worker
      npm ci
    displayName: 'Install dependencies'

  - script: |
      cd services/render-worker/puppeteer/engine/__tests__
      node run-tests.js
    displayName: 'Run 3D Renderer Tests'

  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: 'services/render-worker/puppeteer/engine/__tests__/test-results.json'
      testRunTitle: '3D Renderer Tests'

  - task: PublishBuildArtifacts@1
    condition: always()
    inputs:
      pathToPublish: 'services/render-worker/puppeteer/engine/__tests__/test-results.json'
      artifactName: 'test-results'
```

## Travis CI

Create `.travis.yml`:

```yaml
language: node_js
node_js:
  - '18'

before_script:
  - cd services/render-worker
  - npm ci

script:
  - cd puppeteer/engine/__tests__
  - node run-tests.js

after_script:
  - cat test-results.json

cache:
  directories:
    - services/render-worker/node_modules
```

## Docker Integration

Create `Dockerfile.test`:

```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY services/render-worker/package*.json ./services/render-worker/

# Install dependencies
RUN cd services/render-worker && npm ci

# Copy test files
COPY services/render-worker/puppeteer ./services/render-worker/puppeteer

# Run tests
WORKDIR /app/services/render-worker/puppeteer/engine/__tests__
CMD ["node", "run-tests.js"]
```

Build and run:

```bash
docker build -f Dockerfile.test -t 3d-renderer-tests .
docker run --rm 3d-renderer-tests
```

## NPM Scripts

Add to `services/render-worker/package.json`:

```json
{
  "scripts": {
    "test:3d": "node puppeteer/engine/__tests__/run-tests.js",
    "test:3d:verify": "node puppeteer/engine/__tests__/verify-tests.js",
    "test:3d:browser": "open puppeteer/engine/__tests__/run-all-tests.html"
  }
}
```

Usage:

```bash
npm run test:3d          # Run tests via CLI
npm run test:3d:verify   # Verify test suite
npm run test:3d:browser  # Open browser test runner
```

## Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running 3D Renderer tests..."

cd services/render-worker/puppeteer/engine/__tests__
node run-tests.js

if [ $? -ne 0 ]; then
    echo "❌ 3D Renderer tests failed. Commit aborted."
    exit 1
fi

echo "✅ All tests passed!"
exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Test Result Parsing

The `test-results.json` file has this structure:

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
  "totalPassed": 57,
  "totalFailed": 0,
  "duration": 12345
}
```

You can parse this in your CI/CD scripts to:

- Generate custom reports
- Send notifications
- Update dashboards
- Block merges on failures

## Slack Notifications

Example script to send results to Slack:

```bash
#!/bin/bash

# Run tests
cd services/render-worker/puppeteer/engine/__tests__
node run-tests.js
TEST_EXIT_CODE=$?

# Parse results
RESULTS=$(cat test-results.json)
PASSED=$(echo $RESULTS | jq '.totalPassed')
FAILED=$(echo $RESULTS | jq '.totalFailed')
DURATION=$(echo $RESULTS | jq '.duration')

# Send to Slack
if [ $TEST_EXIT_CODE -eq 0 ]; then
    MESSAGE="✅ 3D Renderer Tests Passed: $PASSED tests in ${DURATION}ms"
    COLOR="good"
else
    MESSAGE="❌ 3D Renderer Tests Failed: $FAILED failures out of $((PASSED + FAILED)) tests"
    COLOR="danger"
fi

curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"$MESSAGE\",\"color\":\"$COLOR\"}" \
    $SLACK_WEBHOOK_URL
```

## Performance Monitoring

Track test performance over time:

```bash
#!/bin/bash

# Run tests and capture duration
cd services/render-worker/puppeteer/engine/__tests__
node run-tests.js

# Extract duration
DURATION=$(jq '.duration' test-results.json)

# Log to monitoring system (e.g., Datadog, New Relic)
curl -X POST "https://api.datadoghq.com/api/v1/series" \
    -H "Content-Type: application/json" \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -d "{
        \"series\": [{
            \"metric\": \"3d_renderer.test.duration\",
            \"points\": [[$(date +%s), $DURATION]],
            \"type\": \"gauge\"
        }]
    }"
```

## Best Practices

1. **Run tests on every commit** to catch regressions early
2. **Cache dependencies** to speed up CI/CD runs
3. **Parallelize tests** if possible (split test suites)
4. **Set timeouts** to prevent hanging builds
5. **Archive test results** for historical analysis
6. **Send notifications** on failures
7. **Block merges** if tests fail
8. **Monitor performance** trends over time

## Troubleshooting CI/CD

### Tests timeout

- Increase timeout in CI/CD config
- Check for infinite loops in tests
- Verify browser launches correctly

### Chrome/Chromium not found

- Install Chrome in CI environment
- Set `PUPPETEER_EXECUTABLE_PATH`
- Use Docker image with Chrome pre-installed

### Memory issues

- Increase memory allocation in CI
- Run fewer tests in parallel
- Use `--max-old-space-size` flag

### Flaky tests

- Ensure tests are deterministic
- Add proper wait conditions
- Increase timeouts for slow operations

---

For more information, see the main [README.md](./README.md).
