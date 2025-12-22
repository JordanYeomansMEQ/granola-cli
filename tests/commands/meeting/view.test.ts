import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewCommand } from '../../../src/commands/meeting/view.js';
import { mockMeetings, mockMeetingWithPeople } from '../../fixtures/meetings.js';
import { captureConsole } from '../../setup.js';

vi.mock('../../../src/services/meetings.js', () => ({
  get: vi.fn(),
  resolveId: vi.fn(),
}));

vi.mock('open', () => ({
  default: vi.fn(),
}));

import open from 'open';
import * as meetings from '../../../src/services/meetings.js';

describe('meeting view command', () => {
  let console_: ReturnType<typeof captureConsole>;
  let mockExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    console_ = captureConsole();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    console_.restore();
    mockExit.mockRestore();
  });

  it('should view meeting details', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.get).mockResolvedValue(mockMeetings[0]);

    const program = new Command();
    program.addCommand(createViewCommand());
    await program.parseAsync(['node', 'test', 'view', 'meeting-id']);

    expect(meetings.resolveId).toHaveBeenCalledWith('meeting-id');
    expect(meetings.get).toHaveBeenCalledWith('meeting-id');
    expect(console_.logs.some((log) => /Q4 Planning Session/i.test(log))).toBe(true);
  });

  it('should open in browser with --web flag', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');

    const program = new Command();
    program.addCommand(createViewCommand());
    await program.parseAsync(['node', 'test', 'view', '--web', 'meeting-id']);

    expect(open).toHaveBeenCalledWith('https://notes.granola.ai/d/meeting-id');
  });

  it('should output JSON when --output json is set', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.get).mockResolvedValue(mockMeetings[0]);

    const program = new Command();
    program.addCommand(createViewCommand());
    await program.parseAsync(['node', 'test', 'view', 'meeting-id', '--output', 'json']);

    const jsonOutput = console_.logs.find((log) => {
      try {
        JSON.parse(log);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonOutput).toBeDefined();
  });

  it('should exit with code 4 when meeting not found', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue(null);

    const program = new Command();
    program.addCommand(createViewCommand());

    await expect(program.parseAsync(['node', 'test', 'view', 'nonexistent'])).rejects.toThrow(
      'process.exit',
    );
    expect(mockExit).toHaveBeenCalledWith(4);
  });

  it('should show Personal for meetings without workspace', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.get).mockResolvedValue({
      ...mockMeetings[0],
      workspace_id: undefined,
    });

    const program = new Command();
    program.addCommand(createViewCommand());
    await program.parseAsync(['node', 'test', 'view', 'meeting-id']);

    expect(console_.logs.some((log) => /Personal/i.test(log))).toBe(true);
  });

  describe('participant display', () => {
    it('should display organizer name', async () => {
      vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
      vi.mocked(meetings.get).mockResolvedValue(mockMeetingWithPeople);

      const program = new Command();
      program.addCommand(createViewCommand());
      await program.parseAsync(['node', 'test', 'view', 'meeting-id']);

      expect(console_.logs.some((log) => /John Doe/i.test(log))).toBe(true);
    });

    it('should display attendee count and list', async () => {
      vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
      vi.mocked(meetings.get).mockResolvedValue(mockMeetingWithPeople);

      const program = new Command();
      program.addCommand(createViewCommand());
      await program.parseAsync(['node', 'test', 'view', 'meeting-id']);

      expect(console_.logs.some((log) => /2 participant/i.test(log))).toBe(true);
      expect(console_.logs.some((log) => /Jane Smith/i.test(log))).toBe(true);
      expect(console_.logs.some((log) => /Bob Wilson/i.test(log))).toBe(true);
    });

    it('should handle meetings without participants gracefully', async () => {
      vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
      vi.mocked(meetings.get).mockResolvedValue(mockMeetings[0]);

      const program = new Command();
      program.addCommand(createViewCommand());
      await program.parseAsync(['node', 'test', 'view', 'meeting-id']);

      expect(console_.logs.length).toBeGreaterThan(0);
      expect(console_.logs.some((log) => /Q4 Planning Session/i.test(log))).toBe(true);
    });

    it('should include people in JSON output', async () => {
      vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
      vi.mocked(meetings.get).mockResolvedValue(mockMeetingWithPeople);

      const program = new Command();
      program.addCommand(createViewCommand());
      await program.parseAsync(['node', 'test', 'view', 'meeting-id', '--output', 'json']);

      const jsonOutput = console_.logs.find((log) => {
        try {
          JSON.parse(log);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.people).toBeDefined();
      expect(parsed.people.creator.name).toBe('John Doe');
      expect(parsed.people.attendees).toHaveLength(2);
    });
  });

  it('should show error for invalid output format', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.get).mockResolvedValue(mockMeetings[0]);

    const program = new Command();
    program.addCommand(createViewCommand());

    await expect(
      program.parseAsync(['node', 'test', 'view', 'meeting-id', '--output', 'invalid']),
    ).rejects.toThrow('process.exit');

    expect(console_.errors.some((e) => /invalid format/i.test(e))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
