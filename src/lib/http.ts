import { readFileSync } from 'node:fs';
import os from 'node:os';
import process from 'node:process';

function getPackageVersion(): string {
  // Try path from bundled output (dist/main.js -> ../package.json)
  // Falls back to path from source (src/lib/http.ts -> ../../package.json)
  for (const path of ['../package.json', '../../package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf-8'));
      return pkg.version;
    } catch {}
  }
  return '0.0.0';
}

const version = getPackageVersion();

const BASE_URL = 'https://api.granola.ai';
const APP_VERSION = '7.0.0';

function buildUserAgent(): string {
  const platform = process.platform === 'darwin' ? 'macOS' : process.platform;
  const osRelease = os.release();
  return `Granola/${APP_VERSION} granola-cli/${version} (${platform} ${osRelease})`;
}

function getClientHeaders(): Record<string, string> {
  return {
    'X-App-Version': APP_VERSION,
    'X-Client-Version': APP_VERSION,
    'X-Client-Type': 'cli',
    'X-Client-Platform': process.platform,
    'X-Client-Architecture': process.arch,
    'X-Client-Id': `granola-cli-${version}`,
    'User-Agent': buildUserAgent(),
  };
}

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 250,
  retryableStatuses: [429, 500, 502, 503, 504],
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HttpClient {
  post<T>(endpoint: string, body?: object): Promise<T>;
  setToken(token: string): void;
}

function isRetryable(status: number): boolean {
  return RETRY_CONFIG.retryableStatuses.includes(status);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createHttpClient(token: string): HttpClient {
  let currentToken = token;

  async function post<T>(endpoint: string, body: object = {}): Promise<T> {
    let lastError: Error | null = null;
    const maxAttempts = RETRY_CONFIG.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
            ...getClientHeaders(),
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const responseBody = await response.json().catch(() => ({}));

          if (isRetryable(response.status) && attempt < maxAttempts - 1) {
            const delay = RETRY_CONFIG.baseDelay * 2 ** attempt;
            await sleep(delay);
            continue;
          }

          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            responseBody,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        lastError = error as Error;

        if (attempt < maxAttempts - 1) {
          const delay = RETRY_CONFIG.baseDelay * 2 ** attempt;
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  function setToken(newToken: string): void {
    currentToken = newToken;
  }

  return { post, setToken };
}
