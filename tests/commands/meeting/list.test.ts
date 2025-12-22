import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createListCommand } from '../../../src/commands/meeting/list.js';
import { mockMeetings } from '../../fixtures/meetings.js';
import { captureConsole, mockProcessExit } from '../../setup.js';

vi.mock('../../../src/services/meetings.js', () => ({
  list: vi.fn(),
}));

vi.mock('../../../src/lib/config.js', () => ({
  getConfigValue: vi.fn(() => undefined),
}));

vi.mock('../../../src/lib/date-parser.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/date-parser.js')>();
  return {
    ...actual,
    validateDateOption: vi.fn((value: string, optionName: string) => {
      // Return a fixed date for known test inputs
      if (value === 'today') return new Date(2024, 11, 22, 0, 0, 0);
      if (value === 'yesterday') return new Date(2024, 11, 21, 0, 0, 0);
      if (value === 'last week') return new Date(2024, 11, 15, 0, 0, 0);
      if (value === '2024-12-20') return new Date(2024, 11, 20, 0, 0, 0);
      if (value === '2024-12-15') return new Date(2024, 11, 15, 0, 0, 0);
      if (value === 'invalid') throw new Error(`Invalid date for ${optionName}: "invalid"`);
      return actual.validateDateOption(value, optionName);
    }),
  };
});

import { getConfigValue } from '../../../src/lib/config.js';
import { validateDateOption } from '../../../src/lib/date-parser.js';
import * as meetings from '../../../src/services/meetings.js';

