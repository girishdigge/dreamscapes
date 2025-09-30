// services/express/tests/patch.test.js
const request = require('supertest');
const express = require('express');
const patchRoutes = require('../routes/patch');
const { setToCache, clearCache } = require('../middleware/cache');

// Mock MCP Gateway
jest.mock('node-fetch');
const fetch = require('node-fetch');

// Create test app
const app = express();
app.use(express.json());
app.use('/api', patchRoutes);

describe('Patch Dream Routes', () => {
  const sampleDream = {
    id: 'test_dream',
    title: 'Test Dream',
    style: 'ethereal',
    structures: [
      {
        id: 's1',
        template: 'floating_library',
        pos: [0, 20, 0],
        scale: 1.0,
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
        },
      ],
    },
    assumptions: ['Original dream'],
  };

  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
    setToCache('test_dream', { ...sampleDream });
  });

  describe('POST /api/patch-dream', () => {
    test('should patch dream successfully with AI', async () => {
      const patchedDream = {
        ...sampleDream,
        entities: [
          {
            ...sampleDream.entities[0],
            params: {
              ...sampleDream.entities[0].params,
              color: '#0000ff',
              glow: 0.8,
            },
          },
        ],
        assumptions: [
          ...sampleDream.assumptions,
          'Applied edit: make books glow blue',
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: patchedDream }),
      });

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make the books glow blue',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entities[0].params.color).toBe('#0000ff');
      expect(response.body.data.entities[0].params.glow).toBe(0.8);
      expect(response.body.metadata.patchSource).toBe('ai');
    });

    test('should use rule-based patching when AI fails', async () => {
      fetch.mockRejectedValueOnce(new Error('AI service unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it glow blue',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.patchSource).toBe('rule_based');
      expect(response.body.data.entities[0].params.color).toBe('#0000ff');
    });

    test('should validate required fields', async () => {
      const response = await request(app).post('/api/patch-dream').send({
        // Missing dreamId
        editText: 'make it blue',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Dream ID is required');
    });

    test('should validate edit text', async () => {
      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        // Missing editText
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Edit text is required');
    });

    test('should handle non-existent dream', async () => {
      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'nonexistent_dream',
        editText: 'make it blue',
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Dream not found');
    });

    test('should validate edit text length', async () => {
      const longEdit = 'a'.repeat(501);

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: longEdit,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Edit text too long');
    });

    test('should maintain patch history', async () => {
      // First patch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              ...sampleDream,
              patchHistory: [
                {
                  editText: 'make it blue',
                  appliedAt: '2023-01-01T00:00:00.000Z',
                  source: 'ai',
                },
              ],
            },
          }),
      });

      const response1 = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it blue',
      });

      expect(response1.body.data.patchHistory).toHaveLength(1);

      // Update cache with patched dream
      setToCache('test_dream', response1.body.data);

      // Second patch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              ...response1.body.data,
              patchHistory: [
                ...response1.body.data.patchHistory,
                {
                  editText: 'make it faster',
                  appliedAt: '2023-01-01T00:01:00.000Z',
                  source: 'ai',
                },
              ],
            },
          }),
      });

      const response2 = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it faster',
      });

      expect(response2.body.data.patchHistory).toHaveLength(2);
    });
  });

  describe('Rule-based Patching', () => {
    test('should handle color modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const colorTests = [
        { text: 'make it red', expectedColor: '#ff0000' },
        { text: 'turn blue', expectedColor: '#0000ff' },
        { text: 'change to green', expectedColor: '#00ff00' },
        { text: 'make yellow', expectedColor: '#ffff00' },
      ];

      for (const test of colorTests) {
        setToCache('test_dream', { ...sampleDream });

        const response = await request(app).post('/api/patch-dream').send({
          dreamId: 'test_dream',
          editText: test.text,
        });

        expect(response.status).toBe(200);
        expect(response.body.data.entities[0].params.color).toBe(
          test.expectedColor
        );
      }
    });

    test('should handle glow modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it glow brighter',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.entities[0].params.glow).toBeGreaterThan(0.5);
    });

    test('should handle size modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it bigger',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.structures[0].scale).toBeGreaterThan(1.0);
    });

    test('should handle speed modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it move faster',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.entities[0].params.speed).toBeGreaterThan(1.0);
    });

    test('should handle quantity modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'add more books',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.entities[0].count).toBeGreaterThan(25);
    });

    test('should handle environment modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it foggy',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.environment?.fog).toBe(0.7);
    });

    test('should handle time of day modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it nighttime',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.environment?.preset).toBe('night');
      expect(response.body.data.environment?.ambientLight).toBe(0.3);
    });

    test('should handle camera modifications', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'move camera closer',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.lastPatchChanges).toContain(
        'Moved camera closer'
      );
    });
  });

  describe('POST /api/patch-dream/batch', () => {
    test('should handle batch edits', async () => {
      const response = await request(app)
        .post('/api/patch-dream/batch')
        .send({
          dreamId: 'test_dream',
          edits: ['make it blue', 'make it bigger', 'add more entities'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.batchResults).toHaveLength(3);
      expect(response.body.totalEdits).toBe(3);
    });

    test('should validate batch edit limits', async () => {
      const tooManyEdits = Array.from({ length: 11 }, (_, i) => `edit ${i}`);

      const response = await request(app).post('/api/patch-dream/batch').send({
        dreamId: 'test_dream',
        edits: tooManyEdits,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Too many edits');
    });

    test('should handle individual edit failures in batch', async () => {
      const response = await request(app)
        .post('/api/patch-dream/batch')
        .send({
          dreamId: 'test_dream',
          edits: [
            'make it blue', // Should work
            '', // Should fail (empty)
            'make it bigger', // Should work
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.batchResults).toHaveLength(3);
      expect(response.body.batchResults[1].success).toBe(false);
      expect(response.body.successfulEdits).toBe(2);
    });

    test('should require valid input for batch', async () => {
      const response = await request(app).post('/api/patch-dream/batch').send({
        dreamId: 'test_dream',
        edits: 'not_an_array',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid batch patch request');
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors gracefully', async () => {
      const dreamWithInvalidData = {
        ...sampleDream,
        cinematography: null, // Invalid cinematography
      };

      setToCache('invalid_dream', dreamWithInvalidData);

      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'invalid_dream',
        editText: 'make it blue',
      });

      expect(response.status).toBe(200); // Should use safe fallback
      expect(response.body.data).toBeDefined();
    });

    test('should handle MCP Gateway errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it blue',
      });

      expect(response.status).toBe(200); // Should fallback
      expect(response.body.metadata.patchSource).toBe('rule_based');
    });

    test('should handle network timeout', async () => {
      fetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
      );

      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it blue',
      });

      expect(response.status).toBe(200); // Should fallback gracefully
    });
  });

  describe('Performance', () => {
    test('should respond quickly for simple edits', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const start = Date.now();
      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: 'make it blue',
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should be very fast for rule-based
    });

    test('should handle complex edits efficiently', async () => {
      fetch.mockRejectedValueOnce(new Error('AI unavailable'));

      const complexEdit =
        'make it glow bright blue, move faster, add more entities, make structures bigger, change to nighttime, add fog';

      const start = Date.now();
      const response = await request(app).post('/api/patch-dream').send({
        dreamId: 'test_dream',
        editText: complexEdit,
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      expect(response.body.data.lastPatchChanges.length).toBeGreaterThan(1);
    });
  });
});
