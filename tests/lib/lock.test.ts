import { rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _testing, acquireLock, releaseLock, withLock } from '../../src/lib/lock.js';

function getLockFilePath(): string {
  const tempDir =
    process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'granola') : tmpdir();
  return join(tempDir, 'granola-token-refresh.lock');
}

describe('lock', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    try {
      await rm(getLockFilePath(), { force: true });
    } catch {
      // Lock file may not exist
    }
  });

  afterEach(async () => {
    try {
      await rm(getLockFilePath(), { force: true });
    } catch {
      // Lock file may not exist
    }
  });

  describe('acquireLock/releaseLock', () => {
    it('should acquire and release lock successfully', async () => {
      const lockHandle = await acquireLock();

      expect(lockHandle).not.toBeNull();
      expect(lockHandle?.handle).toBeDefined();

      await releaseLock(lockHandle!);
    });

    it('should block concurrent lock attempts until released', async () => {
      const lockHandle1 = await acquireLock();
      expect(lockHandle1).not.toBeNull();

      const lockPromise = acquireLock();

      setTimeout(async () => {
        await releaseLock(lockHandle1!);
      }, 200);

      const lockHandle2 = await lockPromise;
      expect(lockHandle2).not.toBeNull();
      await releaseLock(lockHandle2!);
    });

    it('should allow reacquiring lock after release', async () => {
      const lockHandle1 = await acquireLock();
      expect(lockHandle1).not.toBeNull();
      await releaseLock(lockHandle1!);

      const lockHandle2 = await acquireLock();
      expect(lockHandle2).not.toBeNull();
      await releaseLock(lockHandle2!);
    });

    it('should return null when timeout expires', async () => {
      const lockHandle1 = await acquireLock();
      expect(lockHandle1).not.toBeNull();

      // Try to acquire with very short timeout while lock is held
      const lockHandle2 = await acquireLock(200);
      expect(lockHandle2).toBeNull();

      await releaseLock(lockHandle1!);
    });

    it('should handle errors during release gracefully', async () => {
      const lockHandle = await acquireLock();
      expect(lockHandle).not.toBeNull();

      // Delete the lock file before release - unlink will fail
      await rm(getLockFilePath(), { force: true });

      // Should not throw, just log the error
      await expect(releaseLock(lockHandle!)).resolves.toBeUndefined();
    });
  });

  describe('withLock', () => {
    it('should execute operation within lock', async () => {
      const result = await withLock(async () => 'success');
      expect(result).toBe('success');
    });

    it('should return operation result', async () => {
      const result = await withLock(async () => ({ value: 42 }));
      expect(result).toEqual({ value: 42 });
    });

    it('should release lock on success', async () => {
      await withLock(async () => 'done');

      const handle = await acquireLock();
      expect(handle).not.toBeNull();
      await releaseLock(handle!);
    });

    it('should release lock on error', async () => {
      await expect(
        withLock(async () => {
          throw new Error('test error');
        }),
      ).rejects.toThrow('test error');

      const handle = await acquireLock();
      expect(handle).not.toBeNull();
      await releaseLock(handle!);
    });

    it('should serialize concurrent operations', async () => {
      const order: number[] = [];

      // Start first operation and wait for it to acquire lock
      const promise1 = withLock(async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 50));
        order.push(2);
        return 'first';
      });

      // Small delay to ensure promise1 acquires lock first
      await new Promise((r) => setTimeout(r, 10));

      const promise2 = withLock(async () => {
        order.push(3);
        await new Promise((r) => setTimeout(r, 10));
        order.push(4);
        return 'second';
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('first');
      expect(result2).toBe('second');
      // Operations should not interleave - first completes before second starts
      expect(order).toEqual([1, 2, 3, 4]);
    });

    it('should throw when lock cannot be acquired within timeout', async () => {
      const lockHandle = await acquireLock();
      expect(lockHandle).not.toBeNull();

      await expect(withLock(async () => 'x', 200)).rejects.toThrow(
        'Failed to acquire token refresh lock',
      );

      await releaseLock(lockHandle!);
    });
  });

  describe('_testing exports', () => {
    it('should export lock configuration', () => {
      expect(_testing.LOCK_TIMEOUT_MS).toBe(30000);
      expect(_testing.LOCK_RETRY_INTERVAL_MS).toBe(100);
      expect(_testing.LOCK_STALE_MS).toBe(60000);
    });

    it('should export getLockFilePath', () => {
      const path = _testing.getLockFilePath();
      expect(path).toContain('granola-token-refresh.lock');
    });
  });
});
