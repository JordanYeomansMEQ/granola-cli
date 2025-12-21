import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the client module
vi.mock('../../src/services/client.js', () => ({
  getClient: vi.fn(),
  withTokenRefresh: vi.fn((fn) => fn()),
}));

import { getClient } from '../../src/services/client.js';
import { get, list, resolveId } from '../../src/services/workspaces.js';
import {
  mockWorkspace,
  mockWorkspaces,
  mockWorkspacesApiResponse,
} from '../fixtures/workspaces.js';

describe('workspaces service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list all workspaces', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(mockWorkspacesApiResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toEqual(mockWorkspaces);
    });

    it('should return empty array when no workspaces', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue({ workspaces: [] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toEqual([]);
    });

    it('should handle nested workspaces response structure', async () => {
      const nestedResponse = {
        workspaces: [
          {
            workspace: {
              workspace_id: 'ws-123',
              display_name: 'Nested Workspace',
              created_at: '2025-01-01T00:00:00Z',
            },
            role: 'owner',
            plan_type: 'pro',
          },
        ],
      };
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(nestedResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'ws-123',
        name: 'Nested Workspace',
        created_at: '2025-01-01T00:00:00Z',
        owner_id: '',
      });
    });

    it('should handle null/undefined response', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toEqual([]);
    });
  });

  describe('get', () => {
    it('should get workspace by id', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(mockWorkspacesApiResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get('abc12345');

      expect(result).toEqual(mockWorkspace);
    });

    it('should return null when workspace not found', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(mockWorkspacesApiResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('resolveId', () => {
    it('should resolve a partial ID to full ID', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(mockWorkspacesApiResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await resolveId('abc');

      expect(result).toBe('abc12345');
    });

    it('should return null when no workspace matches', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(mockWorkspacesApiResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await resolveId('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when multiple workspaces match', async () => {
      const duplicateResponse = {
        workspaces: [
          {
            workspace: {
              workspace_id: 'abc12345',
              display_name: 'Workspace 1',
              created_at: '2025-01-01',
            },
            role: 'owner',
            plan_type: 'free',
          },
          {
            workspace: {
              workspace_id: 'abc67890',
              display_name: 'Workspace 2',
              created_at: '2025-01-02',
            },
            role: 'owner',
            plan_type: 'free',
          },
        ],
      };
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(duplicateResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      await expect(resolveId('abc')).rejects.toThrow(/ambiguous.*2 workspaces/i);
    });

    it('should resolve full ID to itself', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockResolvedValue(mockWorkspacesApiResponse),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await resolveId('abc12345');

      expect(result).toBe('abc12345');
    });
  });

  describe('error handling', () => {
    it('should throw when list() encounters network error', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      await expect(list()).rejects.toThrow(/network/i);
    });

    it('should throw when get() encounters network error', async () => {
      const mockClient = {
        getWorkspaces: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      await expect(get('abc12345')).rejects.toThrow(/connection/i);
    });

    it('should throw when client authentication fails', async () => {
      vi.mocked(getClient).mockRejectedValue(new Error('Authentication failed'));

      await expect(list()).rejects.toThrow(/authentication/i);
    });
  });
});
