# Dreamscapes MCP Gateway - Comprehensive Testing Suite

This directory contains a comprehensive testing suite for the Dreamscapes MCP Gateway, covering unit tests, integration tests, performance benchmarks, quality assurance, and monitoring validation.

## 📁 Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── ProviderManager.test.js     # Provider management and fallback logic
│   ├── PromptEngine.test.js        # Prompt generation and optimization
│   ├── ValidationPipeline.test.js  # Content validation and repair
│   └── CerebrasService.test.js     # Cerebras SDK integration
├── integration/                    # Integration and end-to-end tests
│   ├── provider-fallback.test.js   # Provider fallback scenarios
│   └── dream-generation-workflow.test.js # Complete workflow testing
├── performance/                    # Performance and load testing
│   └── load-testing.test.js        # Benchmarking and stress testing
├── quality/                        # Quality assurance tests
│   ├── content-quality-assessment.test.js # Automated quality assessment
│   └── regression-testing.test.js  # Regression detection
├── monitoring/                     # Monitoring and alerting tests
│   └── monitoring-validation.test.js # Health monitoring and metrics
├── mocks/                          # Mock providers and utilities
│   └── MockProviders.js            # Mock implementations for testing
├── setup.js                       # Global test setup and configuration
├── testSequencer.js               # Custom test execution order
├── run-all-tests.js               # Comprehensive test runner
└── README.md                       # This file
```

## 🚀 Quick Start

### Run All Tests

```bash
npm test
# or
npm run test:all
```

### Run Specific Test Suites

```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:performance   # Performance tests only
npm run test:quality       # Quality assurance tests
npm run test:monitoring    # Monitoring tests only
```

### Run Tests with Options

```bash
npm run test:fast          # Skip performance tests
npm run test:unit-only     # Only unit tests
npm run test:coverage      # Generate coverage report
npm run test:watch         # Watch mode for development
```

## 📊 Test Categories

### 1. Unit Tests (`tests/unit/`)

**Purpose**: Test individual components in isolation with mocked dependencies.

**Coverage**:

- ProviderManager: Provider registration, selection, fallback logic
- PromptEngine: Prompt generation, template management, optimization
- ValidationPipeline: Schema validation, content repair, quality assessment
- CerebrasService: API integration, error handling, performance optimization

**Key Features**:

- Mock providers for consistent testing
- Comprehensive error scenario coverage
- Performance validation
- Configuration management testing

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Test component interactions and end-to-end workflows.

**Coverage**:

- Provider fallback scenarios under various failure conditions
- Complete dream generation workflow from request to response
- Cache integration and performance impact
- Error recovery and resilience testing

**Key Features**:

- Real-world scenario simulation
- Cross-component interaction validation
- Performance under load
- Data consistency verification

### 3. Performance Tests (`tests/performance/`)

**Purpose**: Benchmark system performance and detect regressions.

**Coverage**:

- Single request performance baselines
- Concurrent request handling
- Memory usage and leak detection
- Cache performance impact
- Stress testing under extreme load

**Key Features**:

- Baseline performance metrics
- Regression detection
- Resource usage monitoring
- Scalability validation

### 4. Quality Assurance Tests (`tests/quality/`)

**Purpose**: Ensure consistent content quality and detect regressions.

**Coverage**:

- Automated content quality assessment
- Provider quality benchmarking
- Content diversity validation
- Regression testing for consistency

**Key Features**:

- Quality metrics tracking
- Content structure validation
- Style consistency verification
- Improvement suggestion generation

### 5. Monitoring Tests (`tests/monitoring/`)

**Purpose**: Validate monitoring, alerting, and health check systems.

**Coverage**:

- Health monitoring accuracy
- Metrics collection and aggregation
- Alert triggering and suppression
- Dashboard data integrity

**Key Features**:

- Real-time monitoring validation
- Alert threshold testing
- Performance bottleneck detection
- Integration with external systems

## 🛠️ Test Configuration

### Jest Configuration (`jest.config.js`)

The Jest configuration is optimized for comprehensive testing:

- **Test Environment**: Node.js environment for server-side testing
- **Coverage**: Configurable coverage thresholds (70% minimum)
- **Parallel Execution**: Utilizes 50% of available CPU cores
- **Custom Sequencer**: Optimizes test execution order
- **Timeout**: 30-second default with per-suite overrides

### Global Setup (`tests/setup.js`)

Provides consistent test environment:

- Environment variable configuration
- Mock implementations for external dependencies
- Global test utilities and helpers
- Console output management for cleaner test runs

### Mock Providers (`tests/mocks/MockProviders.js`)

Comprehensive mock implementations:

- **MockCerebrasProvider**: Simulates Cerebras API behavior
- **MockOpenAIProvider**: Simulates OpenAI API behavior
- **MockProviderRegistry**: Manages multiple mock providers
- **Configurable Behavior**: Failure rates, response delays, health status

## 📈 Performance Baselines

The test suite maintains performance baselines to detect regressions:

| Metric                   | Baseline | Test Suite        |
| ------------------------ | -------- | ----------------- |
| Single Request           | < 300ms  | Unit, Integration |
| Concurrent Requests (10) | < 2000ms | Performance       |
| Validation Time          | < 100ms  | Unit, Quality     |
| Cache Hit Time           | < 20ms   | Performance       |
| Memory per Operation     | < 50KB   | Performance       |

## 🔍 Quality Metrics

Quality assurance tests track multiple dimensions:

| Dimension    | Threshold | Description                            |
| ------------ | --------- | -------------------------------------- |
| Completeness | > 70%     | Content includes all required elements |
| Relevance    | > 80%     | Content matches original prompt        |
| Creativity   | > 60%     | Content shows creative interpretation  |
| Coherence    | > 70%     | Content is logically consistent        |
| Detail       | > 60%     | Content provides sufficient detail     |

## 🚨 Monitoring Validation

Monitoring tests ensure system observability:

- **Health Checks**: Provider availability and response times
- **Metrics Collection**: Request counts, success rates, performance data
- **Alerting**: Error rate, response time, and failure thresholds
- **Dashboard**: Real-time data accuracy and historical trends

## 🔧 Development Workflow

### Adding New Tests

1. **Unit Tests**: Add to appropriate `tests/unit/` file or create new file
2. **Integration Tests**: Add to `tests/integration/` for cross-component testing
3. **Performance Tests**: Add benchmarks to `tests/performance/`
4. **Quality Tests**: Add quality checks to `tests/quality/`

### Test Naming Conventions

- **Files**: `ComponentName.test.js`
- **Describe Blocks**: Component or feature name
- **Test Cases**: "should [expected behavior] when [condition]"

### Mock Usage

Use provided mock providers for consistent testing:

```javascript
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
} = require('../mocks/MockProviders');

