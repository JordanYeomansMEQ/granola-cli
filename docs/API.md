# API Documentation

This document describes the internal APIs and types used by Granola CLI.

## Types

All types are defined in `src/types.ts`.

### Person

```typescript
interface Person {
  name?: string;
  email?: string;
  details?: {
    employment?: {
      title?: string;
      name?: string;  // company name
    };
    company?: {
      name?: string;
    };
  };
}
```

### People

```typescript
interface People {
  creator?: Person;
  attendees?: Person[];
}
```

### Meeting

```typescript
interface Meeting {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  workspace_id?: string;
  folder_id?: string;
  last_viewed_panel?: {
    content?: ProseMirrorDoc;
  };
  people?: People;
}
```

### ProseMirrorDoc

The notes content uses ProseMirror's JSON format:

```typescript
interface ProseMirrorDoc {
  type: 'doc';
  content: ProseMirrorNode[];
}

interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}
```

Supported node types:
- `heading` (with `level` attribute: 1-6)
- `paragraph`
- `bulletList`, `orderedList`, `listItem`
- `blockquote`
- `codeBlock` (with `language` attribute)
- `horizontalRule`
- `hardBreak`

Supported mark types:
- `bold`, `italic`, `strike`, `underline`
- `code` (inline code)
- `link` (with `href` attribute)

### Utterance (Transcript)

```typescript
interface Utterance {
  speaker: string;
  text: string;
  timestamp?: number;
  source?: 'microphone' | 'system';
}
```

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  created_at: string;
}
```

### Folder

```typescript
interface Folder {
  id: string;
  name?: string;
  title?: string;
  workspace_id: string;
  document_ids?: string[];
}
```

### Credentials

```typescript
interface Credentials {
  refreshToken: string;
  clientId: string;
}
```

### Config

```typescript
interface Config {
  default_workspace?: string;
  pager?: string;
  aliases?: Record<string, string>;
}
```

## Services

### client.ts

Manages the Granola API client instance.

```typescript
// Get authenticated client (exits with code 2 if not authenticated)
async function getClient(): Promise<GranolaClient>

// Reset client (for testing)
function resetClient(): void
```

### meetings.ts

Meeting operations.

```typescript
interface ListOptions {
  limit?: number;
  workspace?: string;
  folder?: string;
}

// List meetings
async function list(options?: ListOptions): Promise<Meeting[]>

// Resolve partial meeting ID to full ID (prefix matching)
async function resolveId(partialId: string): Promise<string | null>

// Get a single meeting
async function get(id: string): Promise<Meeting | null>

// Get manual meeting notes (user-written)
async function getNotes(id: string): Promise<ProseMirrorDoc | null>

// Get AI-enhanced meeting notes (from last_viewed_panel)
async function getEnhancedNotes(id: string): Promise<ProseMirrorDoc | null>

// Get meeting transcript
async function getTranscript(id: string): Promise<Utterance[]>
```

### workspaces.ts

Workspace operations.

```typescript
// List all workspaces
async function list(): Promise<Workspace[]>

// Get a single workspace
async function get(id: string): Promise<Workspace | null>
```

### folders.ts

Folder operations.

```typescript
interface ListOptions {
  workspace?: string;
}

// List folders
async function list(options?: ListOptions): Promise<Folder[]>

// Get a single folder
async function get(id: string): Promise<Folder | null>
```

## Libraries

### auth.ts

Credential management using system keychain.

```typescript
// Get stored credentials
async function getCredentials(): Promise<Credentials | null>

// Save credentials
async function saveCredentials(creds: Credentials): Promise<void>

// Delete credentials
async function deleteCredentials(): Promise<void>

// Parse Supabase JSON format (from desktop app)
function parseSupabaseJson(json: string): Credentials | null
```

### config.ts

Configuration management using conf package.

```typescript
// Get entire config
function getConfig(): Config

// Get a config value
function getConfigValue<K extends keyof Config>(key: K): Config[K]

// Set a config value
function setConfigValue<K extends keyof Config>(key: K, value: Config[K]): void

// Reset config to defaults
function resetConfig(): void

// Alias management
function getAlias(name: string): string | undefined
function setAlias(name: string, command: string): void
function deleteAlias(name: string): void
function listAliases(): Record<string, string>
```

### output.ts

Table formatting and output utilities.

```typescript
interface ColumnDef<T> {
  key: keyof T;
  header: string;
  width?: number;
  format?: (value: unknown) => string;
}

// Format data as a table
function table<T extends object>(data: T[], columns: ColumnDef<T>[]): string

// Format ISO date string
function formatDate(isoDate: string): string

// Format duration in seconds
function formatDuration(seconds: number): string

// Truncate string to length
function truncate(str: string, length: number): string
```

### pager.ts

Pager integration for long content.

```typescript
// Pipe content through system pager
async function pipeToPager(content: string): Promise<void>
```

Uses `GRANOLA_PAGER`, then `PAGER` environment variable, then `less -R` as fallback.

### prosemirror.ts

Convert ProseMirror JSON to Markdown.

```typescript
// Convert ProseMirror document to Markdown string
function toMarkdown(doc: ProseMirrorDoc): string
```

### transcript.ts

Transcript formatting.

```typescript
interface FormatOptions {
  timestamps?: boolean;
  source?: 'microphone' | 'system' | 'all';
}

// Format transcript as readable text
function formatTranscript(utterances: Utterance[], options?: FormatOptions): string
```

## Command Factory Functions

All commands export factory functions for testability:

```typescript
// Each command file exports:
export function createXxxCommand(): Command
export const xxxCommand: Command  // Pre-created instance
```

### Meeting Commands

- `createListCommand()` - `meeting list`
- `createViewCommand()` - `meeting view <id>`
- `createNotesCommand()` - `meeting notes <id>` (manual notes)
- `createEnhancedCommand()` - `meeting enhanced <id>` (AI-enhanced notes)
- `createTranscriptCommand()` - `meeting transcript <id>`
- `createExportCommand()` - `meeting export <id>`

### Workspace Commands

- `createListCommand()` - `workspace list`
- `createViewCommand()` - `workspace view <id>`

### Folder Commands

- `createListCommand()` - `folder list`
- `createViewCommand()` - `folder view <id>`

### Auth Commands

- `createLoginCommand()` - `login import/stdin`
- `createLogoutCommand()` - `auth logout`
- `createStatusCommand()` - `auth status`

### Config Command

- `createConfigCommand()` - `config list/get/set/reset`

### Alias Command

- `createAliasCommand()` - `alias list/set/delete`

## Exit Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | - | Success |
| 1 | - | General error |
| 2 | - | Authentication required |
| 4 | - | Resource not found |
