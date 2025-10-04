# Dreamscapes End-to-End Integration Tests

This directory contains comprehensive end-to-end integration tests for the Dreamscapes application. These tests verify that all services work together correctly and that the complete dream generation pipeline functions as expected.

## Overview

The E2E test suite includes:

1. **Complete Docker Compose startup verification**
2. **Service health endpoint testing**
3. **Inter-service communication testing**
4. **API request flow testing**
5. **Dream generation pipeline testing**
6. **Automated reporting and cleanup**

## Test Files

### Core Test Files

- **`e2e-integration-test.js`** - Main comprehensive E2E test suite
- **`run-e2e-tests.js`** - Test runner with options and error handling
- **`test-service-communication.js`** - Focused service communication tests
- **`verify-services.js`** - Individual service verification (existing)

### Configuration

- **`package.json`** - NPM scripts and dependencies for testing
- **`README-E2E-TESTS.md`** - This documentation file

## Quick Start

### Prerequisites

Ensure you have the following installed:

- Docker and Docker Compose
- Node.js (v14 or higher)
- NPM

### Running Tests

```bash
# Navigate to the scripts directory
cd scripts

# Install test dependencies
npm install

# Run complete E2E test suite
npm run e2e

# Run quick tests (skip dream generation)
npm run e2e-quick

# Run with verbose output
npm run e2e-verbose

# Test only service communication
npm run test-communication

# Cleanup containers only
npm run cleanup
```

## Test Categories

### 1. Docker Compose Startup Test

**Purpose**: Verify that all services start correctly with `docker-compose up --build`

**What it tests**:

- All services build successfully
- Services start without crashes
- No "module not found" or import errors
- Services reach running state

**Requirements covered**: 1.1, 1.2

### 2. Service Health Tests

**Purpose**: Verify all services respond to health check requests

**What it tests**:

- Express Orchestrator `/health` endpoint
- MCP Gateway `/health` endpoint
- Render Worker `/health` endpoint
- Llama Stylist `/health` endpoint
- Frontend accessibility

**Requirements covered**: 1.3

### 3. Service Communication Tests

**Purpose**: Verify services can communicate with each other

**What it tests**:

- Express → MCP Gateway communication
- Express → Llama Stylist communication
- Express → Render Worker communication
- MCP Gateway → Llama Stylist communication

**Requirements covered**: 1.1, 1.2, 1.3

### 4. API Flow Tests

**Purpose**: Test API endpoints that coordinate multiple services

**What it tests**:

- API documentation endpoint
- Sample dreams endpoint
- Dreams list endpoint
- Error handling and responses

**Requirements covered**: 1.1, 1.2

### 5. Dream Generation Pipeline Tests

**Purpose**: Test the complete end-to-end dream generation workflow

**What it tests**:

- Dream parsing (text → structured data)
- Dream patching (modifications)
- Dream export (video generation)
- Complete pipeline integration

**Requirements covered**: 1.1, 1.2, 1.3

## Test Configuration

### Timeouts

- **Docker Startup**: 3 minutes (180s)
- **Service Health**: 10 seconds per check
- **API Requests**: 30 seconds
- **Dream Generation**: 60 seconds (extended for processing)

### Retry Logic

- **Health Checks**: 12 retries with 5-second intervals
- **API Requests**: 3 retries with exponential backoff
- **Service Communication**: 3 retries

### Sample Data

The tests use predefined sample dreams:

```json
{
  "text": "A house that grows like a tree with rooms as leaves...",
  "style": "surreal",
  "expectedDuration": 35
}
```

## Command Line Options

### `run-e2e-tests.js` Options

```bash
# Skip Docker image rebuilding (faster for repeated runs)
npm run e2e -- --skip-build

# Run only quick tests (skip dream generation pipeline)
npm run e2e -- --quick

# Enable verbose logging for debugging
npm run e2e -- --verbose

# Set custom timeout (in seconds)
npm run e2e -- --timeout=600

# Only run cleanup (stop containers)
npm run e2e -- --cleanup-only
```

## Test Reports

### Generated Files

After running tests, the following files are generated:

