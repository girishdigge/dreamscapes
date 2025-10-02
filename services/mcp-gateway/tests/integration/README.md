# Provider Interactions Integration Tests

This directory contains comprehensive integration tests for provider interactions in the MCP Gateway service. These tests validate the complete workflow from request processing through provider fallback and error recovery.

## Test Coverage

### Requirements Addressed

- **1.4**: Error handling and recovery mechanisms during provider interactions
- **1.5**: Provider switching and fallback behavior validation
- **3.4**: Consistent response handling across different provider formats
- **5.2**: Intelligent retry strategies and provider switching
- **5.3**: Context preservation during provider failures

### Test Files

#### 1. `provider-interactions.test.js`

**Primary integration tests for provider interactions**

- **Mock Provider Response Scenarios**

  - Cerebras object response format handling
  - Cerebras streaming response format handling
  - Malformed Cerebras response recovery
  - OpenAI chat completion format handling
  - OpenAI legacy completion format handling
  - Mixed response format scenarios

- **End-to-End Request Processing with Error Conditions**

  - Network timeout error handling
  - Connection refused error handling
  - API key authentication error handling
  - Rate limiting with exponential backoff
  - Invalid response format handling
  - Partial JSON response recovery

- **Fallback Behavior and Provider Switching Validation**
  - Sequential fallback through multiple providers
  - Context preservation during provider switching
  - Circuit breaker integration and recovery
  - Load balancing during partial failures
  - Complex error recovery scenarios
  - Concurrent request handling with fallback
  - Health monitoring integration

#### 2. `error-recovery-scenarios.test.js`

**Specialized tests for error recovery and provider switching**

- **Response Parsing Error Recovery**

  - Substring parsing error recovery
  - Circular reference object handling
  - JSON parsing error fallback strategies

- **Provider Health Recovery**

  - Provider health issue detection and recovery
  - Provider recovery during high load scenarios

- **Context Preservation During Recovery**

  - Request context preservation during provider switching
  - Operation continuity across provider failures

- **Complex Error Scenarios**

  - Cascading provider failure handling
  - Mixed synchronous and asynchronous error handling
  - Provider errors during response processing

- **Recovery Performance and Reliability**
  - Performance maintenance during error recovery
  - Error recovery under memory pressure

#### 3. `end-to-end-workflow.test.js`

**Complete workflow validation tests**

- **Complete Dream Generation Workflow**

  - Successful end-to-end dream generation
  - Provider fallback in complete workflow
  - Malformed response recovery in full workflow

- **Health Monitoring Workflow**

  - Comprehensive health status reporting
  - Provider-specific health information
  - Non-existent provider handling

- **Error Handling Workflow**

  - Missing prompt validation
  - All providers failing scenario
  - Timeout scenario handling

- **Concurrent Request Workflow**

  - Multiple concurrent request handling
  - Performance under load with failures

- **Context Preservation Workflow**
  - Request context preservation through provider switching

## Mock Providers

The tests use sophisticated mock providers that simulate real-world scenarios:

### MockCerebrasProvider

- Simulates Cerebras API response formats
- Configurable response delays and failure rates
- Supports streaming response simulation
- Batch generation capabilities

### MockOpenAIProvider

- Simulates OpenAI API response formats
- Token limit simulation
- Chat completion and legacy completion formats
- Configurable response characteristics

### MockFailingProvider

- Always fails for testing fallback scenarios
- Configurable error types and messages

### MockSlowProvider

- Simulates slow network responses
- Configurable response delays
- Timeout scenario testing

### MockUnreliableProvider

- Simulates intermittent failures
- Configurable failure rates
- Random timeout simulation

## Running the Tests

### Prerequisites

- Node.js and npm installed
- Jest testing framework
- All MCP Gateway dependencies installed

### Command Line Options

```bash
# Run all integration tests
node tests/integration/run-integration-tests.js

# Run with verbose output
node tests/integration/run-integration-tests.js --verbose

# Run with coverage report
node tests/integration/run-integration-tests.js --coverage

# Custom timeout (default: 30000ms)
node tests/integration/run-integration-tests.js --timeout=60000

# Custom worker count (default: 1)
node tests/integration/run-integration-tests.js --maxWorkers=2

# Show help
node tests/integration/run-integration-tests.js --help
```

