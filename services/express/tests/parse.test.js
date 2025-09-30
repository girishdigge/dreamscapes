// services/express/tests/parse.test.js
const request = require('supertest');
const express = require('express');
const parseRoutes = require('../routes/parse');
const { setToCache, clearCache } = require('../middleware/cache');

// Mock MCP Gateway
jest.mock('node-fetch');
const fetch = require('node-fetch');

// Create test app
const app = express();
app.use(express.json());
app.use('/api', parseRoutes);

describe('Parse Dream Routes', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  describe('POST /api/parse-dream', () => {
    test('should generate dream successfully', async () => {
      // Mock successful MCP response
      const mockDream = {
        id: 'test_dream_1',
        title: 'Test Dream',
        style: 'ethereal',
        structures: [],
        entities: [],
        cinematography: {
          durationSec: 30,
          shots: [],
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      const response = await request(app).post('/api/parse-dream').send({
        text: 'A beautiful floating library',
        style: 'ethereal',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Dream');
      expect(response.body.data.style).toBe('ethereal');
    });

    test('should return fallback dream when MCP fails', async () => {
      // Mock MCP failure
      fetch.mockRejectedValueOnce(new Error('MCP Gateway unavailable'));

      const response = await request(app).post('/api/parse-dream').send({
        text: 'A mysterious forest',
        style: 'fantasy',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.style).toBe('fantasy');
      expect(response.body.data.assumptions).toContain(
        expect.stringContaining('fallback')
      );
    });

    test('should validate required fields', async () => {
      const response = await request(app).post('/api/parse-dream').send({
        // Missing text field
        style: 'ethereal',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Dream text is required');
    });

    test('should validate text length', async () => {
      const longText = 'a'.repeat(2001);

      const response = await request(app).post('/api/parse-dream').send({
        text: longText,
        style: 'ethereal',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Dream text too long');
    });

    test('should validate style enum', async () => {
      const response = await request(app).post('/api/parse-dream').send({
        text: 'A test dream',
        style: 'invalid_style',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid style');
    });

    test('should return cached dream on second request', async () => {
      const mockDream = {
        id: 'cached_dream',
        title: 'Cached Dream',
        style: 'cyberpunk',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      // First request
      await request(app).post('/api/parse-dream').send({
        text: 'Neon city',
        style: 'cyberpunk',
      });

      // Second request (should be cached)
      const response = await request(app).post('/api/parse-dream').send({
        text: 'Neon city',
        style: 'cyberpunk',
      });

      expect(response.status).toBe(200);
      expect(response.body.cached).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // Only called once
    });

    test('should handle different styles', async () => {
      const styles = [
        'ethereal',
        'cyberpunk',
        'surreal',
        'fantasy',
        'nightmare',
      ];

      for (const style of styles) {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 'test', title: 'Test', style },
            }),
        });

        const response = await request(app)
          .post('/api/parse-dream')
          .send({
            text: `A ${style} dream`,
            style,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.style).toBe(style);
      }
    });

    test('should handle options parameter', async () => {
      const mockDream = {
        id: 'options_test',
        title: 'Options Test',
        style: 'ethereal',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      const response = await request(app)
        .post('/api/parse-dream')
        .send({
          text: 'A test dream',
          style: 'ethereal',
          options: {
            duration: 45,
            quality: 'high',
          },
        });

      expect(response.status).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"options"'),
        })
      );
    });
  });

  describe('GET /api/dreams', () => {
    test('should return empty list initially', async () => {
      const response = await request(app).get('/api/dreams');

      expect(response.status).toBe(200);
      expect(response.body.dreams).toEqual([]);
      expect(response.body.pagination.totalItems).toBe(0);
    });

    test('should return cached dreams', async () => {
      // Add some dreams to cache
      const dreams = [
        { id: '1', title: 'Dream 1', style: 'ethereal', created: '2023-01-01' },
        {
          id: '2',
          title: 'Dream 2',
          style: 'cyberpunk',
          created: '2023-01-02',
        },
      ];

      setToCache('all_dreams', dreams);

      const response = await request(app).get('/api/dreams');

      expect(response.status).toBe(200);
      expect(response.body.dreams).toHaveLength(2);
      expect(response.body.dreams[0].title).toBe('Dream 1');
    });

    test('should support pagination', async () => {
      // Add multiple dreams
      const dreams = Array.from({ length: 15 }, (_, i) => ({
        id: `dream_${i}`,
        title: `Dream ${i}`,
        style: 'ethereal',
        created: '2023-01-01',
      }));

      setToCache('all_dreams', dreams);

      const response = await request(app)
        .get('/api/dreams')
        .query({ page: 2, limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.dreams).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(2);
      expect(response.body.pagination.totalItems).toBe(15);
    });

    test('should support style filtering', async () => {
      const dreams = [
        { id: '1', title: 'Dream 1', style: 'ethereal' },
        { id: '2', title: 'Dream 2', style: 'cyberpunk' },
        { id: '3', title: 'Dream 3', style: 'ethereal' },
      ];

      setToCache('all_dreams', dreams);

      const response = await request(app)
        .get('/api/dreams')
        .query({ style: 'ethereal' });

      expect(response.status).toBe(200);
      expect(response.body.dreams).toHaveLength(2);
      expect(response.body.dreams.every((d) => d.style === 'ethereal')).toBe(
        true
      );
    });
  });

  describe('GET /api/scene/:id', () => {
    test('should return specific dream', async () => {
      const dream = {
        id: 'test_scene',
        title: 'Test Scene',
        style: 'surreal',
      };

      setToCache('test_scene', dream);

      const response = await request(app).get('/api/scene/test_scene');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test_scene');
      expect(response.body.title).toBe('Test Scene');
    });

    test('should return 404 for non-existent dream', async () => {
      const response = await request(app).get('/api/scene/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Dream not found');
    });
  });

  describe('GET /api/samples', () => {
    test('should return sample dreams', async () => {
      const response = await request(app).get('/api/samples');

      expect(response.status).toBe(200);
      expect(response.body.samples).toBeDefined();
      expect(response.body.samples.length).toBeGreaterThan(0);
      expect(response.body.samples[0]).toHaveProperty('text');
      expect(response.body.samples[0]).toHaveProperty('style');
      expect(response.body.samples[0]).toHaveProperty('title');
    });

    test('should include usage instructions', async () => {
      const response = await request(app).get('/api/samples');

      expect(response.status).toBe(200);
      expect(response.body.usage).toBeDefined();
      expect(response.body.count).toBe(response.body.samples.length);
    });
  });

  describe('Error Handling', () => {
    test('should handle JSON parsing errors gracefully', async () => {
      const response = await request(app)
        .post('/api/parse-dream')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('should handle MCP Gateway timeout', async () => {
      fetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      const response = await request(app).post('/api/parse-dream').send({
        text: 'A timeout test dream',
        style: 'ethereal',
      });

      expect(response.status).toBe(200); // Should fallback gracefully
      expect(response.body.data).toBeDefined();
    });

    test('should handle invalid JSON from MCP Gateway', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const response = await request(app).post('/api/parse-dream').send({
        text: 'Invalid JSON test',
        style: 'ethereal',
      });

      expect(response.status).toBe(200); // Should fallback
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should respond within reasonable time', async () => {
      const mockDream = {
        id: 'perf_test',
        title: 'Performance Test',
        style: 'ethereal',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      const start = Date.now();
      const response = await request(app).post('/api/parse-dream').send({
        text: 'Performance test dream',
        style: 'ethereal',
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
      expect(response.body.metadata.processingTime).toBeDefined();
    });

    test('should handle concurrent requests', async () => {
      const mockDream = {
        id: 'concurrent_test',
        title: 'Concurrent Test',
        style: 'ethereal',
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/parse-dream')
          .send({
            text: `Concurrent dream ${i}`,
            style: 'ethereal',
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty text after trim', async () => {
      const response = await request(app).post('/api/parse-dream').send({
        text: '   \n\t   ',
        style: 'ethereal',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Dream text is required');
    });

    test('should handle special characters in text', async () => {
      const mockDream = {
        id: 'special_chars',
        title: 'Special Characters',
        style: 'ethereal',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      const response = await request(app).post('/api/parse-dream').send({
        text: 'A dream with éspecial châractërs & symbols!!! @#$%^&*()',
        style: 'ethereal',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    test('should handle unicode text', async () => {
      const mockDream = {
        id: 'unicode_test',
        title: 'Unicode Test',
        style: 'ethereal',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDream }),
      });

      const response = await request(app).post('/api/parse-dream').send({
        text: '梦境测试 🌙✨ Тест снов رؤية الأحلام',
        style: 'ethereal',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    test('should handle malformed options object', async () => {
      const response = await request(app).post('/api/parse-dream').send({
        text: 'Options test',
        style: 'ethereal',
        options: 'invalid_options',
      });

      expect(response.status).toBe(200); // Should handle gracefully
      expect(response.body.data).toBeDefined();
    });
  });
});
