import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createListCommand } from '../../../src/commands/workspace/list.js';
import { mockWorkspaces } from '../../fixtures/workspaces.js';
import { captureConsole, mockProcessExit } from '../../setup.js';

vi.mock('../../../src/services/workspaces.js', () => ({
  list: vi.fn(),
}));

import * as workspaces from '../../../src/services/workspaces.js';

describe('workspace list command', () => {
  let console_: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    vi.clearAllMocks();
    console_ = captureConsole();
  });

  afterEach(() => {
    console_.restore();
  });

  it('should list workspaces', async () => {
    vi.mocked(workspaces.list).mockResolvedValue(mockWorkspaces);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list']);

    expect(workspaces.list).toHaveBeenCalled();
    expect(console_.logs.some((log) => /product team/i.test(log))).toBe(true);
  });

  it('should output JSON when --output json is set', async () => {
    vi.mocked(workspaces.list).mockResolvedValue(mockWorkspaces);

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
  });

  it('should show message when no workspaces found', async () => {
    vi.mocked(workspaces.list).mockResolvedValue([]);

    const program = new Command();
    program.addCommand(createListCommand());
    await program.parseAsync(['node', 'test', 'list']);

    expect(console_.logs.some((log) => /no workspaces found/i.test(log))).toBe(true);
  });

  it('should show error for invalid output format', async () => {
    vi.mocked(workspaces.list).mockResolvedValue(mockWorkspaces);
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
});
