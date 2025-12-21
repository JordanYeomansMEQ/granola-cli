import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogoutCommand } from '../../../src/commands/auth/logout.js';
import { captureConsole } from '../../setup.js';

vi.mock('../../../src/lib/auth.js', () => ({
  deleteCredentials: vi.fn(),
}));

import * as auth from '../../../src/lib/auth.js';

describe('auth logout command', () => {
  let console_: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    vi.clearAllMocks();
    console_ = captureConsole();
  });

  afterEach(() => {
    console_.restore();
  });

  it('should delete credentials and confirm logout', async () => {
    const program = new Command();
    program.addCommand(createLogoutCommand());
    await program.parseAsync(['node', 'test', 'logout']);

    expect(auth.deleteCredentials).toHaveBeenCalled();
    expect(console_.logs.some((log) => /Logged out/i.test(log))).toBe(true);
  });

  it('should handle keychain errors gracefully', async () => {
    vi.mocked(auth.deleteCredentials).mockRejectedValue(new Error('Keychain access denied'));

    const program = new Command();
    program.addCommand(createLogoutCommand());

    await expect(program.parseAsync(['node', 'test', 'logout'])).rejects.toThrow();
    expect(console_.errors.some((log) => /error|failed/i.test(log))).toBe(true);
  });

  it('should still report success even if no credentials exist', async () => {
    vi.mocked(auth.deleteCredentials).mockResolvedValue(undefined);

    const program = new Command();
    program.addCommand(createLogoutCommand());
    await program.parseAsync(['node', 'test', 'logout']);

    expect(console_.logs.some((log) => /Logged out/i.test(log))).toBe(true);
  });
});
