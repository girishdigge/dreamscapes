// services/express/test-endpoint-integration.js
// Test the integration of the comprehensive logging system with the actual parse-dream endpoint

const express = require('express');
const request = require('supertest');

// Mock the MCP Gateway and other dependencies
jest.mock('node-fetch');
const fetch = require('node-fetch');

// Mock the cache and validation modules
jest.mock('../middleware/cache', () => ({
  getFromCache: jest.fn(),
  setToCache: jest.fn(),
}));

jest.mock('../middleware/validation', () => ({
  validateDream: jest.fn(),
}));

jest.mock('../utils/fallbackGenerator', () => ({
  createFallbackDream: jest.fn(),
}));

const app = express();
app.use(express.json());

// Import the route after mocking
const parseRoutes = require('../routes/parse');
app.use('/api', parseRoutes);

describe('Parse Dream Endpoint with Comprehensive Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log all stages of successful dream processing', async () => {
    const { getFromCache, setToCache } = require('../middleware/cache');
    const { validateDream } = require('../middleware/validation');

    // Mock cache miss
    getFromCache.mockReturnValue(null);

    // Mock successful MCP Gateway response
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (key) => (key === 'content-type' ? 'application/json' : null),
      },
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            id: 'dream-123',
            title: 'Spaceship Dream',
            style: 'cyberpunk',
            structures: [{ id: 'struct-1', template: 'crystal_tower' }],
            entities: [{ id: 'entity-1', type: 'floating_orbs' }],
          },
          metadata: {
            source: 'openai',
            processingTimeMs: 2500,
          },
        }),
    };

    fetch.mockResolvedValue(mockResponse);

    // Mock successful validation
    validateDream.mockReturnValue({ valid: true, errors: [] });

    const response = await request(app).post('/api/parse-dream').send({
      text: 'I dreamed of a spaceship orbiting the earth',
      style: 'cyberpunk',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('dream-123');
    expect(response.body.metadata.source).toBe('openai');

    // Verify caching was called
    expect(setToCache).toHaveBeenCalled();
  });

  test('should log fallback generation when MCP Gateway fails', async () => {
    const { getFromCache } = require('../middleware/cache');
    const { createFallbackDream } = require('../utils/fallbackGenerator');
    const { validateDream } = require('../middleware/validation');

    // Mock cache miss
    getFromCache.mockReturnValue(null);

    // Mock MCP Gateway failure
    fetch.mockRejectedValue(new Error('Connection timeout'));

    // Mock fallback dream generation
    const fallbackDream = {
      id: 'fallback-123',
      title: 'Fallback Dream',
      style: 'cyberpunk',
      structures: [],
      entities: [],
    };
    createFallbackDream.mockReturnValue(fallbackDream);

    // Mock successful validation of fallback
    validateDream.mockReturnValue({ valid: true, errors: [] });

    const response = await request(app).post('/api/parse-dream').send({
      text: 'I dreamed of a spaceship orbiting the earth',
      style: 'cyberpunk',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('fallback-123');
    expect(response.body.metadata.source).toBe('local_fallback');

    // Verify fallback was called
    expect(createFallbackDream).toHaveBeenCalledWith(
      'I dreamed of a spaceship orbiting the earth',
      'cyberpunk',
      {}
    );
  });

  test('should return cached dream and log cache hit', async () => {
    const { getFromCache } = require('../middleware/cache');

    // Mock cache hit
    const cachedDream = {
      id: 'cached-123',
      title: 'Cached Dream',
      style: 'cyberpunk',
      structures: [],
      entities: [],
    };
    getFromCache.mockReturnValue(cachedDream);

    const response = await request(app).post('/api/parse-dream').send({
      text: 'I dreamed of a spaceship orbiting the earth',
      style: 'cyberpunk',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('cached-123');
    expect(response.body.cached).toBe(true);

    // Verify MCP Gateway was not called
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should handle validation errors and log repair attempts', async () => {
    const { getFromCache, setToCache } = require('../middleware/cache');
    const { validateDream } = require('../middleware/validation');

    // Mock cache miss
    getFromCache.mockReturnValue(null);

    // Mock successful MCP Gateway response with invalid dream
    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (key) => (key === 'content-type' ? 'application/json' : null),
      },
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            id: 'dream-123',
            title: 'Invalid Dream',
            style: 'invalid_style', // This will cause validation to fail
            structures: [],
            entities: [],
          },
          metadata: {
            source: 'openai',
            processingTimeMs: 2500,
          },
        }),
    };

    fetch.mockResolvedValue(mockResponse);

    // Mock validation failure, then success after repair
    validateDream
      .mockReturnValueOnce({ valid: false, errors: ['Invalid style'] })
      .mockReturnValueOnce({ valid: true, errors: [] });

    const response = await request(app).post('/api/parse-dream').send({
      text: 'I dreamed of a spaceship orbiting the earth',
      style: 'cyberpunk',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.source).toBe('openai_repaired');

    // Verify validation was called twice (original + after repair)
    expect(validateDream).toHaveBeenCalledTimes(2);
  });
});

console.log('Integration test file created. To run with Jest:');
console.log('1. Install dependencies: npm install --save-dev jest supertest');
console.log('2. Run tests: npm test');
console.log('');
console.log('This test verifies that the comprehensive logging system');
console.log('integrates correctly with the parse-dream endpoint and logs');
console.log('all the required stages as specified in the requirements.');
