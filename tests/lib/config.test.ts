import { beforeEach, describe, expect, it, vi } from 'vitest';

// Need to access the mocked module
vi.mock('conf', () => {
  const store: Record<string, unknown> = {};
  return {
    default: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => store[key] ?? defaultValue),
      set: vi.fn((key: string, value: unknown) => {
        store[key] = value;
      }),
      delete: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      }),
      store,
    })),
  };
});

// Import after mocking
import {
  deleteAlias,
  getAlias,
  getConfig,
  getConfigValue,
  listAliases,
  resetConfig,
  setAlias,
  setConfig,
  setConfigValue,
  validateAliasCommand,
} from '../../src/lib/config.js';
import type { Config } from '../../src/types.js';

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return the full config object', () => {
      const config = getConfig();
      expect(config).toBeDefined();
    });
  });

  describe('setConfig', () => {
    it('should update the entire config', () => {
      const newConfig: Config = {
        default_workspace: 'ws123',
        pager: 'less -R',
        aliases: { meetings: 'meeting list' },
      };

      setConfig(newConfig);
      const config = getConfig();

      expect(config.default_workspace).toBe('ws123');
      expect(config.pager).toBe('less -R');
      expect(config.aliases?.meetings).toBe('meeting list');
    });
  });

  describe('getConfigValue', () => {
    it('should get a specific config value', () => {
      setConfigValue('default_workspace', 'test-ws');
      expect(getConfigValue('default_workspace')).toBe('test-ws');
    });

    it('should return undefined for missing keys', () => {
      resetConfig();
      expect(getConfigValue('default_workspace')).toBeUndefined();
    });
  });

  describe('setConfigValue', () => {
    it('should set a specific config value', () => {
      setConfigValue('pager', 'more');
      expect(getConfigValue('pager')).toBe('more');
    });
  });

  describe('resetConfig', () => {
    it('should clear all config values', () => {
      setConfigValue('default_workspace', 'ws123');
      setConfigValue('pager', 'less');

      resetConfig();

      expect(getConfigValue('default_workspace')).toBeUndefined();
      expect(getConfigValue('pager')).toBeUndefined();
    });
  });

  describe('alias management', () => {
    beforeEach(() => {
      resetConfig();
    });

    describe('validateAliasCommand', () => {
      it('should accept valid alias commands', () => {
        expect(validateAliasCommand('meeting list')).toBe(true);
        expect(validateAliasCommand('meeting list --limit 50')).toBe(true);
        expect(validateAliasCommand('workspace view')).toBe(true);
        expect(validateAliasCommand('meeting-list')).toBe(true);
        expect(validateAliasCommand('meeting_list')).toBe(true);
      });

      it('should allow quoted arguments and flags', () => {
        expect(validateAliasCommand('meeting list --workspace "Product Team"')).toBe(true);
        expect(validateAliasCommand("meeting list --search 'Quarterly Plan'")).toBe(true);
      });

      it('should reject commands with shell metacharacters', () => {
        expect(validateAliasCommand('meeting list; rm -rf /')).toBe(false);
        expect(validateAliasCommand('meeting | cat')).toBe(false);
        expect(validateAliasCommand('meeting & echo')).toBe(false);
        expect(validateAliasCommand('meeting $(whoami)')).toBe(false);
        expect(validateAliasCommand('meeting `whoami`')).toBe(false);
      });

      it('should reject commands with dangerous characters', () => {
        expect(validateAliasCommand('meeting > /tmp/file')).toBe(false);
        expect(validateAliasCommand('meeting < /etc/passwd')).toBe(false);
        expect(validateAliasCommand('meeting && rm -rf /')).toBe(false);
      });
    });

    describe('setAlias', () => {
      it('should create a new alias', () => {
        setAlias('meetings', 'meeting list');
        expect(getAlias('meetings')).toBe('meeting list');
      });

      it('should update an existing alias', () => {
        setAlias('meetings', 'meeting list');
        setAlias('meetings', 'meeting list --limit 50');
        expect(getAlias('meetings')).toBe('meeting list --limit 50');
      });

      it('should reject invalid alias commands', () => {
        expect(() => setAlias('bad', 'meeting; rm -rf /')).toThrow(/invalid/i);
      });

      it('should reject aliases with shell metacharacters', () => {
        expect(() => setAlias('bad', 'meeting | cat')).toThrow();
        expect(() => setAlias('bad', 'meeting $(whoami)')).toThrow();
        expect(() => setAlias('bad', 'meeting `id`')).toThrow();
      });

      it('should allow aliases with quoted arguments', () => {
        expect(() =>
          setAlias('product-team', 'meeting list --workspace "Product Team"'),
        ).not.toThrow();
      });
    });

    describe('getAlias', () => {
      it('should return undefined for non-existent alias', () => {
        expect(getAlias('nonexistent')).toBeUndefined();
      });

      it('should return the alias value', () => {
        setAlias('today', 'meeting list --limit 10');
        expect(getAlias('today')).toBe('meeting list --limit 10');
      });
    });

    describe('deleteAlias', () => {
      it('should remove an alias', () => {
        setAlias('meetings', 'meeting list');
        deleteAlias('meetings');
        expect(getAlias('meetings')).toBeUndefined();
      });

      it('should handle deleting non-existent alias', () => {
        expect(() => deleteAlias('nonexistent')).not.toThrow();
      });
    });

    describe('listAliases', () => {
      it('should return empty object when no aliases', () => {
        const aliases = listAliases();
        expect(aliases).toEqual({});
      });

      it('should return all aliases', () => {
        setAlias('meetings', 'meeting list');
        setAlias('today', 'meeting list --limit 10');

        const aliases = listAliases();

        expect(aliases).toEqual({
          meetings: 'meeting list',
          today: 'meeting list --limit 10',
        });
      });
    });
  });
});
