import type { WorkspacesResponse } from '../../src/lib/api.js';
import type { Workspace } from '../../src/types.js';

export const mockWorkspace: Workspace = {
  id: 'abc12345',
  name: 'Product Team',
  created_at: '2024-03-20T10:00:00Z',
  owner_id: '',
};

export const mockWorkspaces: Workspace[] = [
  {
    id: 'personal123',
    name: 'Personal',
    created_at: '2024-01-15T10:00:00Z',
    owner_id: '',
  },
  mockWorkspace,
  {
    id: 'def67890',
    name: 'Engineering',
    created_at: '2024-03-20T10:00:00Z',
    owner_id: '',
  },
];

export const mockWorkspacesApiResponse: WorkspacesResponse = {
  workspaces: [
    {
      workspace: {
        workspace_id: 'personal123',
        slug: 'personal',
        display_name: 'Personal',
        is_locked: false,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        privacy_mode_enabled: false,
        sharing_link_visibility: null,
      },
      role: 'owner',
      plan_type: 'free',
    },
    {
      workspace: {
        workspace_id: 'abc12345',
        slug: 'product-team',
        display_name: 'Product Team',
        is_locked: false,
        created_at: '2024-03-20T10:00:00Z',
        updated_at: '2024-03-20T10:00:00Z',
        privacy_mode_enabled: false,
        sharing_link_visibility: null,
      },
      role: 'owner',
      plan_type: 'pro',
    },
    {
      workspace: {
        workspace_id: 'def67890',
        slug: 'engineering',
        display_name: 'Engineering',
        is_locked: false,
        created_at: '2024-03-20T10:00:00Z',
        updated_at: '2024-03-20T10:00:00Z',
        privacy_mode_enabled: false,
        sharing_link_visibility: null,
      },
      role: 'member',
      plan_type: 'enterprise',
    },
  ],
};
