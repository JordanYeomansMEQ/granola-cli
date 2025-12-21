import type { Utterance } from '../types.js';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:transcript');

interface FormatOptions {
  timestamps?: boolean;
  source?: 'microphone' | 'system' | 'all';
}

export function formatTranscript(utterances: Utterance[], opts: FormatOptions = {}): string {
  debug('formatTranscript: %d utterances, opts=%O', utterances.length, opts);
  const { timestamps = false, source = 'all' } = opts;

  let filtered = utterances;
  if (source !== 'all') {
    filtered = utterances.filter((u) => u.source === source);
    debug('filtered to %d utterances (source=%s)', filtered.length, source);
  }

  if (filtered.length === 0) {
    debug('no transcript available');
    return 'No transcript available.';
  }

  const lines: string[] = [];

  for (const u of filtered) {
    const speaker = u.source === 'microphone' ? 'You' : 'Participant';

    if (timestamps) {
      const time = formatTimestamp(u.start_timestamp);
      lines.push(`[${time}] ${speaker}`);
      lines.push(u.text);
      lines.push('');
    } else {
      lines.push(`${speaker}: ${u.text}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const s = d.getUTCSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
