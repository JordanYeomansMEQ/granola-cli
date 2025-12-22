import type { FileHandle } from 'node:fs/promises';
import { mkdir, open, stat, unlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:lock');

const LOCK_FILE_NAME = 'granola-token-refresh.lock';
const LOCK_TIMEOUT_MS = 30000;
const LOCK_RETRY_INTERVAL_MS = 100;
const LOCK_STALE_MS = 60000;

interface LockHandle {
  handle: FileHandle;
}

function getLockFilePath(): string {
  const tempDir =
    process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'granola') : tmpdir();
  return join(tempDir, LOCK_FILE_NAME);
}

async function ensureLockDirectory(): Promise<void> {
  const lockPath = getLockFilePath();
  const dir = dirname(lockPath);
  await mkdir(dir, { recursive: true });
}

async function isLockStale(lockPath: string): Promise<boolean> {
  try {
    const stats = await stat(lockPath);
    const age = Date.now() - stats.mtimeMs;
    return age > LOCK_STALE_MS;
  } catch {
    return true;
  }
}

/**
 * Acquires an exclusive file lock for token refresh operations.
 * Uses O_CREAT | O_EXCL for atomic creation.
 *
 * @param timeoutMs - Maximum time to wait for lock acquisition (default: 30s)
 * @returns LockHandle if lock acquired, null if timeout
 */
export async function acquireLock(timeoutMs: number = LOCK_TIMEOUT_MS): Promise<LockHandle | null> {
  const lockPath = getLockFilePath();
  const startTime = Date.now();

  await ensureLockDirectory();
  debug('attempting to acquire lock at %s', lockPath);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const handle = await open(lockPath, 'wx');
      debug('lock acquired');
      return { handle };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EEXIST') {
        if (await isLockStale(lockPath)) {
          debug('removing stale lock');
          try {
            await unlink(lockPath);
          } catch {
            // Another process may have removed it
          }
          continue;
        }

        debug('lock held by another process, waiting...');
        await new Promise((r) => setTimeout(r, LOCK_RETRY_INTERVAL_MS));
      } else {
        debug('lock acquisition failed: %O', error);
        throw error;
      }
    }
  }

  debug('lock acquisition timed out');
  return null;
}

/**
 * Releases a file lock.
 *
 * @param lockHandle - The lock handle from acquireLock
 */
export async function releaseLock(lockHandle: LockHandle): Promise<void> {
  const lockPath = getLockFilePath();
  debug('releasing lock');
  try {
    await lockHandle.handle.close();
    await unlink(lockPath);
    debug('lock released');
  } catch (error) {
    debug('error releasing lock: %O', error);
  }
}

/**
 * Executes an operation within a file lock.
 * Ensures the lock is released even if the operation throws.
 *
 * @param operation - The async operation to execute
 * @param timeoutMs - Maximum time to wait for lock acquisition (default: 30s)
 * @returns The result of the operation
 * @throws Error if lock cannot be acquired or operation fails
 */
export async function withLock<T>(
  operation: () => Promise<T>,
  timeoutMs: number = LOCK_TIMEOUT_MS,
): Promise<T> {
  const handle = await acquireLock(timeoutMs);
  if (handle === null) {
    throw new Error('Failed to acquire token refresh lock');
  }

  try {
    return await operation();
  } finally {
    await releaseLock(handle);
  }
}

// Export for testing
export const _testing = {
  getLockFilePath,
  LOCK_TIMEOUT_MS,
  LOCK_RETRY_INTERVAL_MS,
  LOCK_STALE_MS,
};
