import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEnhancedCommand } from '../../../src/commands/meeting/enhanced.js';
import { mockMeetingWithNotes } from '../../fixtures/meetings.js';
import { captureConsole } from '../../setup.js';

vi.mock('../../../src/services/meetings.js', () => ({
  getEnhancedNotes: vi.fn(),
  resolveId: vi.fn(),
}));

vi.mock('../../../src/lib/pager.js', () => ({
  pipeToPager: vi.fn(),
}));

vi.mock('../../../src/lib/prosemirror.js', () => ({
  toMarkdown: vi.fn(() => 'Enhanced markdown content'),
}));

import { pipeToPager } from '../../../src/lib/pager.js';
import * as meetings from '../../../src/services/meetings.js';

describe('meeting enhanced command', () => {
  let console_: ReturnType<typeof captureConsole>;
  let originalIsTTY: boolean | undefined;
  let mockExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    console_ = captureConsole();
    originalIsTTY = process.stdout.isTTY;
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    console_.restore();
    (process.stdout as any).isTTY = originalIsTTY;
    mockExit.mockRestore();
  });

  it('should display enhanced notes', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(
      mockMeetingWithNotes.last_viewed_panel!.content,
    );

    try {
      (process.stdout as any).isTTY = false;

      const program = new Command();
      program.addCommand(createEnhancedCommand());
      await program.parseAsync(['node', 'test', 'enhanced', 'meeting-id']);

      expect(meetings.resolveId).toHaveBeenCalledWith('meeting-id');
      expect(meetings.getEnhancedNotes).toHaveBeenCalledWith('meeting-id');
      expect(console_.logs.some((log) => /Enhanced markdown/i.test(log))).toBe(true);
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should use pager for TTY output', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(
      mockMeetingWithNotes.last_viewed_panel!.content,
    );

    try {
      (process.stdout as any).isTTY = true;

      const program = new Command();
      program.addCommand(createEnhancedCommand());
      await program.parseAsync(['node', 'test', 'enhanced', 'meeting-id']);

      expect(pipeToPager).toHaveBeenCalled();
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should skip pager when not TTY', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(
      mockMeetingWithNotes.last_viewed_panel!.content,
    );

    try {
      (process.stdout as any).isTTY = false;

      const program = new Command();
      program.addCommand(createEnhancedCommand());
      await program.parseAsync(['node', 'test', 'enhanced', 'meeting-id']);

      expect(pipeToPager).not.toHaveBeenCalled();
      expect(console_.logs.length).toBeGreaterThan(0);
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should output JSON when --output json is set', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(
      mockMeetingWithNotes.last_viewed_panel!.content,
    );

    const program = new Command();
    program.addCommand(createEnhancedCommand());
    await program.parseAsync(['node', 'test', 'enhanced', 'meeting-id', '--output', 'json']);

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

  it('should output Toon when requested', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(
      mockMeetingWithNotes.last_viewed_panel!.content,
    );

    const program = new Command();
    program.addCommand(createEnhancedCommand());
    await program.parseAsync(['node', 'test', 'enhanced', 'meeting-id', '--output', 'toon']);

    expect(console_.logs.some((log) => log.includes('type'))).toBe(true);
  });

  it('should exit with code 4 when enhanced notes not found', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue(null);

    const program = new Command();
    program.addCommand(createEnhancedCommand());

    await expect(program.parseAsync(['node', 'test', 'enhanced', 'meeting-id'])).rejects.toThrow(
      'process.exit',
    );
    expect(mockExit).toHaveBeenCalledWith(4);
  });

  it('should handle network errors gracefully', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockRejectedValue(new Error('Network error'));

    const program = new Command();
    program.addCommand(createEnhancedCommand());

    await expect(program.parseAsync(['node', 'test', 'enhanced', 'meeting-id'])).rejects.toThrow(
      /process\.exit/i,
    );
    expect(console_.errors.some((log) => /failed to fetch enhanced notes/i.test(log))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit with code 4 when getEnhancedNotes returns null', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(null);

    const program = new Command();
    program.addCommand(createEnhancedCommand());

    await expect(program.parseAsync(['node', 'test', 'enhanced', 'meeting-id'])).rejects.toThrow(
      'process.exit',
    );

    expect(console_.errors.some((e) => /no enhanced notes found/i.test(e))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(4);
  });

  it('should reject invalid output formats', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getEnhancedNotes).mockResolvedValue(
      mockMeetingWithNotes.last_viewed_panel!.content,
    );

    const program = new Command();
    program.addCommand(createEnhancedCommand());

    await expect(
      program.parseAsync(['node', 'test', 'enhanced', 'meeting-id', '--output', 'invalid']),
    ).rejects.toThrow(/process\.exit/i);

    expect(console_.errors.some((log) => /invalid format/i.test(log))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
