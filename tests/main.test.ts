import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main.ts security', () => {
  const mainContent = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf-8');

  it('should not contain external subcommand discovery code', () => {
    expect(mainContent).not.toContain('discoverExternalSubcommands');
    expect(mainContent).not.toContain('externalSubcommands');
  });

  it('should not use shell execution', () => {
    expect(mainContent).not.toContain('shell: true');
    expect(mainContent).not.toContain("shell: process.platform === 'win32'");
  });

  it('should not spawn child processes', () => {
    expect(mainContent).not.toContain('spawn(');
    expect(mainContent).not.toContain("from 'node:child_process'");
  });

  it('should not scan PATH for external commands', () => {
    expect(mainContent).not.toContain('granola-*');
    expect(mainContent).not.toContain('process.env.PATH');
  });
});
