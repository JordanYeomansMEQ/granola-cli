import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the client module
vi.mock('../../src/services/client.js', () => ({
  getClient: vi.fn(),
  withTokenRefresh: vi.fn((fn) => fn()),
}));

import { getClient } from '../../src/services/client.js';
import {
  get,
  getEnhancedNotes,
  getNotes,
  getTranscript,
  list,
  resolveId,
} from '../../src/services/meetings.js';
import {
  mockMeetings,
  mockMeetingWithNotes,
  mockPeople,
  mockPerson,
  mockTranscript,
} from '../fixtures/meetings.js';

describe('meetings service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveId', () => {
    it('should resolve to a unique meeting id', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({
          docs: [
            { id: 'abc123', title: 'Meeting A', created_at: '', updated_at: '' },
            { id: 'def456', title: 'Meeting B', created_at: '', updated_at: '' },
          ],
        }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await resolveId('abc');

      expect(result).toBe('abc123');
    });

    it('should return null when no matching meeting exists', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({ docs: [] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await resolveId('missing');

      expect(result).toBeNull();
    });

    it('should throw when multiple meetings match', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({
          docs: [
            { id: 'abc123', title: 'Meeting A', created_at: '', updated_at: '' },
            { id: 'abc999', title: 'Meeting B', created_at: '', updated_at: '' },
          ],
        }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      await expect(resolveId('abc')).rejects.toThrow(/ambiguous/i);
    });

    it('should paginate when meeting is outside the first 100 results', async () => {
      const firstPage = Array.from({ length: 100 }, (_, idx) => ({
        id: `other-${idx}`,
        title: `Meeting ${idx}`,
        created_at: '',
        updated_at: '',
      }));
      const secondPage = [
        { id: 'abc555', title: 'Target Meeting', created_at: '', updated_at: '' },
      ];
      const mockClient = {
        getDocuments: vi.fn().mockImplementation(async ({ offset }: { offset: number }) => {
          if (offset === 0) {
            return { docs: firstPage };
          }
          if (offset === 100) {
            return { docs: secondPage };
          }
          return { docs: [] };
        }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await resolveId('abc');

      expect(result).toBe('abc555');
      expect(mockClient.getDocuments).toHaveBeenCalledWith({
        limit: 100,
        offset: 0,
        include_last_viewed_panel: false,
      });
      expect(mockClient.getDocuments).toHaveBeenCalledWith({
        limit: 100,
        offset: 100,
        include_last_viewed_panel: false,
      });
    });
  });

  describe('list', () => {
    it('should list meetings with default options', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({ docs: mockMeetings }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toEqual(mockMeetings);
    });

    it('should list meetings with custom limit', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({ docs: mockMeetings.slice(0, 1) }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ limit: 1 });

      expect(result).toHaveLength(1);
    });

    it('should filter by workspace', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({ docs: mockMeetings }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ workspace: 'abc12345' });

      expect(result).toHaveLength(1);
      expect(result[0].workspace_id).toBe('abc12345');
    });

    it('should handle empty response', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue({ docs: [] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toEqual([]);
    });

    it('should handle undefined response', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list();

      expect(result).toEqual([]);
    });

    it('should paginate folder meetings after workspace filtering', async () => {
      const folderMeetings = [
        {
          id: 'folder-1',
          title: 'Folder Meeting 1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          workspace_id: 'ws-1',
        },
        {
          id: 'folder-2',
          title: 'Folder Meeting 2',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
          workspace_id: 'ws-2',
        },
        {
          id: 'folder-3',
          title: 'Folder Meeting 3',
          created_at: '2024-01-03',
          updated_at: '2024-01-03',
          workspace_id: 'ws-1',
        },
        {
          id: 'folder-4',
          title: 'Folder Meeting 4',
          created_at: '2024-01-04',
          updated_at: '2024-01-04',
          workspace_id: 'ws-1',
        },
      ];
      const meetingLookup = new Map(folderMeetings.map((m) => [m.id, m]));
      const mockClient = {
        getDocumentList: vi.fn().mockResolvedValue({
          document_ids: folderMeetings.map((m) => m.id),
        }),
        getDocumentsBatch: vi.fn().mockImplementation(async ({ document_ids }) => ({
          documents: document_ids.map((id: string) => meetingLookup.get(id)),
        })),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ folder: 'folder-id', workspace: 'ws-1', limit: 3 });

      expect(mockClient.getDocumentList).toHaveBeenCalledWith('folder-id');
      expect(result).toHaveLength(3);
      expect(result.map((m) => m.id)).toEqual(['folder-1', 'folder-3', 'folder-4']);
    });

    it('should apply offset after filtering folder results', async () => {
      const folderMeetings = [
        {
          id: 'folder-1',
          title: 'Folder Meeting 1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          workspace_id: 'ws-1',
        },
        {
          id: 'folder-2',
          title: 'Folder Meeting 2',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
          workspace_id: 'ws-2',
        },
        {
          id: 'folder-3',
          title: 'Folder Meeting 3',
          created_at: '2024-01-03',
          updated_at: '2024-01-03',
          workspace_id: 'ws-1',
        },
        {
          id: 'folder-4',
          title: 'Folder Meeting 4',
          created_at: '2024-01-04',
          updated_at: '2024-01-04',
          workspace_id: 'ws-1',
        },
      ];
      const meetingLookup = new Map(folderMeetings.map((m) => [m.id, m]));
      const mockClient = {
        getDocumentList: vi.fn().mockResolvedValue({
          document_ids: folderMeetings.map((m) => m.id),
        }),
        getDocumentsBatch: vi.fn().mockImplementation(async ({ document_ids }) => ({
          documents: document_ids.map((id: string) => meetingLookup.get(id)),
        })),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ folder: 'folder-id', workspace: 'ws-1', offset: 1, limit: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('folder-3');
    });

    it('should paginate folder meetings without workspace filter', async () => {
      const folderMeetings = [
        {
          id: 'folder-1',
          title: 'Folder Meeting 1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          workspace_id: 'ws-1',
        },
        {
          id: 'folder-2',
          title: 'Folder Meeting 2',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
          workspace_id: 'ws-2',
        },
        {
          id: 'folder-3',
          title: 'Folder Meeting 3',
          created_at: '2024-01-03',
          updated_at: '2024-01-03',
          workspace_id: 'ws-1',
        },
      ];
      const meetingLookup = new Map(folderMeetings.map((m) => [m.id, m]));
      const mockClient = {
        getDocumentList: vi.fn().mockResolvedValue({
          document_ids: folderMeetings.map((m) => m.id),
        }),
        getDocumentsBatch: vi.fn().mockImplementation(async ({ document_ids }) => ({
          documents: document_ids.map((id: string) => meetingLookup.get(id)),
        })),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ folder: 'folder-id', offset: 1, limit: 2 });

      expect(result.map((m) => m.id)).toEqual(['folder-2', 'folder-3']);
    });

    it('should fetch folder meetings using getDocumentList and getDocumentsBatch', async () => {
      const folderMeetings = [
        {
          id: 'folder-1',
          title: 'Folder Meeting 1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          workspace_id: 'ws-1',
        },
        {
          id: 'folder-2',
          title: 'Folder Meeting 2',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
          workspace_id: 'ws-2',
        },
      ];
      const meetingLookup = new Map(folderMeetings.map((m) => [m.id, m]));
      const mockClient = {
        getDocumentList: vi.fn().mockResolvedValue({
          id: 'folder-id',
          documents: folderMeetings.map((m) => ({ id: m.id })),
        }),
        getDocumentsBatch: vi.fn().mockImplementation(async ({ document_ids }) => ({
          documents: document_ids.map((id: string) => meetingLookup.get(id)),
        })),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ folder: 'folder-id', limit: 2 });

      expect(mockClient.getDocumentList).toHaveBeenCalledWith('folder-id');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when folder is not found', async () => {
      const mockClient = {
        getDocumentList: vi.fn().mockResolvedValue(null),
        getDocumentsBatch: vi.fn(),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ folder: 'nonexistent' });

      expect(result).toEqual([]);
      expect(mockClient.getDocumentsBatch).not.toHaveBeenCalled();
    });

    it('should return empty array when folder has no documents', async () => {
      const mockClient = {
        getDocumentList: vi.fn().mockResolvedValue({
          id: 'empty-folder',
          documents: [],
        }),
        getDocumentsBatch: vi.fn(),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await list({ folder: 'empty-folder' });

      expect(result).toEqual([]);
      expect(mockClient.getDocumentsBatch).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should get a single meeting by id using getDocumentMetadata', async () => {
      const meetingId = 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6';
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(mockMeetings[0]),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get(meetingId);

      // get() adds the id from the parameter to the response
      expect(result).toMatchObject({
        id: meetingId,
        title: mockMeetings[0].title,
      });
    });

    it('should return null when meeting not found', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get('error-id');

      expect(result).toBeNull();
    });

    it('should return meeting with people data when available', async () => {
      const meetingId = mockMeetings[0].id;
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue({
          ...mockMeetings[0],
          people: mockPeople,
        }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get(meetingId);

      expect(result?.people).toBeDefined();
      expect(result?.people?.creator).toMatchObject({ name: 'John Doe' });
      expect(result?.people?.attendees).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Jane Smith' })]),
      );
    });

    it('should return meeting with undefined people when not available', async () => {
      const meetingId = 'meeting-without-people';
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(mockMeetings[0]),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get(meetingId);

      expect(result?.people).toBeUndefined();
    });

    it('should handle partial people data (creator only)', async () => {
      const meetingId = 'meeting-creator-only';
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue({
          ...mockMeetings[0],
          people: { creator: mockPerson },
        }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get(meetingId);

      expect(result?.people?.creator).toBeDefined();
      expect(result?.people?.creator?.name).toBe('John Doe');
      expect(result?.people?.attendees).toBeUndefined();
    });

    it('should handle partial people data (attendees only)', async () => {
      const meetingId = 'meeting-attendees-only';
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue({
          ...mockMeetings[0],
          people: { attendees: mockPeople.attendees },
        }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await get(meetingId);

      expect(result?.people?.creator).toBeUndefined();
      expect(result?.people?.attendees).toHaveLength(2);
    });
  });

  describe('getTranscript', () => {
    it('should get meeting transcript', async () => {
      const mockClient = {
        getDocumentTranscript: vi.fn().mockResolvedValue(mockTranscript),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getTranscript('meeting-id');

      expect(result).toEqual(mockTranscript);
    });

    it('should return empty array on error', async () => {
      const mockClient = {
        getDocumentTranscript: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getTranscript('meeting-id');

      expect(result).toEqual([]);
    });
  });

  describe('getNotes', () => {
    it('should get manual notes from metadata', async () => {
      const meetingWithNotes = {
        id: 'meeting-id',
        notes: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Manual note' }] }],
        },
      };
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(meetingWithNotes),
        getDocuments: vi.fn(),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getNotes('meeting-id');

      expect(result).toEqual(meetingWithNotes.notes);
      expect(mockClient.getDocumentMetadata).toHaveBeenCalledWith('meeting-id');
      expect(mockClient.getDocuments).not.toHaveBeenCalled();
    });

    it('should return null when metadata has no notes', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue({ id: 'meeting-id', notes: null }),
        getDocuments: vi.fn(),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getNotes('meeting-id');

      expect(result).toBeNull();
      expect(mockClient.getDocuments).not.toHaveBeenCalled();
    });

    it('should fallback to document search when metadata unavailable', async () => {
      const meetingWithNotes = {
        id: 'meeting-id',
        notes: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Manual note' }] }],
        },
      };
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi.fn().mockResolvedValue({ docs: [meetingWithNotes] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getNotes('meeting-id');

      expect(result).toEqual(meetingWithNotes.notes);
      expect(mockClient.getDocuments).toHaveBeenCalled();
    });

    it('should return null when meeting not found via fallback', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi.fn().mockResolvedValue({ docs: [] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getNotes('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi.fn().mockRejectedValue(new Error('Server error')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getNotes('error-id');

      expect(result).toBeNull();
    });

    it('should find meeting notes on a later page', async () => {
      const targetMeeting = {
        id: 'target-meeting-id',
        notes: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Found on page 2' }] }],
        },
      };
      const otherMeeting = { id: 'other-meeting', title: 'Other Meeting' };

      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi
          .fn()
          .mockResolvedValueOnce({ docs: [otherMeeting] })
          .mockResolvedValueOnce({ docs: [targetMeeting] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getNotes('target-meeting-id');

      expect(result).toEqual(targetMeeting.notes);
    });
  });

  describe('getEnhancedNotes', () => {
    it('should get enhanced notes from metadata', async () => {
      const meetingWithEnhanced = {
        ...mockMeetingWithNotes,
        id: 'meeting-id',
      };
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(meetingWithEnhanced),
        getDocuments: vi.fn(),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getEnhancedNotes('meeting-id');

      expect(result).toEqual(mockMeetingWithNotes.last_viewed_panel?.content);
      expect(mockClient.getDocuments).not.toHaveBeenCalled();
    });

    it('should return null when metadata has no enhanced notes', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue({ id: 'meeting-id' }),
        getDocuments: vi.fn(),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getEnhancedNotes('meeting-id');

      expect(result).toBeNull();
    });

    it('should fallback to document search when metadata unavailable', async () => {
      const meetingWithEnhanced = {
        ...mockMeetingWithNotes,
        id: 'meeting-id',
      };
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi.fn().mockResolvedValue({ docs: [meetingWithEnhanced] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getEnhancedNotes('meeting-id');

      expect(result).toEqual(mockMeetingWithNotes.last_viewed_panel?.content);
    });

    it('should return null when meeting not found', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi.fn().mockResolvedValue({ docs: [] }),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getEnhancedNotes('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockClient = {
        getDocumentMetadata: vi.fn().mockResolvedValue(null),
        getDocuments: vi.fn().mockRejectedValue(new Error('Server error')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      const result = await getEnhancedNotes('error-id');

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw when list() encounters network error', async () => {
      const mockClient = {
        getDocuments: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(getClient).mockResolvedValue(mockClient as never);

      await expect(list()).rejects.toThrow(/network/i);
    });

    it('should throw when client authentication fails', async () => {
      vi.mocked(getClient).mockRejectedValue(new Error('Not authenticated'));

      await expect(list()).rejects.toThrow(/authenticated/i);
    });
  });
});
