import { test, expect } from 'bun:test';
import { compressText, estimateTokens, encodeNoteInput, encodeCritiqueInput } from '../src/lib/compress';

test('compressText collapses whitespace and blank-line runs', () => {
  expect(compressText('Hello   world\n\n\n\nSecond    line\t\there')).toBe('Hello world\n\nSecond line here');
});

test('compressText drops consecutive duplicate lines', () => {
  expect(compressText('Repeated line\nRepeated line\nRepeated line\nDifferent')).toBe('Repeated line\nDifferent');
});

test('compressText reduces the estimated token count', () => {
  const input = 'word   '.repeat(200);
  expect(estimateTokens(compressText(input))).toBeLessThan(estimateTokens(input));
});

test('compressText truncates to a token budget at a boundary', () => {
  const text = compressText('This is a complete sentence about databases. '.repeat(200), { maxTokens: 20 });
  expect(estimateTokens(text)).toBeLessThanOrEqual(30);
  expect(text).toContain('truncated');
});

test('compressText passes text through unchanged when disabled', () => {
  const input = 'Hello   world\n\n\n\nkept';
  expect(compressText(input, { enabled: false })).toBe(input);
});

test('encodeNoteInput compresses only the content field', () => {
  const encoded = JSON.parse(encodeNoteInput({
    title: 'CAP theorem',
    content: 'Consistency.\n\n\n\nAvailability.',
    tags: ['system-design'],
  }));
  expect(encoded.title).toBe('CAP theorem');
  expect(encoded.tags).toEqual(['system-design']);
  expect(encoded.content).toBe('Consistency.\n\nAvailability.');
});

test('encodeCritiqueInput compresses the answer field', () => {
  const encoded = JSON.parse(encodeCritiqueInput({
    card: { rubric: ['mentions read speed'] },
    answer: 'Indexes   speed\n\n\n\nreads.',
  }));
  expect(encoded.card.rubric).toEqual(['mentions read speed']);
  expect(encoded.answer).toBe('Indexes speed\n\nreads.');
});
