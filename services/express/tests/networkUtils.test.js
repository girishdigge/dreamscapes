// services/express/tests/networkUtils.test.js
// Test suite for network utilities timeout and resilience improvements

const {
  fetchWithRetry,
  categorizeNetworkError,
  shouldRetryError,
  getTimeoutForRequest,
  getRequestType,
  analyzeNetworkError,
  CircuitBreaker,
} = require('../utils/networkUtils');

// Mock node-fetch for testing
jest.mock('node-fetch');
const fetch = require('node-fetch');

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Network Utils - Timeout and Resilience Improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.MCP_TIMEOUT_MS;
    delete process.env.HEALTH_CHECK_TIMEOUT_MS;
    delete process.env.LONG_OPERATION_TIMEOUT_MS;
  });

  describe('getTimeoutForRequest', () => {
    test('should use explicit timeout if provided', () => {
      const timeout = getTimeoutForRequest('http://example.com', {
        timeout: 15000,
      });
      expect(timeout).toBe(15000);
    });

    test('should use health check timeout for health endpoints', () => {
      process.env.HEALTH_CHECK_TIMEOUT_MS = '3000';
      const timeout = getTimeoutForRequest('http://example.com/health');
      expect(timeout).toBe(3000);
    });

    test('should use long operation timeout for AI generation endpoints', () => {
      process.env.LONG_OPERATION_TIMEOUT_MS = '90000';
      const timeout = getTimeoutForRequest('http://example.com/parse');
      expect(timeout).toBe(90000);
    });

    test('should use extended timeout for large POST requests', () => {
      process.env.MCP_TIMEOUT_MS = '30000';
      const largeBody = 'x'.repeat(15000); // 15KB body
      const timeout = getTimeoutForRequest('http://example.com', {
        method: 'POST',
        body: largeBody,
      });
      expect(timeout).toBe(60000); // Double the base timeout
    });

    test('should use default timeout for regular requests', () => {
      const timeout = getTimeoutForRequest('http://example.com');
      expect(timeout).toBe(30000); // Default timeout
    });

    test('should respect environment variable for base timeout', () => {
      process.env.MCP_TIMEOUT_MS = '45000';
      const timeout = getTimeoutForRequest('http://example.com');
      expect(timeout).toBe(45000);
    });
  });

  describe('getRequestType', () => {
    test('should identify health check requests', () => {
      const type = getRequestType('http://example.com/health');
      expect(type).toBe('health_check');
    });

    test('should identify dream generation requests', () => {
      const type = getRequestType('http://example.com/parse');
      expect(type).toBe('dream_generation');
    });

    test('should identify AI generation requests', () => {
      const type = getRequestType('http://example.com/generate');
      expect(type).toBe('ai_generation');
    });

    test('should identify POST requests', () => {
      const type = getRequestType('http://example.com', { method: 'POST' });
      expect(type).toBe('post_request');
    });

    test('should identify GET requests', () => {
      const type = getRequestType('http://example.com', { method: 'GET' });
      expect(type).toBe('get_request');
    });

    test('should return unknown for unrecognized requests', () => {
      const type = getRequestType('http://example.com');
      expect(type).toBe('unknown');
    });
  });

  describe('analyzeNetworkError', () => {
    test('should analyze timeout errors correctly', () => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';

      const analysis = analyzeNetworkError(error, 'http://example.com/parse');

      expect(analysis.category).toBe('timeout');
      expect(analysis.severity).toBe('high');
      expect(analysis.retryRecommended).toBe(true);
      expect(analysis.fallbackRecommendation).toBe('local_generation');
      expect(analysis.retryReason).toBe('request_timeout');
    });

    test('should analyze connection refused errors correctly', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';

      const analysis = analyzeNetworkError(error, 'http://example.com/parse');

      expect(analysis.category).toBe('connection_refused');
      expect(analysis.severity).toBe('high');
      expect(analysis.retryRecommended).toBe(true);
      expect(analysis.fallbackRecommendation).toBe('service_unavailable');
      expect(analysis.retryReason).toBe('service_down');
    });

    test('should analyze DNS resolution errors correctly', () => {
      const error = new Error('DNS resolution failed');
      error.code = 'ENOTFOUND';

      const analysis = analyzeNetworkError(error, 'http://example.com/parse');

      expect(analysis.category).toBe('dns_resolution');
      expect(analysis.severity).toBe('critical');
      expect(analysis.retryRecommended).toBe(false);
      expect(analysis.fallbackRecommendation).toBe('configuration_error');
      expect(analysis.retryReason).toBe('dns_failure');
    });

    test('should adjust recommendations for health check requests', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';

      const analysis = analyzeNetworkError(error, 'http://example.com/health');

      expect(analysis.fallbackRecommendation).toBe('mark_service_unhealthy');
    });

    test('should handle HTTP status errors correctly', () => {
      const error = new Error('Server error');
      error.status = 500;

      const analysis = analyzeNetworkError(error, 'http://example.com/parse');

      expect(analysis.severity).toBe('high');
      expect(analysis.retryRecommended).toBe(true);
      expect(analysis.fallbackRecommendation).toBe('server_error');
      expect(analysis.retryReason).toBe('server_error');
    });

    test('should handle client errors correctly', () => {
      const error = new Error('Bad request');
      error.status = 400;

      const analysis = analyzeNetworkError(error, 'http://example.com/parse');

      expect(analysis.severity).toBe('medium');
      expect(analysis.retryRecommended).toBe(false);
      expect(analysis.fallbackRecommendation).toBe('client_error');
      expect(analysis.retryReason).toBe('client_error');
    });
  });

  describe('fetchWithRetry - Timeout and AbortController', () => {
    test('should use AbortController for timeout handling', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: () => null },
      };
      fetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithRetry('http://example.com', {
        timeout: 5000,
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          headers: expect.objectContaining({
            Connection: 'keep-alive',
            'Keep-Alive': 'timeout=30, max=100',
          }),
        })
      );
      expect(result).toBe(mockResponse);
    });

    test('should handle timeout errors with proper cleanup', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      fetch.mockRejectedValueOnce(timeoutError);

      await expect(
        fetchWithRetry('http://example.com', { timeout: 1000 }, 0)
      ).rejects.toThrow('Request timeout');
    });

    test('should retry on network errors with exponential backoff', async () => {
      const networkError = new Error('Connection refused');
      networkError.code = 'ECONNREFUSED';

      fetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
        });

      const startTime = Date.now();
      const result = await fetchWithRetry('http://example.com', {}, 2);
      const endTime = Date.now();

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(true);
      // Should have some delay due to exponential backoff
      expect(endTime - startTime).toBeGreaterThan(1000);
    });

    test('should not retry on DNS resolution errors', async () => {
      const dnsError = new Error('DNS resolution failed');
      dnsError.code = 'ENOTFOUND';

      fetch.mockRejectedValueOnce(dnsError);

      await expect(fetchWithRetry('http://example.com', {}, 2)).rejects.toThrow(
        'DNS resolution failed'
      );

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should enhance final error with retry information', async () => {
      const networkError = new Error('Connection refused');
      networkError.code = 'ECONNREFUSED';

      fetch.mockRejectedValue(networkError);

      try {
        await fetchWithRetry('http://example.com', {}, 2);
      } catch (error) {
        expect(error.totalAttempts).toBe(3);
        expect(error.retriesExhausted).toBe(true);
        expect(error.url).toBe('http://example.com');
        expect(error.networkErrorDetails).toBeDefined();
      }
    });
  });

  describe('CircuitBreaker integration', () => {
    test('should work with circuit breaker pattern', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        timeout: 1000,
      });

      const networkError = new Error('Service unavailable');
      networkError.code = 'ECONNREFUSED';

      fetch.mockRejectedValue(networkError);

      // First two failures should trigger circuit breaker
      await expect(
        circuitBreaker.execute(() =>
          fetchWithRetry('http://example.com', {}, 0)
        )
      ).rejects.toThrow();
      await expect(
        circuitBreaker.execute(() =>
          fetchWithRetry('http://example.com', {}, 0)
        )
      ).rejects.toThrow();

      // Third attempt should be blocked by circuit breaker
      await expect(
        circuitBreaker.execute(() =>
          fetchWithRetry('http://example.com', {}, 0)
        )
      ).rejects.toThrow('CircuitBreaker circuit breaker is OPEN');
    });
  });
});
