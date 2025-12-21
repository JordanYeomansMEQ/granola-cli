import { createGranolaDebug } from '../lib/debug.js';
import type { Workspace } from '../types.js';
import { getClient, withTokenRefresh } from './client.js';

const debug = createGranolaDebug('service:workspaces');

export async function list(): Promise<Workspace[]> {
  return withTokenRefresh(async () => {
    debug('fetching workspaces');
    const client = await getClient();
    const res = await client.getWorkspaces();

    const workspacesArray = res?.workspaces || [];
    debug('found %d workspaces', workspacesArray.length);
    return workspacesArray.map((item) => {
      const ws = item.workspace;
      return {
        id: ws.workspace_id,
        name: ws.display_name,
        created_at: ws.created_at,
        owner_id: '',
      } as Workspace;
    });
  });
}

export async function resolveId(partialId: string): Promise<string | null> {
  debug('resolving workspace id: %s', partialId);
  const workspaces = await list();
  const matches = workspaces.filter((w) => w.id.startsWith(partialId));

  if (matches.length === 0) {
    debug('no workspace found for id: %s', partialId);
    return null;
  }
  if (matches.length > 1) {
    debug('ambiguous id: %s matches %d workspaces', partialId, matches.length);
    throw new Error(`Ambiguous ID: ${partialId} matches ${matches.length} workspaces`);
  }
  debug('resolved workspace: %s -> %s', partialId, matches[0].id);
  return matches[0].id;
}

export async function get(id: string): Promise<Workspace | null> {
  debug('getting workspace: %s', id);
  const workspaces = await list();
  const workspace = workspaces.find((w) => w.id === id) || null;
  debug('workspace %s: %s', id, workspace ? 'found' : 'not found');
  return workspace;
}