- **`../e2e-test-results.json`** - Detailed JSON results
- **`../e2e-test-report.html`** - Human-readable HTML report
- **`../service-communication-test-results.json`** - Communication test results

### Report Contents

The reports include:

- **Summary Statistics**: Pass/fail counts, success rates, duration
- **Service Health Status**: Individual service health results
- **Communication Results**: Inter-service communication test results
- **API Test Results**: Endpoint response validation
- **Dream Pipeline Results**: Complete workflow test results
- **Performance Metrics**: Response times and resource usage
- **Error Details**: Specific failure information and stack traces

## Troubleshooting

### Common Issues

#### Docker Startup Failures

```bash
# Check Docker is running
docker --version
docker-compose --version

# Check for port conflicts
docker ps
netstat -tulpn | grep :3000

# Clean up existing containers
npm run cleanup
```

#### Service Health Check Failures

```bash
# Check individual service logs
docker-compose logs express
docker-compose logs mcp-gateway
docker-compose logs llama-stylist

# Test individual service startup
cd ../services/express && npm start
```

#### Import/Export Errors

```bash
# Run individual service verification
npm run verify

# Check for missing dependencies
cd ../services/[service-name] && npm install
```

### Debug Mode

For detailed debugging:

```bash
# Run with maximum verbosity
npm run e2e-verbose

# Run individual test components
node test-service-communication.js
node verify-services.js

# Check Docker Compose logs during test
docker-compose logs -f
```

### Performance Issues

If tests are timing out:

```bash
# Increase timeout
npm run e2e -- --timeout=900

# Skip resource-intensive tests
npm run e2e-quick

# Check system resources
docker stats
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install dependencies
        run: cd scripts && npm install

      - name: Run E2E tests
        run: cd scripts && npm run e2e

      - name: Upload test reports
        uses: actions/upload-artifact@v2
        if: always()
        with:
          name: test-reports
          path: |
            e2e-test-results.json
            e2e-test-report.html
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('E2E Tests') {
            steps {
                dir('scripts') {
                    sh 'npm install'
                    sh 'npm run e2e'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: '*.json,*.html', fingerprint: true
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'e2e-test-report.html',
                        reportName: 'E2E Test Report'
                    ])
                }
            }
        }
    }
}
```

## Development Workflow

### Before Committing Code

```bash
# Run quick verification
npm run verify

# Run communication tests
npm run test-communication

# Run full E2E suite (if time permits)
npm run e2e
```

### After Major Changes

```bash
# Clean rebuild and test
npm run cleanup
npm run e2e -- --verbose
```

### Regular Maintenance

```bash
# Weekly full test run
npm run e2e

# Update test data if needed
# Edit sample_dreams/*.json files

# Review and update test expectations
# Check test timeouts and retry counts
```

## Contributing

### Adding New Tests

1. **Service Tests**: Add to `test-service-communication.js`
2. **API Tests**: Add to `e2e-integration-test.js` in `testApiFlow()`
3. **Pipeline Tests**: Add to `testDreamGeneration()`

### Test Data

- Add new sample dreams to `../sample_dreams/`
- Update `SAMPLE_DREAMS` array in test files
- Ensure test data covers edge cases

### Performance Considerations

- Keep individual tests under 30 seconds
- Use appropriate timeouts for different test types
- Implement proper cleanup to avoid resource leaks
- Consider parallel execution for independent tests

## Support

For issues with the E2E test suite:

1. Check the generated HTML report for detailed error information
2. Run tests with `--verbose` flag for additional debugging output
3. Verify individual services work with `npm run verify`
4. Check Docker logs for service-specific issues
5. Ensure all prerequisites are installed and up to date

## Requirements Traceability

This test suite addresses the following requirements from the specification:

- **Requirement 1.1**: All services boot without runtime errors
- **Requirement 1.2**: Services start successfully and log startup messages
- **Requirement 1.3**: Health check endpoints return successful responses
- **Requirement 1.4**: Clear error messages for service failures

The tests provide comprehensive coverage of the service integration and communication requirements, ensuring the Dreamscapes application works reliably end-to-end.
