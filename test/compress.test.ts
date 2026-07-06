import { test, expect } from 'bun:test';
import { compressText, compressNoteInput, estimateTokens, encodeNoteInput, encodeCritiqueInput } from '../src/lib/compress';

test('compressText collapses whitespace and blank-line runs', () => {
  const input = 'Hello   world\n\n\n\nSecond    line\t\there';
  const { text } = compressText(input);
  expect(text).toBe('Hello world\n\nSecond line here');
});

test('compressText drops consecutive duplicate lines', () => {
  const input = 'Repeated line\nRepeated line\nRepeated line\nDifferent';
  const { text } = compressText(input);
  expect(text).toBe('Repeated line\nDifferent');
});

test('compressText reduces the estimated token count', () => {
  const input = 'word   '.repeat(200);
  const result = compressText(input);
  expect(result.compressedTokens).toBeLessThan(result.originalTokens);
});

test('compressText truncates to a token budget at a boundary', () => {
  const sentence = 'This is a complete sentence about databases. ';
  const input = sentence.repeat(200);
  const { text } = compressText(input, { maxTokens: 20 });
  expect(estimateTokens(text)).toBeLessThanOrEqual(30);
  expect(text).toContain('truncated');
});

test('compressText passes text through unchanged when disabled', () => {
  const input = 'Hello   world\n\n\n\nkept';
  const { text } = compressText(input, { enabled: false });
  expect(text).toBe(input);
});

test('compressNoteInput compresses only the content field', () => {
  const note = {
    title: 'CAP theorem',
    content: 'Consistency.\n\n\n\nAvailability.',
    tags: ['system-design'],
  };
  const compressed = compressNoteInput(note);
  expect(compressed.title).toBe('CAP theorem');
  expect(compressed.tags).toEqual(['system-design']);
  expect(compressed.content).toBe('Consistency.\n\nAvailability.');
});

test('encodeNoteInput produces TOON, not JSON, and is smaller for the same content', () => {
  const note = {
    title: 'CAP theorem',
    content: 'Consistency.\n\n\n\nAvailability.',
    tags: ['system-design'],
  };
  const toon = encodeNoteInput(note);
  expect(toon).not.toContain('{');
  expect(toon).toContain('title: CAP theorem');
  expect(toon).toContain('Consistency.');
  expect(toon.length).toBeLessThan(JSON.stringify(note).length);
});

test('encodeCritiqueInput compresses the answer field and encodes as TOON', () => {
  const toon = encodeCritiqueInput({
    card: { rubric: ['mentions read speed'] },
    answer: 'Indexes   speed\n\n\n\nreads.',
  });
  expect(toon).not.toContain('{');
  expect(toon).toContain('Indexes speed');
  expect(toon).toContain('reads.');
});
