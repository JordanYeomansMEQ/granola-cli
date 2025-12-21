import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAliasCommand } from '../../src/commands/alias.js';
import { captureConsole, mockProcessExit } from '../setup.js';

vi.mock('../../src/lib/config.js', () => ({
  getAlias: vi.fn(),
  setAlias: vi.fn(),
  deleteAlias: vi.fn(),
  listAliases: vi.fn(),
}));

import * as config from '../../src/lib/config.js';

describe('alias command', () => {
  let console_: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    vi.clearAllMocks();
    console_ = captureConsole();
  });

  afterEach(() => {
    console_.restore();
  });

  describe('alias list', () => {
    it('should list aliases', async () => {
      vi.mocked(config.listAliases).mockReturnValue({
        meetings: 'meeting list',
        today: 'meeting list --limit 10',
      });

      const program = new Command();
      program.addCommand(createAliasCommand());
      await program.parseAsync(['node', 'test', 'alias', 'list']);

      expect(console_.logs.some((log) => /meetings/i.test(log))).toBe(true);
      expect(console_.logs.some((log) => /today/i.test(log))).toBe(true);
    });

    it('should show message when no aliases', async () => {
      vi.mocked(config.listAliases).mockReturnValue({});

      const program = new Command();
      program.addCommand(createAliasCommand());
      await program.parseAsync(['node', 'test', 'alias', 'list']);

      expect(console_.logs.some((log) => /no\s+aliases/i.test(log))).toBe(true);
    });

    it('should output JSON when --output json is set', async () => {
      vi.mocked(config.listAliases).mockReturnValue({
        meetings: 'meeting list',
      });

      const program = new Command();
      program.addCommand(createAliasCommand());
      await program.parseAsync(['node', 'test', 'alias', 'list', '--output', 'json']);

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
      expect(parsed.meetings).toBe('meeting list');
    });

    it('should reject invalid output formats', async () => {
      vi.mocked(config.listAliases).mockReturnValue({});
      const exit = mockProcessExit();

      const program = new Command();
      program.addCommand(createAliasCommand());

      await expect(
        program.parseAsync(['node', 'test', 'alias', 'list', '--output', 'invalid']),
      ).rejects.toThrow(/process\.exit/i);

      expect(console_.errors.some((log) => /invalid format/i.test(log))).toBe(true);
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });
  });

  describe('alias set', () => {
    it('should create alias', async () => {
      const program = new Command();
      program.addCommand(createAliasCommand());
      await program.parseAsync(['node', 'test', 'alias', 'set', 'meetings', 'meeting list']);

      expect(config.setAlias).toHaveBeenCalledWith('meetings', 'meeting list');
      expect(console_.logs.some((log) => /created.*alias/i.test(log))).toBe(true);
    });
  });

  describe('alias delete', () => {
    it('should delete existing alias', async () => {
      vi.mocked(config.getAlias).mockReturnValue('meeting list');

      const program = new Command();
      program.addCommand(createAliasCommand());
      await program.parseAsync(['node', 'test', 'alias', 'delete', 'meetings']);

      expect(config.deleteAlias).toHaveBeenCalledWith('meetings');
      expect(console_.logs.some((log) => /deleted.*alias/i.test(log))).toBe(true);
    });

    it('should show warning for non-existent alias', async () => {
      vi.mocked(config.getAlias).mockReturnValue(undefined);

      const program = new Command();
      program.addCommand(createAliasCommand());
      await program.parseAsync(['node', 'test', 'alias', 'delete', 'nonexistent']);

      expect(console_.logs.some((log) => /not\s+found/i.test(log))).toBe(true);
      expect(config.deleteAlias).not.toHaveBeenCalled();
    });
  });
});
