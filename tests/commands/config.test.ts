import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfigCommand } from '../../src/commands/config.js';
import { captureConsole, mockProcessExit } from '../setup.js';

vi.mock('../../src/lib/config.js', () => ({
  getConfig: vi.fn(),
  getConfigValue: vi.fn(),
  setConfigValue: vi.fn(),
  resetConfig: vi.fn(),
}));

import * as config from '../../src/lib/config.js';

describe('config command', () => {
  let console_: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    vi.clearAllMocks();
    console_ = captureConsole();
  });

  afterEach(() => {
    console_.restore();
  });

  describe('config list', () => {
    it('should list config values', async () => {
      vi.mocked(config.getConfig).mockReturnValue({
        default_workspace: 'ws123',
        pager: 'less',
      } as any);

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'list']);

      expect(console_.logs.some((log) => /default_workspace/i.test(log))).toBe(true);
    });

    it('should show message when no config set', async () => {
      vi.mocked(config.getConfig).mockReturnValue({});

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'list']);

      expect(console_.logs.some((log) => /No configuration set/i.test(log))).toBe(true);
    });

    it('should output JSON when --output json is set', async () => {
      vi.mocked(config.getConfig).mockReturnValue({
        default_workspace: 'ws123',
      } as any);

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'list', '--output', 'json']);

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
      expect(parsed.default_workspace).toBe('ws123');
    });

    it('should reject invalid output formats', async () => {
      vi.mocked(config.getConfig).mockReturnValue({});
      const exit = mockProcessExit();

      const program = new Command();
      program.addCommand(createConfigCommand());

      await expect(
        program.parseAsync(['node', 'test', 'config', 'list', '--output', 'invalid']),
      ).rejects.toThrow(/process\.exit/i);

      expect(console_.errors.some((log) => /invalid format/i.test(log))).toBe(true);
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });

    it('should handle nested object config values', async () => {
      vi.mocked(config.getConfig).mockReturnValue({
        aliases: { meetings: 'meeting list' },
      } as any);

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'list']);

      expect(console_.logs.some((log) => /aliases/i.test(log))).toBe(true);
      expect(console_.logs.some((log) => /meetings/i.test(log))).toBe(true);
    });
  });

  describe('config get', () => {
    it('should get a config value', async () => {
      vi.mocked(config.getConfigValue).mockReturnValue('ws123' as any);

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'get', 'default_workspace']);

      expect(console_.logs.some((log) => /ws123/i.test(log))).toBe(true);
    });

    it('should show not set for undefined value', async () => {
      vi.mocked(config.getConfigValue).mockReturnValue(undefined as any);

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'get', 'nonexistent']);

      expect(console_.logs.some((log) => /not set/i.test(log))).toBe(true);
    });

    it('should output JSON when --output json is set', async () => {
      vi.mocked(config.getConfigValue).mockReturnValue('ws123' as any);

      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync([
        'node',
        'test',
        'config',
        'get',
        '--output',
        'json',
        'default_workspace',
      ]);

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
      expect(parsed.default_workspace).toBe('ws123');
    });

    it('should reject invalid output formats', async () => {
      vi.mocked(config.getConfigValue).mockReturnValue('ws123' as any);
      const exit = mockProcessExit();

      const program = new Command();
      program.addCommand(createConfigCommand());

      await expect(
        program.parseAsync([
          'node',
          'test',
          'config',
          'get',
          '--output',
          'invalid',
          'default_workspace',
        ]),
      ).rejects.toThrow(/process\.exit/i);

      expect(console_.errors.some((log) => /invalid format/i.test(log))).toBe(true);
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });
  });

  describe('config set', () => {
    it('should set a config value', async () => {
      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'set', 'pager', 'more']);

      expect(config.setConfigValue).toHaveBeenCalledWith('pager', 'more');
      expect(console_.logs.some((log) => /Set pager = more/i.test(log))).toBe(true);
    });

    it('should set aliases from JSON', async () => {
      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync([
        'node',
        'test',
        'config',
        'set',
        'aliases',
        '{"meet":"meeting list"}',
      ]);

      expect(config.setConfigValue).toHaveBeenCalledWith('aliases', { meet: 'meeting list' });
    });

    it('should reject invalid config keys', async () => {
      const exit = mockProcessExit();
      const program = new Command();
      program.addCommand(createConfigCommand());

      await expect(
        program.parseAsync(['node', 'test', 'config', 'set', 'unknown', 'value']),
      ).rejects.toThrow(/process\.exit/i);

      expect(console_.errors.some((log) => /invalid config key/i.test(log))).toBe(true);
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });

    it('should reject invalid alias JSON', async () => {
      const exit = mockProcessExit();
      const program = new Command();
      program.addCommand(createConfigCommand());

      await expect(
        program.parseAsync(['node', 'test', 'config', 'set', 'aliases', 'not-json']),
      ).rejects.toThrow(/process\.exit/i);

      expect(console_.errors.some((log) => /invalid value/i.test(log))).toBe(true);
      expect(exit.exitCodes).toContain(1);
      exit.restore();
    });
  });

  describe('config reset', () => {
    it('should reset config', async () => {
      const program = new Command();
      program.addCommand(createConfigCommand());
      await program.parseAsync(['node', 'test', 'config', 'reset']);

      expect(config.resetConfig).toHaveBeenCalled();
      expect(console_.logs.some((log) => /Configuration reset/i.test(log))).toBe(true);
    });
  });
});