const mockProvider = new MockCerebrasProvider({
  responseDelay: 100,
  failureRate: 0.1,
  shouldFail: false,
});
```

## 📊 Coverage Reports

Generate detailed coverage reports:

```bash
npm run test:coverage
```

Coverage reports are generated in multiple formats:

- **Terminal**: Summary in console output
- **HTML**: Detailed report in `coverage/lcov-report/index.html`
- **LCOV**: Machine-readable format in `coverage/lcov.info`

## 🐛 Debugging Tests

### Verbose Output

```bash
node tests/run-all-tests.js --verbose
```

### Single Test Suite

```bash
node tests/run-all-tests.js unit
```

### Continue on Failure

```bash
node tests/run-all-tests.js --continue-on-failure
```

### Enable Console Logs

```javascript
// In test file
global.restoreConsole();
```

## 🔄 Continuous Integration

The test suite is designed for CI/CD integration:

- **Fast Feedback**: Unit tests run first for quick feedback
- **Parallel Execution**: Optimized for CI environments
- **Failure Handling**: Detailed error reporting and exit codes
- **Coverage Tracking**: Automated coverage threshold enforcement

### CI Configuration Example

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: |
    npm install
    npm run test:fast  # Skip performance tests in CI

- name: Run Performance Tests
  run: npm run test:performance
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

## 📝 Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Mocking**: Use provided mocks for external dependencies
3. **Assertions**: Use descriptive assertions with clear error messages
4. **Cleanup**: Ensure proper cleanup in `afterEach` and `afterAll` hooks
5. **Performance**: Keep unit tests fast (< 100ms per test)
6. **Coverage**: Aim for high coverage but focus on meaningful tests

## 🆘 Troubleshooting

### Common Issues

**Jest not found**: Install dependencies with `npm install`

**Tests timing out**: Increase timeout in test file:

```javascript
jest.setTimeout(60000); // 60 seconds
```

**Memory issues**: Enable garbage collection:

```bash
node --expose-gc tests/run-all-tests.js
```

**Mock issues**: Ensure mocks are properly reset:

```javascript
afterEach(() => {
  jest.clearAllMocks();
});
```

### Getting Help

1. Check test output for specific error messages
2. Run individual test suites to isolate issues
3. Use `--verbose` flag for detailed output
4. Review mock configurations and test setup

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#-6-testing-and-overall-quality-practices)