describe('meeting list command', () => {
  let console_: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfigValue).mockReturnValue(undefined as never);
    console_ = captureConsole();
  });

  afterEach(() => {
    console_.restore();
  });

  it('should list meetings with default options', async () => {
    vi.mocked(meetings.list).mockResolvedValue(mockMeetings);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list']);

    expect(meetings.list).toHaveBeenCalledWith({
      limit: 20,
      workspace: undefined,
      folder: undefined,
    });
    expect(
      console_.logs.some((log) => /Q4 Planning Session/i.test(log) || /3 meetings/i.test(log)),
    ).toBe(true);
  });

  it('should respect limit option', async () => {
    vi.mocked(meetings.list).mockResolvedValue(mockMeetings.slice(0, 1));

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list', '--limit', '1']);

    expect(meetings.list).toHaveBeenCalledWith({
      limit: 1,
      workspace: undefined,
      folder: undefined,
    });
  });

  it('should filter by workspace', async () => {
    vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list', '--workspace', 'abc12345']);

    expect(meetings.list).toHaveBeenCalledWith({
      limit: 20,
      workspace: 'abc12345',
      folder: undefined,
    });
  });

  it('should filter by folder', async () => {
    vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list', '--folder', 'folder123']);

    expect(meetings.list).toHaveBeenCalledWith({
      limit: 20,
      workspace: undefined,
      folder: 'folder123',
    });
  });

  it('should fall back to configured default workspace', async () => {
    vi.mocked(meetings.list).mockResolvedValue(mockMeetings);
    vi.mocked(getConfigValue).mockImplementation((key) => {
      if (key === 'default_workspace') {
        return 'cfg-workspace' as never;
      }
      return undefined as never;
    });

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list']);

    expect(meetings.list).toHaveBeenCalledWith({
      limit: 20,
      workspace: 'cfg-workspace',
      folder: undefined,
    });
  });

  it('should output JSON when --output json is set', async () => {
    vi.mocked(meetings.list).mockResolvedValue(mockMeetings);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list', '--output', 'json']);

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
    expect(parsed).toHaveLength(3);
  });

  it('should show message when no meetings found', async () => {
    vi.mocked(meetings.list).mockResolvedValue([]);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list']);

    expect(console_.logs.some((log) => /No meetings found/i.test(log))).toBe(true);
  });

  it('should exit when --limit is not a positive number', async () => {
    const exit = mockProcessExit();
    const program = new Command();
    program.addCommand(createListCommand());

    await expect(program.parseAsync(['node', 'test', 'list', '--limit', 'abc'])).rejects.toThrow(
      /process\.exit/i,
    );
    expect(console_.errors.some((log) => /invalid --limit/i.test(log))).toBe(true);
    expect(exit.exitCodes).toContain(1);
    exit.restore();
  });

  it('should show count of meetings', async () => {
    vi.mocked(meetings.list).mockResolvedValue(mockMeetings);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list']);

    expect(console_.logs.some((log) => /3/i.test(log))).toBe(true);
  });

  it('should show error for invalid output format', async () => {
    vi.mocked(meetings.list).mockResolvedValue(mockMeetings);
    const exit = mockProcessExit();

    const program = new Command();
    program.addCommand(createListCommand());

    try {
      await program.parseAsync(['node', 'test', 'list', '--output', 'invalid']);
    } catch {
      // process.exit throws
    }

    expect(console_.errors.some((e) => /invalid format/i.test(e))).toBe(true);
    expect(exit.exitCodes).toContain(1);
    exit.restore();
  });

  describe('filter options', () => {
    it('should filter by search query', async () => {
      vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

      const program = new Command();
      program.addCommand(createListCommand());
      await program.parseAsync(['node', 'test', 'list', '--search', 'standup']);

      expect(meetings.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'standup',
        }),
      );
    });

    it('should filter by attendee', async () => {
      vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

      const program = new Command();
      program.addCommand(createListCommand());
      await program.parseAsync(['node', 'test', 'list', '--attendee', 'john']);

      expect(meetings.list).toHaveBeenCalledWith(
        expect.objectContaining({
          attendee: 'john',
        }),
      );
    });

    it('should filter by date', async () => {
      vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

      const program = new Command();
      program.addCommand(createListCommand());
      await program.parseAsync(['node', 'test', 'list', '--date', 'today']);

      expect(validateDateOption).toHaveBeenCalledWith('today', '--date');
      expect(meetings.list).toHaveBeenCalledWith(
        expect.objectContaining({
          date: new Date(2024, 11, 22, 0, 0, 0),
        }),
      );
    });

    it('should filter by date range with --since and --until', async () => {
      vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

      const program = new Command();
      program.addCommand(createListCommand());
      await program.parseAsync([
        'node',
        'test',
        'list',
        '--since',
        '2024-12-15',
        '--until',
        '2024-12-20',
      ]);

      expect(meetings.list).toHaveBeenCalledWith(
        expect.objectContaining({
          since: new Date(2024, 11, 15, 0, 0, 0),
          until: new Date(2024, 11, 20, 0, 0, 0),
        }),
      );
    });

    it('should combine multiple filters', async () => {
      vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

      const program = new Command();
      program.addCommand(createListCommand());
      await program.parseAsync([
        'node',
        'test',
        'list',
        '--search',
        'standup',
        '--attendee',
        'john',
        '--since',
        'yesterday',
      ]);

      expect(meetings.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'standup',
          attendee: 'john',
          since: new Date(2024, 11, 21, 0, 0, 0),
        }),
      );
    });

    it('should show error for invalid date', async () => {
      const exit = mockProcessExit();

      const program = new Command();
      program.addCommand(createListCommand());

      try {
        await program.parseAsync(['node', 'test', 'list', '--date', 'invalid']);
      } catch {
        // process.exit throws
      }

      expect(console_.errors.some((e) => /Invalid date/i.test(e))).toBe(true);
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });

    it('should show error when --since is after --until', async () => {
      const exit = mockProcessExit();
      // Mock so that 'today' > 'yesterday' for range validation
      vi.mocked(validateDateOption).mockImplementation((value: string) => {
        if (value === 'today') return new Date(2024, 11, 22);
        if (value === 'yesterday') return new Date(2024, 11, 21);
        throw new Error('Unknown date');
      });

      const program = new Command();
      program.addCommand(createListCommand());

      try {
        await program.parseAsync([
          'node',
          'test',
          'list',
          '--since',
          'today',
          '--until',
          'yesterday',
        ]);
      } catch {
        // process.exit throws
      }

      expect(console_.errors.some((e) => /--since date must be before --until/i.test(e))).toBe(
        true,
      );
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });

    it('should work with workspace filter and search', async () => {
      vi.mocked(meetings.list).mockResolvedValue([mockMeetings[0]]);

      const program = new Command();
      program.addCommand(createListCommand());
      await program.parseAsync([
        'node',
        'test',
        'list',
        '--workspace',
        'ws123',
        '--search',
        'planning',
      ]);

      expect(meetings.list).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: 'ws123',
          search: 'planning',
        }),
      );
    });
  });
});
