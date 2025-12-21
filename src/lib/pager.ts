import { spawn } from 'node:child_process';
import { getConfigValue } from './config.js';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:pager');

const ALLOWED_PAGERS = ['less', 'more', 'cat', 'head', 'tail', 'bat', 'most'];
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>\\!#*?]/;

export function validatePagerCommand(cmd: string): boolean {
  debug('validating pager command: %s', cmd);
  if (SHELL_METACHARACTERS.test(cmd)) {
    debug('pager validation failed: contains shell metacharacters');
    return false;
  }
  const [binary] = cmd.split(' ');
  const binaryName = binary.split('/').pop() || '';
  const valid = ALLOWED_PAGERS.includes(binaryName);
  debug('pager validation: %s (binary: %s)', valid ? 'passed' : 'failed', binaryName);
  return valid;
}

export function getPagerCommand(): string {
  if (process.env.GRANOLA_PAGER) {
    debug('pager command: %s (source: GRANOLA_PAGER)', process.env.GRANOLA_PAGER);
    return process.env.GRANOLA_PAGER;
  }
  if (process.env.PAGER) {
    debug('pager command: %s (source: PAGER)', process.env.PAGER);
    return process.env.PAGER;
  }
  const configuredPager = getConfigValue('pager');
  if (configuredPager) {
    debug('pager command: %s (source: config)', configuredPager);
    return configuredPager;
  }
  debug('pager command: less -R (source: default)');
  return 'less -R';
}

export async function pipeToPager(content: string): Promise<void> {
  debug('pipeToPager: isTTY=%s, contentLength=%d', process.stdout.isTTY, content.length);
  if (!process.stdout.isTTY) {
    debug('not a TTY, writing directly to stdout');
    process.stdout.write(`${content}\n`);
    return;
  }

  const pagerCmd = getPagerCommand();

  if (!validatePagerCommand(pagerCmd)) {
    console.error(`Warning: Invalid pager command "${pagerCmd}". Falling back to direct output.`);
    process.stdout.write(`${content}\n`);
    return;
  }

  const [cmd, ...args] = pagerCmd.split(' ');
  debug('spawning pager: %s with args: %O', cmd, args);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const fallbackToStdout = (reason: string) => {
      if (settled) return;
      settled = true;
      debug('falling back to stdout: %s', reason);
      console.error(
        `Warning: Unable to launch pager "${pagerCmd}" (${reason}). Falling back to direct output.`,
      );
      process.stdout.write(`${content}\n`);
      resolve();
    };

    try {
      const pager = spawn(cmd, args, {
        stdio: ['pipe', 'inherit', 'inherit'],
      });

      pager.stdin.write(content);
      pager.stdin.end();

      pager.on('close', () => {
        debug('pager closed');
        finish();
      });

      pager.on('error', (err) => {
        debug('pager error: %O', err);
        fallbackToStdout((err as Error).message);
      });
    } catch (err) {
      debug('failed to spawn pager: %O', err);
      fallbackToStdout((err as Error).message);
    }
  });
}