### Using Jest Directly

```bash
# Run specific test file
npx jest tests/integration/provider-interactions.test.js

# Run all integration tests
npx jest tests/integration/

# Run with coverage
npx jest tests/integration/ --coverage

# Run in watch mode
npx jest tests/integration/ --watch
```

### Using npm Scripts

```bash
# Run integration tests only
npm run test:integration

# Run all tests
npm run test:all
```

## Test Configuration

### Default Settings

- **Timeout**: 30 seconds per test
- **Max Workers**: 1 (sequential execution)
- **Detect Open Handles**: Enabled
- **Force Exit**: Enabled
- **Verbose Output**: Enabled

### Environment Variables

- `NODE_ENV=test` - Set automatically during test execution
- Custom environment variables can be set in test files

## Test Scenarios

### Network Error Simulation

- Connection timeouts
- Connection refused errors
- DNS resolution failures
- Network latency simulation

### Provider Error Simulation

- Authentication failures (401)
- Rate limiting (429)
- Server errors (500)
- Service unavailable (503)

### Response Format Testing

- Valid JSON responses
- Malformed JSON responses
- Partial responses
- Binary data responses
- Circular reference objects

### Concurrency Testing

- High concurrent load (50+ requests)
- Provider switching under load
- Resource contention scenarios
- Memory pressure simulation

### Performance Validation

- Response time monitoring
- Throughput measurement
- Resource usage tracking
- Fallback performance impact

## Expected Outcomes

### Success Criteria

- All providers handle their specific response formats correctly
- Fallback mechanisms work reliably under all error conditions
- Context is preserved during provider switching
- Performance remains acceptable during error recovery
- Health monitoring accurately reflects provider status

### Performance Benchmarks

- Individual request processing: < 5 seconds
- Concurrent request handling: 50 requests in < 10 seconds
- Provider fallback time: < 2 seconds
- Error recovery time: < 1 second

### Reliability Targets

- Success rate with working providers: > 99%
- Success rate with fallback: > 95%
- Context preservation rate: 100%
- Health monitoring accuracy: > 98%

## Troubleshooting

### Common Issues

1. **Test Timeouts**

   - Increase timeout with `--timeout=60000`
   - Check for hanging promises in test code
   - Verify mock provider cleanup

2. **Port Conflicts**

   - Tests run on random ports to avoid conflicts
   - Check for other services using test ports

3. **Memory Issues**

   - Run tests sequentially with `--maxWorkers=1`
   - Monitor memory usage during large concurrent tests

4. **Mock Provider Issues**
   - Verify mock provider responses match expected formats
   - Check mock provider cleanup in afterEach hooks

### Debug Mode

Enable debug logging by setting environment variables:

```bash
DEBUG=mcp-gateway:* node tests/integration/run-integration-tests.js
```

### Test Isolation

Each test file runs in isolation with:

- Fresh ProviderManager instance
- Clean mock provider registry
- Isolated Express app instance
- Separate health monitoring state

## Contributing

When adding new integration tests:

1. Follow the existing test structure and naming conventions
2. Use appropriate mock providers for your scenarios
3. Include both positive and negative test cases
4. Add proper cleanup in `afterEach` hooks
5. Document any new test scenarios in this README
6. Ensure tests are deterministic and don't rely on external services

### Test Categories

- **Unit Integration**: Test individual component interactions
- **System Integration**: Test complete workflow scenarios
- **Error Integration**: Test error handling and recovery
- **Performance Integration**: Test performance under various conditions
- **Concurrency Integration**: Test concurrent operation handling

## Monitoring and Metrics

The integration tests collect and validate:

- Request success/failure rates
- Response times and throughput
- Provider health status changes
- Circuit breaker state transitions
- Context preservation accuracy
- Error classification correctness
- Fallback mechanism effectiveness

These metrics help ensure the MCP Gateway maintains high reliability and performance standards under all operating conditions.
