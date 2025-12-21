# Security

## Overview

This document describes Granola CLI's security architecture, including credential handling, data storage, and security measures in place.

## Authentication & Credential Storage

### Keychain Integration

Granola CLI uses platform-native secure storage for credentials via the `cross-keychain` library:

- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: Secret Service

**Storage Details:**
- Service name: `com.granola.cli`
- Account: `credentials`
- Format: JSON containing `refreshToken`, `accessToken`, and `clientId`

### Credential Import

The CLI supports importing credentials from the Granola desktop application:

- **Source**: `~/Library/Application Support/Granola/supabase.json`
- **Format**: Supabase JSON format
- **Process**: Parses and validates required fields before storing in keychain

### Token Refresh

The CLI automatically handles token expiration:

**Location**: `lib/auth.ts`, `services/client.ts`

**How it works:**
- `refreshAccessToken()` calls WorkOS API to refresh expired tokens
- `withTokenRefresh()` wrapper automatically retries operations on 401 errors
- All API-calling service methods are wrapped with automatic token refresh
- New credentials are saved immediately after refresh

**Token Rotation Flow:**
1. API call fails with 401 (Unauthorized)
2. `withTokenRefresh` catches the error and calls `refreshAccessToken()`
3. CLI sends refresh request to `https://api.workos.com/user_management/authenticate`
4. WorkOS returns new `access_token` and rotated `refresh_token`
5. New credentials are saved to keychain
6. Original operation is retried with fresh token

**Important**: WorkOS refresh tokens are **single-use**. Each refresh invalidates the previous token and issues a new one. The CLI saves new tokens immediately to prevent token invalidation issues.

## Configuration Storage

Non-sensitive configuration is stored using the `conf` library:

- **Linux**: `~/.config/granola/`
- **macOS**: `~/Library/Application Support/granola/`
- **Format**: Plaintext JSON (non-sensitive data only)

## Security Measures

### Pager Command Validation

**Location**: `lib/pager.ts`

The CLI validates pager commands to prevent command injection:

- Whitelist of allowed pagers: `less`, `more`, `cat`, `head`, `tail`, `bat`, `most`
- Blocks commands containing shell metacharacters (`;`, `|`, `&`, `$`, `` ` ``, etc.)
- Falls back to direct stdout output if pager command is invalid

```typescript
const ALLOWED_PAGERS = ['less', 'more', 'cat', 'head', 'tail', 'bat', 'most'];
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>\\!#*?]/;

export function validatePagerCommand(cmd: string): boolean {
  if (SHELL_METACHARACTERS.test(cmd)) return false;
  const [binary] = cmd.split(' ');
  const binaryName = binary.split('/').pop() || '';
  return ALLOWED_PAGERS.includes(binaryName);
}
```

### Alias Command Validation

**Location**: `lib/config.ts`, `lib/alias.ts`

Aliases are validated to prevent command injection:

- `parseAliasArguments()` wrapper around `shell-quote`
- `validateAliasCommand()` rejects pipelines, redirects, or substitution syntax
- Quoted arguments are supported, but only literal argv tokens reach Commander

```typescript
export function parseAliasArguments(command: string): string[] {
  const parsed = parseShellQuote(command);
  if (parsed.length === 0) throw new Error('Alias cannot be empty');
  if (parsed.some((token) => typeof token !== 'string')) {
    throw new Error('Alias command contains unsupported shell syntax.');
  }
  return parsed as string[];
}
```

### Debug Logging

**Location**: `lib/auth.ts`

Authentication errors are logged via the [`debug`](https://www.npmjs.com/package/debug) library:

- Developers can inspect credential-loading issues by enabling `granola:*` namespaces
- Use `DEBUG` or `GRANOLA_DEBUG` environment variables
- Maintains graceful degradation (returns null for non-blocking errors)

Example:

```bash
DEBUG=granola:lib:auth granola auth status
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication required |
| 4 | Resource not found |

## Security Best Practices for Users

- **Never share your refresh token**: Your refresh token provides long-term access to your account.

- **Logout on shared machines**: Always run `granola auth logout` when finished using the CLI on shared or public computers.

- **Be cautious with environment variables**: Avoid setting `GRANOLA_PAGER` to untrusted values or commands from unknown sources.

- **Keep the CLI updated**: Regularly update to the latest version to receive security patches and improvements.

- **Review stored credentials**: Periodically verify that credentials are stored securely in your system's keychain.

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Granola CLI, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Additional Resources

- [OWASP Command Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
- [Secure Credential Storage Best Practices](https://www.owasp.org/index.php/Password_Storage_Cheat_Sheet)
