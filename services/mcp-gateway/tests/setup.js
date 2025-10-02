// tests/setup.js
// Global test setup and configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.ENABLE_MONITORING_DASHBOARD = 'false';
process.env.ENABLE_FILE_LOGGING = 'false';
process.env.ENABLE_EMAIL_ALERTS = 'false';
process.env.ENABLE_SLACK_ALERTS = 'false';

// Mock environment variables for testing
process.env.CEREBRAS_API_KEY = 'test-cerebras-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.LLAMA_URL = 'http://localhost:8000';

// Global test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Helper to create mock responses
  createMockDreamResponse: (overrides = {}) => ({
    success: true,
    data: {
      title: 'Test Dream',
      description: 'A test dream for unit testing',
      scenes: [
        {
          type: 'environment',
          description: 'Test scene',
          mood: 'test',
          lighting: 'test lighting',
          objects: [
            {
              type: 'test-object',
              position: { x: 0, y: 0, z: 0 },
              properties: { test: true },
            },
          ],
        },
      ],
      style: 'ethereal',
      ...overrides,
    },
    metadata: {
      source: 'test',
      processingTime: 100,
      confidence: 0.8,
      ...overrides.metadata,
    },
  }),

  // Helper to create mock validation results
  createMockValidationResult: (valid = true, overrides = {}) => ({
    valid,
    errors: valid ? [] : ['Test validation error'],
    warnings: [],
    metrics: {
      completeness: 0.8,
      relevance: 0.9,
      creativity: 0.7,
      coherence: 0.8,
      detail: 0.7,
    },
    ...overrides,
  }),

  // Helper to wait for async operations
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Helper to generate test data
  generateTestPrompts: (count = 5) => {
    const templates = [
      'I dreamed of a peaceful garden',
      'I dreamed of a futuristic city',
      'I dreamed of an underwater kingdom',
      'I dreamed of a magical forest',
      'I dreamed of floating islands',
    ];

    return Array.from(
      { length: count },
      (_, i) => templates[i % templates.length] + ` variation ${i}`
    );
  },
};

// Console override for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep errors visible
  debug: jest.fn(),
};

// Restore console for specific tests if needed
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock Redis for tests (if Redis is not available)
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    flushall: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    off: jest.fn(),
  })),
}));

// Mock Winston logger for tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Global cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset console mocks
  global.console.log.mockClear();
  global.console.info.mockClear();
  global.console.warn.mockClear();
  global.console.debug.mockClear();
});

// Global cleanup after all tests
afterAll(async () => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Close any remaining handles
  await new Promise((resolve) => setTimeout(resolve, 100));
});
