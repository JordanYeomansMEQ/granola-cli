import chalk from 'chalk';
import { createApiClient, type GranolaApi } from '../lib/api.js';
import { getCredentials, refreshAccessToken } from '../lib/auth.js';
import { createGranolaDebug, maskToken } from '../lib/debug.js';
import { createHttpClient } from '../lib/http.js';

const debug = createGranolaDebug('service:client');

let client: GranolaApi | null = null;

export async function getClient(): Promise<GranolaApi> {
  debug('getClient called, cached: %s', client ? 'yes' : 'no');
  if (client) return client;

  debug('fetching credentials');
  const creds = await getCredentials();
  if (!creds) {
    debug('no credentials found, exiting');
    console.error(chalk.red('Error:'), 'Not authenticated.');
    console.error(`Run ${chalk.cyan('granola auth login')} to authenticate.`);
    process.exit(2);
  }

  debug('creating API client, token: %s', maskToken(creds.accessToken));
  const httpClient = createHttpClient(creds.accessToken);
  client = createApiClient(httpClient);

  return client;
}

export function resetClient(): void {
  debug('client reset');
  client = null;
}

function isUnauthorizedError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as { status?: number };
    return e.status === 401;
  }
  return false;
}

/**
 * Wraps an async operation with automatic token refresh on 401 errors.
 * If the operation fails with a 401, attempts to refresh the token and retry once.
 */
export async function withTokenRefresh<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (isUnauthorizedError(error)) {
      debug('401 detected, attempting token refresh');

      const newCreds = await refreshAccessToken();
      if (!newCreds) {
        debug('token refresh failed, re-throwing original error');
        throw error;
      }

      resetClient();
      debug('retrying operation with refreshed token');
      return operation();
    }
    throw error;
  }
}
