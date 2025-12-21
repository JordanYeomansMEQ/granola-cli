import Conf from 'conf';
import type { Config } from '../types.js';
import { isAliasCommandSafe } from './alias.js';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:config');

const config = new Conf<Config>({
  projectName: 'granola',
  defaults: {},
});

debug('config store initialized at: %s', config.path);

export function getConfig(): Config {
  debug('getConfig: returning store');
  return config.store;
}

export function setConfig(newConfig: Config): void {
  debug('setConfig: clearing and setting %d keys', Object.keys(newConfig).length);
  config.clear();
  for (const [key, value] of Object.entries(newConfig)) {
    config.set(key, value);
  }
}

export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
  const value = config.get(key);
  debug('getConfigValue: %s = %O', key, value);
  return value;
}

export function setConfigValue<K extends keyof Config>(key: K, value: Config[K]): void {
  debug('setConfigValue: %s = %O', key, value);
  config.set(key, value);
}

export function resetConfig(): void {
  debug('resetConfig: clearing all configuration');
  config.clear();
}

export function getAlias(name: string): string | undefined {
  const aliases = config.get('aliases') || {};
  const alias = aliases[name];
  debug('getAlias: %s -> %s', name, alias || '(not found)');
  return alias;
}

export function validateAliasCommand(command: string): boolean {
  return isAliasCommandSafe(command);
}

export function setAlias(name: string, command: string): void {
  debug('setAlias: %s -> %s', name, command);
  if (!validateAliasCommand(command)) {
    debug('setAlias: invalid command characters');
    throw new Error(
      'Alias command contains invalid characters or shell syntax. Only literal arguments are allowed.',
    );
  }
  const aliases = config.get('aliases') || {};
  aliases[name] = command;
  config.set('aliases', aliases);
}

export function deleteAlias(name: string): void {
  debug('deleteAlias: removing %s', name);
  const aliases = config.get('aliases') || {};
  delete aliases[name];
  config.set('aliases', aliases);
}

export function listAliases(): Record<string, string> {
  const aliases = config.get('aliases') || {};
  debug('listAliases: returning %d aliases', Object.keys(aliases).length);
  return aliases;
}
