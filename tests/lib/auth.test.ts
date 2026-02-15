import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credentials } from '../../src/types.js';

// Mock cross-keychain at the top level using hoisted mock
vi.mock('cross-keychain', () => ({
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
}));

// Mock node:os for platform-specific path tests
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
  platform: vi.fn(() => 'linux'),
}));

// Mock node:fs/promises for file-based credential tests
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

// Mock lock module to avoid file system operations in tests
vi.mock('../../src/lib/lock.js', () => ({
  withLock: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
// Import the mocked module to access mock functions
import * as crossKeychain from 'cross-keychain';
// Import auth module after mocking
import {
  deleteCredentials,
  getCredentials,
  getDefaultSupabasePath,
  loadCredentialsFromFile,
  parseSupabaseJson,
  refreshAccessToken,
  saveCredentials,
} from '../../src/lib/auth.js';
import { withLock } from '../../src/lib/lock.js';

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars between tests
    delete process.env.GRANOLA_REFRESH_TOKEN;
    delete process.env.GRANOLA_ACCESS_TOKEN;
    delete process.env.GRANOLA_CLIENT_ID;
    // Default: file store returns nothing (ENOENT)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  });

  describe('getCredentials', () => {
    it('should return credentials from env vars (highest priority)', async () => {
      process.env.GRANOLA_REFRESH_TOKEN = 'env-refresh-token';
      process.env.GRANOLA_CLIENT_ID = 'env-client-id';

      const result = await getCredentials();

      expect(result).toEqual({
        refreshToken: 'env-refresh-token',
        accessToken: '',
        clientId: 'env-client-id',
      });
      // Should not hit keychain
      expect(crossKeychain.getPassword).not.toHaveBeenCalled();
    });

    it('should return env credentials with default client ID', async () => {
      process.env.GRANOLA_REFRESH_TOKEN = 'env-refresh-token';

      const result = await getCredentials();

      expect(result).toEqual({
        refreshToken: 'env-refresh-token',
        accessToken: '',
        clientId: 'client_GranolaMac',
      });
    });

    it('should include GRANOLA_ACCESS_TOKEN from env when set', async () => {
      process.env.GRANOLA_REFRESH_TOKEN = 'env-refresh-token';
      process.env.GRANOLA_ACCESS_TOKEN = 'env-access-token';

      const result = await getCredentials();

      expect(result).toEqual({
        refreshToken: 'env-refresh-token',
        accessToken: 'env-access-token',
        clientId: 'client_GranolaMac',
      });
    });

    it('should return credentials from file store (second priority)', async () => {
      // readFile is called twice: once for file store, once could be for supabase
      // We need to mock based on path. The file store path for linux is:
      // /home/testuser/.config/granola-cli/credentials.json
      const storeCreds = JSON.stringify({
        refreshToken: 'file-refresh-token',
        accessToken: 'file-access-token',
        clientId: 'file-client-id',
      });
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (String(path).includes('granola-cli/credentials.json')) {
          return storeCreds;
        }
        throw new Error('ENOENT');
      });

      const result = await getCredentials();

      expect(result).toEqual({
        refreshToken: 'file-refresh-token',
        accessToken: 'file-access-token',
        clientId: 'file-client-id',
      });
      expect(crossKeychain.getPassword).not.toHaveBeenCalled();
    });

    it('should return credentials from keychain (third priority)', async () => {
      const storedCreds = JSON.stringify({
        refreshToken: 'test-refresh-token',
        accessToken: 'test-access-token',
        clientId: 'test-client-id',
      });

      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);

      const result = await getCredentials();

      expect(crossKeychain.getPassword).toHaveBeenCalledWith('com.granola.cli', 'credentials');
      expect(result).toEqual({
        refreshToken: 'test-refresh-token',
        accessToken: 'test-access-token',
        clientId: 'test-client-id',
      });
    });

    it('should return null when no credentials stored anywhere', async () => {
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(null);

      const result = await getCredentials();

      expect(result).toBeNull();
    });

    it('should return null on keychain error', async () => {
      vi.mocked(crossKeychain.getPassword).mockRejectedValue(new Error('Keychain error'));

      const result = await getCredentials();

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON in keychain', async () => {
      vi.mocked(crossKeychain.getPassword).mockResolvedValue('not-valid-json');

      const result = await getCredentials();

      expect(result).toBeNull();
    });

    it('should handle credentials without accessToken from keychain', async () => {
      const storedCreds = JSON.stringify({
        refreshToken: 'test-refresh-token',
        clientId: 'test-client-id',
      });

      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);

      const result = await getCredentials();

      expect(result).toEqual({
        refreshToken: 'test-refresh-token',
        accessToken: '',
        clientId: 'test-client-id',
      });
    });
  });

  describe('saveCredentials', () => {
    it('should save to both file store and keychain', async () => {
      vi.mocked(crossKeychain.setPassword).mockResolvedValue(undefined);

      const creds: Credentials = {
        refreshToken: 'new-refresh-token',
        accessToken: 'new-access-token',
        clientId: 'new-client-id',
      };

      await saveCredentials(creds);

      // File store
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('granola-cli/credentials.json'),
        JSON.stringify(creds),
        { mode: 0o600 },
      );

      // Keychain
      expect(crossKeychain.setPassword).toHaveBeenCalledWith(
        'com.granola.cli',
        'credentials',
        JSON.stringify(creds),
      );
    });

    it('should succeed even if keychain fails (headless Linux)', async () => {
      vi.mocked(crossKeychain.setPassword).mockRejectedValue(new Error('Keychain error'));

      const creds: Credentials = {
        refreshToken: 'token',
        accessToken: 'access',
        clientId: 'client',
      };

      // Should not throw — file store is the reliable fallback
      await expect(saveCredentials(creds)).resolves.toBeUndefined();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('deleteCredentials', () => {
    it('should delete from both file store and keychain', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(crossKeychain.deletePassword).mockResolvedValue(undefined);

      await deleteCredentials();

      expect(crossKeychain.deletePassword).toHaveBeenCalledWith('com.granola.cli', 'credentials');
    });

    it('should not throw if neither store has credentials', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(crossKeychain.deletePassword).mockRejectedValue(new Error('Not found'));

      await expect(deleteCredentials()).resolves.toBeUndefined();
    });
  });

  describe('parseSupabaseJson', () => {
    it('should parse valid Supabase JSON with WorkOS tokens', () => {
      const supabaseJson = {
        workos_tokens: JSON.stringify({
          access_token: 'workos-access-token',
          refresh_token: 'workos-refresh-token',
        }),
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'workos-refresh-token',
        accessToken: 'workos-access-token',
        clientId: 'client_GranolaMac',
      });
    });

    it('should fall back to Cognito tokens when WorkOS not available', () => {
      const supabaseJson = {
        cognito_tokens: JSON.stringify({
          refresh_token: 'cognito-refresh-token',
          access_token: 'cognito-access-token',
          client_id: 'cognito-client-id',
        }),
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'cognito-refresh-token',
        accessToken: 'cognito-access-token',
        clientId: 'cognito-client-id',
      });
    });

    it('should parse legacy format with root-level tokens', () => {
      const supabaseJson = {
        refresh_token: 'supabase-refresh-token',
        access_token: 'supabase-access-token',
        client_id: 'supabase-client-id',
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'supabase-refresh-token',
        accessToken: 'supabase-access-token',
        clientId: 'supabase-client-id',
      });
    });

    it('should return null for invalid JSON', () => {
      const result = parseSupabaseJson('not valid json');
      expect(result).toBeNull();
    });

    it('should return null for missing refresh_token in legacy format', () => {
      const supabaseJson = {
        client_id: 'supabase-client-id',
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));
      expect(result).toBeNull();
    });

    it('should handle missing client_id with default in legacy format', () => {
      const supabaseJson = {
        refresh_token: 'supabase-refresh-token',
        access_token: 'supabase-access-token',
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'supabase-refresh-token',
        accessToken: 'supabase-access-token',
        clientId: 'client_GranolaMac',
      });
    });

    it('should handle missing access_token in legacy format', () => {
      const supabaseJson = {
        refresh_token: 'supabase-refresh-token',
        client_id: 'supabase-client-id',
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'supabase-refresh-token',
        accessToken: '',
        clientId: 'supabase-client-id',
      });
    });

    it('should handle WorkOS tokens without refresh_token', () => {
      const supabaseJson = {
        workos_tokens: JSON.stringify({
          access_token: 'workos-access-token',
          client_id: 'workos-client-id',
        }),
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: '',
        accessToken: 'workos-access-token',
        clientId: 'workos-client-id',
      });
    });

    it('should handle WorkOS tokens without client_id', () => {
      const supabaseJson = {
        workos_tokens: JSON.stringify({
          access_token: 'workos-access-token',
          refresh_token: 'workos-refresh-token',
        }),
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'workos-refresh-token',
        accessToken: 'workos-access-token',
        clientId: 'client_GranolaMac',
      });
    });

    it('should handle Cognito tokens without access_token', () => {
      const supabaseJson = {
        cognito_tokens: JSON.stringify({
          refresh_token: 'cognito-refresh-token',
          client_id: 'cognito-client-id',
        }),
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'cognito-refresh-token',
        accessToken: '',
        clientId: 'cognito-client-id',
      });
    });

    it('should handle Cognito tokens without client_id', () => {
      const supabaseJson = {
        cognito_tokens: JSON.stringify({
          refresh_token: 'cognito-refresh-token',
          access_token: 'cognito-access-token',
        }),
      };

      const result = parseSupabaseJson(JSON.stringify(supabaseJson));

      expect(result).toEqual({
        refreshToken: 'cognito-refresh-token',
        accessToken: 'cognito-access-token',
        clientId: 'client_GranolaMac',
      });
    });
  });

  describe('getDefaultSupabasePath', () => {
    it('should return macOS path when on darwin', () => {
      vi.mocked(os.platform).mockReturnValue('darwin');
      vi.mocked(os.homedir).mockReturnValue('/Users/testuser');

      const result = getDefaultSupabasePath();

      expect(result).toBe('/Users/testuser/Library/Application Support/Granola/supabase.json');
    });

    it('should return Windows path using APPDATA when available', () => {
      vi.mocked(os.platform).mockReturnValue('win32');
      vi.mocked(os.homedir).mockReturnValue('C:\\Users\\testuser');
      const originalAppData = process.env.APPDATA;
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';

      const result = getDefaultSupabasePath();

      expect(result).toContain('Granola');
      expect(result).toContain('supabase.json');
      expect(result).toContain('AppData');

      process.env.APPDATA = originalAppData;
    });

    it('should return Windows path with fallback when APPDATA not set', () => {
      vi.mocked(os.platform).mockReturnValue('win32');
      vi.mocked(os.homedir).mockReturnValue('C:\\Users\\testuser');
      const originalAppData = process.env.APPDATA;
      delete process.env.APPDATA;

      const result = getDefaultSupabasePath();

      expect(result).toContain('Granola');
      expect(result).toContain('supabase.json');

      process.env.APPDATA = originalAppData;
    });

    it('should return Linux path for other platforms', () => {
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.homedir).mockReturnValue('/home/testuser');

      const result = getDefaultSupabasePath();

      expect(result).toBe('/home/testuser/.config/granola/supabase.json');
    });
  });

  describe('loadCredentialsFromFile', () => {
    it('should return credentials when file exists and is valid', async () => {
      vi.mocked(os.platform).mockReturnValue('darwin');
      vi.mocked(os.homedir).mockReturnValue('/Users/testuser');

      const validSupabaseJson = JSON.stringify({
        refresh_token: 'file-refresh-token',
        access_token: 'file-access-token',
        client_id: 'file-client-id',
      });
      vi.mocked(fs.readFile).mockResolvedValue(validSupabaseJson);

      const result = await loadCredentialsFromFile();

      expect(result).toEqual({
        refreshToken: 'file-refresh-token',
        accessToken: 'file-access-token',
        clientId: 'file-client-id',
      });
    });

    it('should return null when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await loadCredentialsFromFile();

      expect(result).toBeNull();
    });

    it('should return null when file contains invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('not valid json');

      const result = await loadCredentialsFromFile();

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      globalThis.fetch = mockFetch;
      mockFetch.mockReset();
    });

    it('should refresh token and save new credentials', async () => {
      // No env vars, no file store — use keychain
      const storedCreds = JSON.stringify({
        refreshToken: 'old-refresh-token',
        accessToken: 'old-access-token',
        clientId: 'test-client-id',
      });
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);
      vi.mocked(crossKeychain.setPassword).mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          }),
      });

      const result = await refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.workos.com/user_management/authenticate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'test-client-id',
            grant_type: 'refresh_token',
            refresh_token: 'old-refresh-token',
          }),
        }),
      );

      expect(result).toEqual({
        refreshToken: 'new-refresh-token',
        accessToken: 'new-access-token',
        clientId: 'test-client-id',
      });

      // Should save to file store
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return null when no credentials stored', async () => {
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(null);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null when missing refreshToken', async () => {
      const storedCreds = JSON.stringify({
        accessToken: 'old-access-token',
        clientId: 'test-client-id',
      });
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null when missing clientId', async () => {
      const storedCreds = JSON.stringify({
        refreshToken: 'old-refresh-token',
        accessToken: 'old-access-token',
      });
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null when WorkOS returns error', async () => {
      const storedCreds = JSON.stringify({
        refreshToken: 'old-refresh-token',
        accessToken: 'old-access-token',
        clientId: 'test-client-id',
      });
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(crossKeychain.setPassword).not.toHaveBeenCalled();
    });

    it('should return null on network error', async () => {
      const storedCreds = JSON.stringify({
        refreshToken: 'old-refresh-token',
        accessToken: 'old-access-token',
        clientId: 'test-client-id',
      });
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(crossKeychain.setPassword).not.toHaveBeenCalled();
    });

    it('should use file lock to prevent race conditions', async () => {
      const storedCreds = JSON.stringify({
        refreshToken: 'old-refresh-token',
        accessToken: 'old-access-token',
        clientId: 'test-client-id',
      });
      vi.mocked(crossKeychain.getPassword).mockResolvedValue(storedCreds);
      vi.mocked(crossKeychain.setPassword).mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          }),
      });

      await refreshAccessToken();

      expect(withLock).toHaveBeenCalledTimes(1);
      expect(withLock).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return null when lock acquisition fails', async () => {
      vi.mocked(withLock).mockRejectedValueOnce(new Error('Failed to acquire token refresh lock'));

      const result = await refreshAccessToken();

      expect(result).toBeNull();
    });

    it('should use env var credentials for refresh when available', async () => {
      process.env.GRANOLA_REFRESH_TOKEN = 'env-refresh-token';
      process.env.GRANOLA_CLIENT_ID = 'env-client-id';

      vi.mocked(crossKeychain.setPassword).mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          }),
      });

      const result = await refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.workos.com/user_management/authenticate',
        expect.objectContaining({
          body: JSON.stringify({
            client_id: 'env-client-id',
            grant_type: 'refresh_token',
            refresh_token: 'env-refresh-token',
          }),
        }),
      );

      expect(result).toEqual({
        refreshToken: 'new-refresh-token',
        accessToken: 'new-access-token',
        clientId: 'env-client-id',
      });

      // Keychain should NOT have been read
      expect(crossKeychain.getPassword).not.toHaveBeenCalled();
    });
  });
});
