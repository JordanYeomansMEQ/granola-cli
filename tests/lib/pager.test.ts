import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('../../src/lib/config.js', () => ({
  getConfigValue: vi.fn(() => undefined),
}));

import { spawn } from 'node:child_process';
import { getConfigValue } from '../../src/lib/config.js';
import { getPagerCommand, pipeToPager, validatePagerCommand } from '../../src/lib/pager.js';

describe('pager', () => {
  let originalIsTTY: boolean;
  let originalStdout: NodeJS.WriteStream;
  let mockWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalIsTTY = process.stdout.isTTY ?? false;
    originalStdout = process.stdout;
    mockWrite = vi.fn();
  });

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    Object.defineProperty(process, 'stdout', { value: originalStdout });
  });

  describe('getPagerCommand', () => {
    it('should return custom pager from env', () => {
      const originalEnv = process.env.GRANOLA_PAGER;
      try {
        process.env.GRANOLA_PAGER = 'custom-pager';

        const result = getPagerCommand();

        expect(result).toBe('custom-pager');
      } finally {
        process.env.GRANOLA_PAGER = originalEnv;
      }
    });

    it('should fallback to PAGER env var', () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      try {
        delete process.env.GRANOLA_PAGER;
        process.env.PAGER = 'env-pager';

        const result = getPagerCommand();

        expect(result).toBe('env-pager');
      } finally {
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
      }
    });

    it('should fallback to less as default', () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      try {
        delete process.env.GRANOLA_PAGER;
        delete process.env.PAGER;

        const result = getPagerCommand();

        expect(result).toBe('less -R');
      } finally {
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
      }
    });
    it('should fallback to configured pager when env vars missing', () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      try {
        delete process.env.GRANOLA_PAGER;
        delete process.env.PAGER;
        vi.mocked(getConfigValue).mockReturnValue('config-pager' as never);

        const result = getPagerCommand();

        expect(result).toBe('config-pager');
      } finally {
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
        vi.mocked(getConfigValue).mockReturnValue(undefined as never);
      }
    });
  });

  describe('validatePagerCommand', () => {
    it('should accept allowed pagers', () => {
      expect(validatePagerCommand('less')).toBe(true);
      expect(validatePagerCommand('less -R')).toBe(true);
      expect(validatePagerCommand('more')).toBe(true);
      expect(validatePagerCommand('cat')).toBe(true);
      expect(validatePagerCommand('bat')).toBe(true);
      expect(validatePagerCommand('most')).toBe(true);
    });

    it('should accept pagers with full paths', () => {
      expect(validatePagerCommand('/usr/bin/less')).toBe(true);
      expect(validatePagerCommand('/usr/bin/less -R')).toBe(true);
    });

    it('should reject unknown pagers', () => {
      expect(validatePagerCommand('unknown-pager')).toBe(false);
      expect(validatePagerCommand('vim')).toBe(false);
    });

    it('should reject commands with shell metacharacters', () => {
      expect(validatePagerCommand('less; rm -rf /')).toBe(false);
      expect(validatePagerCommand('less | cat')).toBe(false);
      expect(validatePagerCommand('less & echo')).toBe(false);
      expect(validatePagerCommand('less $(whoami)')).toBe(false);
      expect(validatePagerCommand('less `whoami`')).toBe(false);
    });

    it('should reject commands with dangerous characters', () => {
      expect(validatePagerCommand('less > /tmp/file')).toBe(false);
      expect(validatePagerCommand('less < /etc/passwd')).toBe(false);
      expect(validatePagerCommand('less && rm -rf /')).toBe(false);
    });
  });

  describe('pipeToPager', () => {
    it('should write directly to stdout when not a TTY', async () => {
      const mockStdout = {
        write: mockWrite,
        isTTY: false,
      };
      Object.defineProperty(process, 'stdout', { value: mockStdout, writable: true });
      process.stdout.isTTY = false;

      await pipeToPager('test content');

      expect(mockWrite).toHaveBeenCalledWith('test content\n');
    });

    it('should spawn pager when TTY and pipe content to stdin', async () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      try {
        delete process.env.GRANOLA_PAGER;
        delete process.env.PAGER;

        process.stdout.isTTY = true;

        const writtenContent: string[] = [];
        const mockStdin = new Writable({
          write(chunk, _encoding, callback) {
            writtenContent.push(chunk.toString());
            callback();
          },
        });
        const mockProcess = {
          stdin: mockStdin,
          on: vi.fn((event: string, callback: () => void) => {
            if (event === 'close') {
              setTimeout(callback, 0);
            }
            return mockProcess;
          }),
        };

        vi.mocked(spawn).mockReturnValue(mockProcess as never);

        await pipeToPager('test content');

        expect(spawn).toHaveBeenCalled();
        expect(writtenContent.join('')).toBe('test content');
      } finally {
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
      }
    });

    it('should handle pager spawn errors gracefully', async () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      try {
        delete process.env.GRANOLA_PAGER;
        delete process.env.PAGER;

        process.stdout.isTTY = true;

        const mockStdin = new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          },
        });
        const mockProcess = {
          stdin: mockStdin,
          on: vi.fn((event: string, callback: (code: number | null) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 0);
            }
            return mockProcess;
          }),
        };

        vi.mocked(spawn).mockReturnValue(mockProcess as never);

        // Should not throw
        await expect(pipeToPager('test content')).resolves.toBeUndefined();
      } finally {
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
      }
    });

    it('should fallback to stdout when pager emits an error', async () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        delete process.env.GRANOLA_PAGER;
        delete process.env.PAGER;

        const mockStdout = {
          write: mockWrite,
          isTTY: true,
        };
        Object.defineProperty(process, 'stdout', { value: mockStdout, writable: true });
        process.stdout.isTTY = true;

        const mockStdin = new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          },
        });
        const mockProcess = {
          stdin: mockStdin,
          on: vi.fn((event: string, callback: (arg?: unknown) => void) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('spawn error')), 0);
            }
            return mockProcess;
          }),
        };

        vi.mocked(spawn).mockReturnValue(mockProcess as never);

        await expect(pipeToPager('pager output')).resolves.toBeUndefined();
        expect(mockWrite).toHaveBeenCalledWith('pager output\n');
        expect(consoleError).toHaveBeenCalledWith(expect.stringMatching(/unable to launch pager/i));
      } finally {
        consoleError.mockRestore();
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
      }
    });

    it('should handle empty content', async () => {
      const mockStdout = {
        write: mockWrite,
        isTTY: false,
      };
      Object.defineProperty(process, 'stdout', { value: mockStdout, writable: true });
      process.stdout.isTTY = false;

      await pipeToPager('');

      expect(mockWrite).toHaveBeenCalledWith('\n');
    });

    it('should fallback to stdout when pager command is invalid', async () => {
      const originalPager = process.env.GRANOLA_PAGER;
      try {
        process.env.GRANOLA_PAGER = 'malicious; rm -rf /';

        const mockStdout = {
          write: mockWrite,
          isTTY: true,
        };
        Object.defineProperty(process, 'stdout', { value: mockStdout, writable: true });
        process.stdout.isTTY = true;

        const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

        await pipeToPager('test content');

        expect(mockWrite).toHaveBeenCalledWith('test content\n');
        expect(mockError).toHaveBeenCalledWith(
          expect.stringMatching(/invalid.*pager|pager.*invalid/i),
        );
        expect(spawn).not.toHaveBeenCalled();

        mockError.mockRestore();
      } finally {
        process.env.GRANOLA_PAGER = originalPager;
      }
    });

    it('should fallback to stdout when spawn throws synchronously', async () => {
      const originalGranola = process.env.GRANOLA_PAGER;
      const originalPager = process.env.PAGER;
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        delete process.env.GRANOLA_PAGER;
        delete process.env.PAGER;

        const mockStdout = {
          write: mockWrite,
          isTTY: true,
        };
        Object.defineProperty(process, 'stdout', { value: mockStdout, writable: true });
        process.stdout.isTTY = true;

        vi.mocked(spawn).mockImplementation(() => {
          throw new Error('spawn failure');
        });

        await expect(pipeToPager('sync error content')).resolves.toBeUndefined();
        expect(mockWrite).toHaveBeenCalledWith('sync error content\n');
        expect(consoleError).toHaveBeenCalledWith(expect.stringMatching(/unable to launch pager/i));
      } finally {
        consoleError.mockRestore();
        process.env.GRANOLA_PAGER = originalGranola;
        process.env.PAGER = originalPager;
      }
    });
  });
});
