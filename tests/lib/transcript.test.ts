import { describe, expect, it } from 'vitest';
import { formatTranscript } from '../../src/lib/transcript.js';
import { mockTranscript } from '../fixtures/meetings.js';

describe('transcript', () => {
  describe('formatTranscript', () => {
    it('should format transcript without timestamps', () => {
      const result = formatTranscript(mockTranscript);

      expect(result).toContain("You: Let's start with the timeline.");
      expect(result).toContain("Participant: We're about two weeks behind");
      expect(result).toContain('Participant: I think we can make up some time');
      expect(result).toContain('You: What is the minimum we need');
    });

    it('should format transcript with timestamps', () => {
      const result = formatTranscript(mockTranscript, { timestamps: true });

      expect(result).toContain('[14:00:12] You');
      expect(result).toContain('[14:00:18] Participant');
      expect(result).toContain('[14:00:31] Participant');
      expect(result).toContain('[14:00:45] You');
    });

    it('should filter by microphone source (user)', () => {
      const result = formatTranscript(mockTranscript, { source: 'microphone' });

      expect(result).toContain('You:');
      expect(result).not.toContain('Participant:');
    });

    it('should filter by system source (others)', () => {
      const result = formatTranscript(mockTranscript, { source: 'system' });

      expect(result).toContain('Participant:');
      expect(result).not.toContain('You:');
    });

    it('should show all sources by default', () => {
      const result = formatTranscript(mockTranscript, { source: 'all' });

      expect(result).toContain('You:');
      expect(result).toContain('Participant:');
    });

    it('should return message for empty transcript', () => {
      const result = formatTranscript([]);
      expect(result).toBe('No transcript available.');
    });

    it('should return message when filter returns no results', () => {
      const micOnly = mockTranscript.filter((u) => u.source === 'microphone');
      const result = formatTranscript(micOnly, { source: 'system' });
      expect(result).toBe('No transcript available.');
    });

    it('should handle timestamps with zero-padded values', () => {
      const utterances = [
        {
          source: 'microphone' as const,
          text: 'Early morning meeting',
          start_timestamp: '2025-12-18T09:05:07Z',
          end_timestamp: '2025-12-18T09:05:10Z',
          confidence: 0.95,
        },
      ];

      const result = formatTranscript(utterances, { timestamps: true });
      expect(result).toContain('[09:05:07]');
    });

    it('should preserve utterance text exactly', () => {
      const utterances = [
        {
          source: 'microphone' as const,
          text: 'Text with "quotes" and special chars: @#$%',
          start_timestamp: '2025-12-18T10:00:00Z',
          end_timestamp: '2025-12-18T10:00:05Z',
          confidence: 0.9,
        },
      ];

      const result = formatTranscript(utterances);
      expect(result).toContain('Text with "quotes" and special chars: @#$%');
    });

    it('should combine timestamps and source filter', () => {
      const result = formatTranscript(mockTranscript, {
        timestamps: true,
        source: 'microphone',
      });

      expect(result).toContain('[14:00:12] You');
      expect(result).toContain('[14:00:45] You');
      expect(result).not.toContain('Participant');
    });

    it('should separate utterances with newlines', () => {
      const result = formatTranscript(mockTranscript);
      const lines = result.split('\n');

      // Should have blank lines between utterances
      expect(lines.some((line) => line === '')).toBe(true);
    });
  });
});
