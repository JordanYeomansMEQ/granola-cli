import { encode } from '@toon-format/toon';
import type { ProseMirrorDoc, Utterance } from '../types.js';

export interface MeetingExport {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  workspace_id?: string;
  notes_markdown: string | null;
  notes_raw: ProseMirrorDoc | null;
  transcript: Utterance[];
}

export function toToon(data: MeetingExport): string {
  return encode(data);
}
