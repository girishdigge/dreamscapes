// services/express/tests/setup.js
const { logger } = require('../utils/logger');

// Suppress console output during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods to reduce noise during testing
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'ERROR';
  process.env.MCP_GATEWAY_URL = 'http://test-mcp-gateway:8080';
  process.env.MAX_CACHE_SIZE = '100';
  process.env.CACHE_TTL = '300000'; // 5 minutes
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

// Global test utilities
global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

global.createMockDream = (overrides = {}) => {
  return {
    id: 'mock_dream_' + Date.now(),
    title: 'Mock Dream',
    style: 'ethereal',
    seed: 12345,
    environment: {
      preset: 'dusk',
      fog: 0.3,
      skyColor: '#a6d8ff',
      ambientLight: 0.8,
    },
    structures: [
      {
        id: 's1',
        template: 'floating_library',
        pos: [0, 20, 0],
        scale: 1.0,
        features: [],
      },
    ],
    entities: [
      {
        id: 'e1',
        type: 'book_swarm',
        count: 25,
        params: {
          speed: 1.0,
          glow: 0.5,
          size: 1.0,
          color: '#ffffff',
        },
      },
    ],
    cinematography: {
      durationSec: 30,
      shots: [
        {
          type: 'establish',
          target: 's1',
          duration: 30,
          startPos: [0, 30, 50],
          endPos: [0, 15, -20],
        },
      ],
    },
    render: {
      res: [1280, 720],
      fps: 30,
      quality: 'draft',
    },
    assumptions: ['Mock dream for testing'],
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'mock',
      version: '1.0.0',
    },
    created: new Date().toISOString(),
    ...overrides,
  };
};

global.createMockMCPResponse = (dreamData, success = true) => {
  return {
    ok: success,
    json: () =>
      Promise.resolve({
        success,
        data: dreamData,
        ...(success ? {} : { error: 'Mock error' }),
      }),
  };
};

global.expectValidDream = (dream) => {
  expect(dream).toBeDefined();
  expect(dream.id).toBeDefined();
  expect(dream.title).toBeDefined();
  expect(dream.style).toMatch(
    /^(ethereal|cyberpunk|surreal|fantasy|nightmare)$/
  );
  expect(Array.isArray(dream.structures)).toBe(true);
  expect(Array.isArray(dream.entities)).toBe(true);
  expect(dream.cinematography).toBeDefined();
  expect(dream.cinematography.durationSec).toBeGreaterThan(0);
  expect(Array.isArray(dream.cinematography.shots)).toBe(true);
};

global.expectValidPatchResponse = (response) => {
  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeDefined();
  expect(response.body.metadata).toBeDefined();
  expect(response.body.metadata.patchSource).toBeDefined();
  expectValidDream(response.body.data);
};

global.expectValidExportResponse = (response) => {
  expect(response.body.success).toBe(true);
  expect(response.body.method).toMatch(/^(client_side|server_side)$/);
  expect(response.body.config).toBeDefined();
  expect(response.body.config.dreamId).toBeDefined();
};

// Mock fetch globally for tests that don't need specific mocking
global.mockFetchSuccess = (data) => {
  const fetch = require('node-fetch');
  fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data }),
  });
};

global.mockFetchFailure = (error = 'Mock error') => {
  const fetch = require('node-fetch');
  fetch.mockRejectedValue(new Error(error));
};

// Error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in tests:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in tests:', error);
});

// Jest custom matchers
expect.extend({
  toBeValidDream(received) {
    const pass =
      received &&
      typeof received.id === 'string' &&
      typeof received.title === 'string' &&
      ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare'].includes(
        received.style
      ) &&
      Array.isArray(received.structures) &&
      Array.isArray(received.entities) &&
      received.cinematography &&
      typeof received.cinematography.durationSec === 'number' &&
      Array.isArray(received.cinematography.shots);

    return {
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid dream`
          : `Expected ${JSON.stringify(received)} to be a valid dream`,
      pass,
    };
  },

  toHaveValidStructure(received) {
    if (!received || !Array.isArray(received.structures)) {
      return {
        message: () => 'Dream must have structures array',
        pass: false,
      };
    }

    const validStructures = received.structures.every(
      (s) => s.id && s.template && Array.isArray(s.pos) && s.pos.length === 3
    );

    return {
      message: () =>
        validStructures
          ? 'Expected structures to be invalid'
          : 'Expected all structures to have id, template, and valid pos array',
      pass: validStructures,
    };
  },

  toHaveValidEntities(received) {
    if (!received || !Array.isArray(received.entities)) {
      return {
        message: () => 'Dream must have entities array',
        pass: false,
      };
    }

    const validEntities = received.entities.every(
      (e) => e.id && e.type && typeof e.count === 'number' && e.count > 0
    );

    return {
      message: () =>
        validEntities
          ? 'Expected entities to be invalid'
          : 'Expected all entities to have id, type, and positive count',
      pass: validEntities,
    };
  },
});

console.log('🧪 Test environment configured');
console.log('📊 Custom matchers loaded');
console.log('🔧 Mock utilities available');
console.log('✅ Ready for testing!');
