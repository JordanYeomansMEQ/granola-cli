import { describe, expect, it } from 'vitest';
import { isAliasCommandSafe, parseAliasArguments } from '../../src/lib/alias.js';

describe('alias utilities', () => {
  describe('parseAliasArguments', () => {
    it('should split quoted arguments correctly', () => {
      const args = parseAliasArguments('meeting list --workspace "Product Team"');
      expect(args).toEqual(['meeting', 'list', '--workspace', 'Product Team']);
    });

    it('should allow nested quotes', () => {
      const args = parseAliasArguments("meeting list --search 'Quarterly Plan'");
      expect(args).toEqual(['meeting', 'list', '--search', 'Quarterly Plan']);
    });

    it('should throw on empty commands', () => {
      expect(() => parseAliasArguments('   ')).toThrow(/cannot be empty/i);
    });

    it('should throw on shell operators', () => {
      expect(() => parseAliasArguments('meeting list | cat')).toThrow(/unsupported/i);
      expect(() => parseAliasArguments('meeting && echo hi')).toThrow(/unsupported/i);
    });

    it('should throw on substitution characters', () => {
      expect(() => parseAliasArguments('meeting $(whoami)')).toThrow(/unsupported|substitution/i);
      expect(() => parseAliasArguments('meeting `id`')).toThrow(/unsupported|substitution/i);
    });
  });

  describe('isAliasCommandSafe', () => {
    it('should return true for safe commands', () => {
      expect(isAliasCommandSafe('meeting list --limit 20')).toBe(true);
      expect(isAliasCommandSafe("meeting list --search 'Q1 Review'")).toBe(true);
    });

    it('should return false for unsafe commands', () => {
      expect(isAliasCommandSafe('meeting list; rm -rf /')).toBe(false);
      expect(isAliasCommandSafe('meeting $(whoami)')).toBe(false);
    });
  });
});
