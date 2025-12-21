import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranscriptCommand } from '../../../src/commands/meeting/transcript.js';
import { mockTranscript } from '../../fixtures/meetings.js';
import { captureConsole } from '../../setup.js';

vi.mock('../../../src/services/meetings.js', () => ({
  getTranscript: vi.fn(),
  resolveId: vi.fn(),
}));

vi.mock('../../../src/lib/pager.js', () => ({
  pipeToPager: vi.fn(),
}));

vi.mock('../../../src/lib/transcript.js', () => ({
  formatTranscript: vi.fn(() => 'Formatted transcript'),
}));

import { pipeToPager } from '../../../src/lib/pager.js';
import { formatTranscript } from '../../../src/lib/transcript.js';
import * as meetings from '../../../src/services/meetings.js';

describe('meeting transcript command', () => {
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

  it('should display transcript', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    try {
      (process.stdout as any).isTTY = false;

      const program = new Command();
      program.addCommand(createTranscriptCommand());
      await program.parseAsync(['node', 'test', 'transcript', 'meeting-id']);

      expect(meetings.resolveId).toHaveBeenCalledWith('meeting-id');
      expect(meetings.getTranscript).toHaveBeenCalledWith('meeting-id');
      expect(formatTranscript).toHaveBeenCalledWith(mockTranscript, {
        timestamps: undefined,
        source: 'all',
      });
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should use pager for TTY output', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    try {
      (process.stdout as any).isTTY = true;

      const program = new Command();
      program.addCommand(createTranscriptCommand());
      await program.parseAsync(['node', 'test', 'transcript', 'meeting-id']);

      expect(pipeToPager).toHaveBeenCalled();
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should pass timestamps option', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    try {
      (process.stdout as any).isTTY = false;

      const program = new Command();
      program.addCommand(createTranscriptCommand());
      await program.parseAsync(['node', 'test', 'transcript', '-t', 'meeting-id']);

      expect(formatTranscript).toHaveBeenCalledWith(mockTranscript, {
        timestamps: true,
        source: 'all',
      });
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should pass source filter option', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    try {
      (process.stdout as any).isTTY = false;

      const program = new Command();
      program.addCommand(createTranscriptCommand());
      await program.parseAsync(['node', 'test', 'transcript', '-s', 'microphone', 'meeting-id']);

      expect(formatTranscript).toHaveBeenCalledWith(mockTranscript, {
        timestamps: undefined,
        source: 'microphone',
      });
    } finally {
      (process.stdout as any).isTTY = originalIsTTY;
    }
  });

  it('should reject invalid source filter option', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    const program = new Command();
    program.addCommand(createTranscriptCommand());

    await expect(
      program.parseAsync(['node', 'test', 'transcript', '-s', 'invalid', 'meeting-id']),
    ).rejects.toThrow('process.exit');

    expect(console_.errors.some((log) => /invalid source/i.test(log))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should output JSON when --output json is set', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    const program = new Command();
    program.addCommand(createTranscriptCommand());
    await program.parseAsync(['node', 'test', 'transcript', 'meeting-id', '--output', 'json']);

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

  it('should output YAML when --output yaml is set', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    const program = new Command();
    program.addCommand(createTranscriptCommand());
    await program.parseAsync(['node', 'test', 'transcript', 'meeting-id', '--output', 'yaml']);

    expect(console_.logs.some((log) => /source:/i.test(log))).toBe(true);
  });

  it('should reject invalid output formats', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue(mockTranscript);

    const program = new Command();
    program.addCommand(createTranscriptCommand());

    await expect(
      program.parseAsync(['node', 'test', 'transcript', 'meeting-id', '--output', 'invalid']),
    ).rejects.toThrow(/process\.exit/i);

    expect(console_.errors.some((log) => /invalid format/i.test(log))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit with code 4 when transcript not found', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue(null);

    const program = new Command();
    program.addCommand(createTranscriptCommand());

    await expect(program.parseAsync(['node', 'test', 'transcript', 'meeting-id'])).rejects.toThrow(
      'process.exit',
    );
    expect(mockExit).toHaveBeenCalledWith(4);
  });

  it('should exit with code 4 when transcript is empty', async () => {
    vi.mocked(meetings.resolveId).mockResolvedValue('meeting-id');
    vi.mocked(meetings.getTranscript).mockResolvedValue([]);

    const program = new Command();
    program.addCommand(createTranscriptCommand());

    await expect(program.parseAsync(['node', 'test', 'transcript', 'meeting-id'])).rejects.toThrow(
      'process.exit',
    );

    expect(console_.errors.some((e) => /no transcript found/i.test(e))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(4);
  });
});
