import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewCommand } from '../../../src/commands/workspace/view.js';
import { mockWorkspace } from '../../fixtures/workspaces.js';
import { captureConsole } from '../../setup.js';

vi.mock('../../../src/services/workspaces.js', () => ({
  get: vi.fn(),
  resolveId: vi.fn(),
}));

import * as workspaces from '../../../src/services/workspaces.js';

describe('workspace view command', () => {
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

  it('should view workspace details', async () => {
    vi.mocked(workspaces.resolveId).mockResolvedValue('ws-id-full');
    vi.mocked(workspaces.get).mockResolvedValue(mockWorkspace);

    const program = new Command();
    program.addCommand(createViewCommand());
    await program.parseAsync(['node', 'test', 'view', 'ws-id']);

    expect(workspaces.resolveId).toHaveBeenCalledWith('ws-id');
    expect(workspaces.get).toHaveBeenCalledWith('ws-id-full');
    expect(console_.logs.some((log) => /product team/i.test(log))).toBe(true);
  });

  it('should output JSON when --output json is set', async () => {
    vi.mocked(workspaces.resolveId).mockResolvedValue('ws-id-full');
    vi.mocked(workspaces.get).mockResolvedValue(mockWorkspace);

    const program = new Command();
    program.addCommand(createViewCommand());
    await program.parseAsync(['node', 'test', 'view', 'ws-id', '--output', 'json']);

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

  it('should exit with code 4 when workspace not found', async () => {
    vi.mocked(workspaces.resolveId).mockResolvedValue(null);

    const program = new Command();
    program.addCommand(createViewCommand());

    await expect(program.parseAsync(['node', 'test', 'view', 'nonexistent'])).rejects.toThrow(
      'process.exit',
    );
    expect(mockExit).toHaveBeenCalledWith(4);
  });

  it('should show error for invalid output format', async () => {
    vi.mocked(workspaces.resolveId).mockResolvedValue('ws-id-full');
    vi.mocked(workspaces.get).mockResolvedValue(mockWorkspace);

    const program = new Command();
    program.addCommand(createViewCommand());

    await expect(
      program.parseAsync(['node', 'test', 'view', 'ws-id', '--output', 'invalid']),
    ).rejects.toThrow('process.exit');

    expect(console_.errors.some((e) => /invalid format/i.test(e))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
