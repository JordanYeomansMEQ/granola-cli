import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We'll import from the module we're about to create
import { ApiError, createHttpClient } from '../../src/lib/http.js';

describe('http client', () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('createHttpClient', () => {
    it('should create a client with the given token', () => {
      const client = createHttpClient('test-token');
      expect(client).toBeDefined();
      expect(client.post).toBeDefined();
      expect(client.setToken).toBeDefined();
    });
  });

  describe('post', () => {
    it('should make a POST request to the correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const client = createHttpClient('test-token');
      await client.post('/v1/test-endpoint', { foo: 'bar' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.granola.ai/v1/test-endpoint',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ foo: 'bar' }),
        }),
      );
    });

    it('should include correct headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('my-access-token');
      await client.post('/v1/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-access-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should include client identification headers by default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');
      await client.post('/v1/endpoint');

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['X-App-Version']).toBe('7.0.0');
      expect(headers['X-Client-Type']).toBe('cli');
      expect(headers['X-Client-Platform']).toBeDefined();
      expect(headers['X-Client-Architecture']).toBeDefined();
      expect(headers['X-Client-Id']).toMatch(/^granola-cli-/);
      expect(headers['User-Agent']).toMatch(/^Granola\/7\.0\.0 granola-cli\//);
    });

    it('should return parsed JSON response', async () => {
      const responseData = { id: '123', name: 'test' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual(responseData);
    });

    it('should send empty object when no body provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');
      await client.post('/v1/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: '{}',
        }),
      );
    });
  });

  describe('setToken', () => {
    it('should update the token for subsequent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('old-token');
      client.setToken('new-token');
      await client.post('/v1/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer new-token',
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw ApiError on 400 Bad Request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid input' }),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      await expect(client.post('/v1/endpoint')).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('400'),
      });
    });

    it('should throw ApiError on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      await expect(client.post('/v1/endpoint')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('should throw ApiError on 404 Not Found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should include response body in ApiError', async () => {
      const errorBody = { error: { code: 'INVALID_TOKEN', message: 'Token expired' } };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve(errorBody),
      });

      const client = createHttpClient('token');

      try {
        await client.post('/v1/endpoint');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).body).toEqual(errorBody);
      }
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 Too Many Requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 Internal Server Error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502 Bad Gateway', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 Service Unavailable', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 504 Gateway Timeout', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 504,
          statusText: 'Gateway Timeout',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry up to 3 times before failing', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should not retry on 400 Bad Request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 Forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 Not Found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const client = createHttpClient('token');
      const result = await client.post('/v1/endpoint');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = createHttpClient('token');

      await expect(client.post('/v1/endpoint')).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });
});
