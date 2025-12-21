import { readFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { deletePassword, getPassword, setPassword } from 'cross-keychain';
import type { Credentials } from '../types.js';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:auth');

const SERVICE_NAME = 'com.granola.cli';
const ACCOUNT_NAME = 'credentials';
const DEFAULT_CLIENT_ID = 'client_GranolaMac';

export async function getCredentials(): Promise<Credentials | null> {
  debug('loading credentials from keychain');
  try {
    const stored = await getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!stored) {
      debug('no credentials found in keychain');
      return null;
    }

    const parsed = JSON.parse(stored);
    debug('credentials loaded, hasAccessToken: %s', Boolean(parsed.accessToken));
    return {
      refreshToken: parsed.refreshToken,
      accessToken: parsed.accessToken || '',
      clientId: parsed.clientId,
    };
  } catch (error) {
    debug('failed to get credentials: %O', error);
    return null;
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  debug('saving credentials to keychain');
  await setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(creds));
  debug('credentials saved');
}

export async function deleteCredentials(): Promise<void> {
  debug('deleting credentials from keychain');
  await deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  debug('credentials deleted');
}

const WORKOS_AUTH_URL = 'https://api.workos.com/user_management/authenticate';

/**
 * Refreshes the access token using the stored refresh token.
 * WorkOS refresh tokens are single-use - each refresh returns a new refresh token
 * that must be saved immediately.
 *
 * @returns New credentials if refresh succeeds, null otherwise
 */
export async function refreshAccessToken(): Promise<Credentials | null> {
  debug('attempting token refresh');

  const creds = await getCredentials();
  if (!creds?.refreshToken || !creds?.clientId) {
    debug('cannot refresh: missing refreshToken or clientId');
    return null;
  }

  try {
    const response = await fetch(WORKOS_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      }),
    });

    if (!response.ok) {
      debug('token refresh failed: %d %s', response.status, response.statusText);
      return null;
    }

    const data = (await response.json()) as { refresh_token: string; access_token: string };
    const newCreds: Credentials = {
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      clientId: creds.clientId,
    };

    await saveCredentials(newCreds);
    debug('token refresh successful, new credentials saved');
    return newCreds;
  } catch (error) {
    debug('token refresh error: %O', error);
    return null;
  }
}

export function parseSupabaseJson(json: string): Credentials | null {
  debug('parsing supabase.json');
  try {
    const parsed = JSON.parse(json);

    // Try WorkOS tokens first (newer auth system)
    if (parsed.workos_tokens && typeof parsed.workos_tokens === 'string') {
      const workosTokens = JSON.parse(parsed.workos_tokens);
      if (workosTokens.access_token) {
        debug('found WorkOS tokens');
        return {
          refreshToken: workosTokens.refresh_token || '',
          accessToken: workosTokens.access_token,
          clientId: workosTokens.client_id || DEFAULT_CLIENT_ID,
        };
      }
    }

    // Fall back to Cognito tokens
    if (parsed.cognito_tokens && typeof parsed.cognito_tokens === 'string') {
      const cognitoTokens = JSON.parse(parsed.cognito_tokens);
      if (!cognitoTokens.refresh_token) return null;

      debug('found Cognito tokens');
      return {
        refreshToken: cognitoTokens.refresh_token,
        accessToken: cognitoTokens.access_token || '',
        clientId: cognitoTokens.client_id || DEFAULT_CLIENT_ID,
      };
    }

    // Legacy format: refresh_token at root level
    if (!parsed.refresh_token) return null;

    debug('found legacy token format');
    return {
      refreshToken: parsed.refresh_token,
      accessToken: parsed.access_token || '',
      clientId: parsed.client_id || DEFAULT_CLIENT_ID,
    };
  } catch (error) {
    debug('failed to parse supabase.json: %O', error);
    return null;
  }
}

/**
 * Gets the default path to the Granola supabase.json file based on the OS.
 *
 * @returns The platform-specific path to supabase.json
 */
export function getDefaultSupabasePath(): string {
  const home = homedir();
  const os = platform();

  let path: string;
  switch (os) {
    case 'darwin':
      path = join(home, 'Library', 'Application Support', 'Granola', 'supabase.json');
      break;
    case 'win32':
      path = join(
        process.env.APPDATA || join(home, 'AppData', 'Roaming'),
        'Granola',
        'supabase.json',
      );
      break;
    default:
      // Linux and other Unix-like systems
      path = join(home, '.config', 'granola', 'supabase.json');
  }
  debug('platform: %s, supabase path: %s', os, path);
  return path;
}

/**
 * Loads credentials from the default Granola supabase.json file.
 *
 * @returns Credentials if found and valid, null otherwise
 */
export async function loadCredentialsFromFile(): Promise<Credentials | null> {
  const path = getDefaultSupabasePath();
  debug('loading credentials from file: %s', path);
  try {
    const content = await readFile(path, 'utf-8');
    debug('file read successful, parsing content');
    return parseSupabaseJson(content);
  } catch (error) {
    debug('failed to load credentials from file: %O', error);
    return null;
  }
}
