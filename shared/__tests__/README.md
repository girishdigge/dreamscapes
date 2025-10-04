# Dream Data Consistency Validation Tests

This directory contains comprehensive tests for the dream data consistency and validation system.

## Test Suites

### 1. Unit Tests

#### DreamSchema.test.js

Tests the unified dream schema validation rules:

- Complete dream object validation
- Individual field validation (ID, title, style, etc.)
- Structures array validation
- Entities array validation
- Cinematography validation
- Environment validation
- Render configuration validation
- Edge cases and boundary conditions

**Run with:**

```bash
npm run test:unit
```

#### UnifiedValidator.test.js

Tests the unified validator class:

- Dream object validation
- Section-specific validation
- Context-aware validation
- Error categorization
- Validation reports
- Renderability checks

### 2. Integration Tests

#### e2e-dream-generation.test.js

Tests complete dream generation flow from Express to frontend:

- Service availability checks
- Complete dream generation for various styles
- Data consistency across service boundaries
- Style-specific generation
- Edge cases (min/max duration, short/long descriptions)
- API response format validation

**Requirements Covered:** 5.1, 5.2, 5.4

**Run with:**

```bash
npm run test:e2e
```

**Prerequisites:**

- All services must be running (Express, MCP Gateway, etc.)
- Services should be accessible on default ports
- Set `EXPRESS_URL` environment variable if using non-default URL

#### error-handling-recovery.test.js

Tests system behavior when AI providers return invalid data:

- Invalid request handling
- Content repair system
- Validation error messages
- Error recovery strategies
- Validation report generation
- Renderability checks
- Use case specific validation

**Requirements Covered:** 2.2, 2.4, 5.3

**Run with:**

```bash
npm run test:error
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
npm run test:unit      # Unit tests only
npm run test:e2e       # E2E integration tests
npm run test:error     # Error handling tests
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

## Test Configuration

Tests are configured in `jest.config.js`:

- Test environment: Node.js
- Test timeout: 30 seconds
- Max workers: 1 (serial execution to avoid port conflicts)
- Coverage collection from schemas and validators

## Environment Variables

### EXPRESS_URL

URL of the Express service (default: `http://localhost:8000`)

Example:

```bash
EXPRESS_URL=http://localhost:8000 npm run test:e2e
```

## Test Data

### Sample Dreams

Tests use various dream descriptions and styles:

- **Ethereal**: Peaceful, glowing, starlit scenes
- **Cyberpunk**: Neon, digital, futuristic scenes
- **Surreal**: Impossible, dreamlike, abstract scenes
- **Fantasy**: Magical, enchanted, mystical scenes
- **Nature**: Serene, organic, natural scenes

### Validation Test Cases

- Valid complete dreams
- Dreams with missing required fields
- Dreams with invalid field values
- Dreams with empty arrays
- Dreams with out-of-range values
- Dreams with invalid references

## Expected Test Results

### Unit Tests

- All schema validation rules should pass
- All validator methods should work correctly
- Edge cases should be handled properly

### Integration Tests (E2E)

- All services should be available
- Dream generation should produce complete, valid dreams
- All generated dreams should pass validation
- All generated dreams should be renderable
- Data should be consistent across service boundaries

### Integration Tests (Error Handling)

- Invalid requests should be rejected with clear errors
- Content repair should generate complete dreams
- Validation errors should have clear, actionable messages
- Error recovery should work correctly
- Renderability checks should identify non-renderable dreams

## Troubleshooting

### Services Not Available

If E2E tests fail with connection errors:

1. Ensure all services are running: `docker-compose up`
2. Check service health endpoints
3. Verify ports are not blocked by firewall
4. Check `EXPRESS_URL` environment variable

### Test Timeouts

If tests timeout:

1. Increase timeout in `jest.config.js`
2. Check service performance
3. Verify network connectivity
4. Check for resource constraints

### Validation Failures

If validation tests fail:

1. Check that schemas match expected format
2. Verify validator logic is correct
3. Review error messages for details
4. Check for recent schema changes

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

1. Unit tests run quickly and don't require services
2. Integration tests require running services
3. All tests use `--runInBand` flag for serial execution
4. Tests generate coverage reports for monitoring

## Contributing

When adding new tests:

1. Follow existing test structure and naming conventions
2. Add clear descriptions and comments
3. Update this README with new test information
4. Ensure tests are deterministic and repeatable
5. Add appropriate timeout values for async operations
6. Use meaningful test data and assertions

## Requirements Traceability

### Requirement 1.6

- Validation reports success accurately
- Tests: DreamSchema.test.js, UnifiedValidator.test.js

### Requirement 2.2

- Consistent validation with clear error messages
- Tests: error-handling-recovery.test.js

### Requirement 2.4

- Repair strategies generate meaningful defaults
- Tests: error-handling-recovery.test.js

### Requirement 5.1

- Frontend receives complete dream objects
- Tests: e2e-dream-generation.test.js

### Requirement 5.2

- Consistent field names and data types
- Tests: e2e-dream-generation.test.js

### Requirement 5.3

- Clear error information for frontend
- Tests: error-handling-recovery.test.js

### Requirement 5.4

- Cached data maintains structure
- Tests: e2e-dream-generation.test.js
