import type { NoteInput, CritiqueInput } from './ai';

export interface CompressOptions {
  /** Approximate maximum tokens to keep. Content beyond this is truncated at a sentence boundary. */
  maxTokens?: number;
  /** Set false to skip compression entirely (returns the input unchanged). */
  enabled?: boolean;
}

export interface CompressResult {
  text: string;
  originalTokens: number;
  compressedTokens: number;
}

const DEFAULT_MAX_TOKENS = 2000;

/**
 * Rough token estimate. Real tokenizers vary, but ~4 characters per token is a
 * stable heuristic for English prose and is good enough for budgeting input.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Deterministically shrink free-form text before sending it to an LLM, without
 * changing its meaning:
 *  - normalize line endings and trim each line
 *  - collapse runs of intra-line whitespace to a single space
 *  - collapse 3+ blank lines down to a single blank line
 *  - drop consecutive duplicate lines (common in pasted Notion exports)
 *  - optionally truncate to a token budget at a sentence/line boundary
 */
export function compressText(input: string, options: CompressOptions = {}): CompressResult {
  const original = typeof input === 'string' ? input : String(input ?? '');
  const originalTokens = estimateTokens(original);

  if (options.enabled === false) {
    return { text: original, originalTokens, compressedTokens: originalTokens };
  }

  const lines = original
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim());

  const collapsed: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line === '') {
      blankRun += 1;
      if (blankRun > 1) continue; // keep at most one blank line in a row
    } else {
      blankRun = 0;
      if (collapsed.length > 0 && collapsed[collapsed.length - 1] === line) {
        continue; // drop consecutive duplicate lines
      }
    }
    collapsed.push(line);
  }

  let text = collapsed.join('\n').trim();

  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (maxTokens > 0 && estimateTokens(text) > maxTokens) {
    text = truncateToTokens(text, maxTokens);
  }

  return { text, originalTokens, compressedTokens: estimateTokens(text) };
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  // Prefer cutting at the last sentence end, then paragraph, then word boundary.
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  let cut = sentenceEnd;
  if (cut < maxChars * 0.6) cut = slice.lastIndexOf('\n');
  if (cut < maxChars * 0.6) cut = slice.lastIndexOf(' ');
  if (cut <= 0) cut = maxChars;

  return slice.slice(0, cut + 1).trim() + '\n[...truncated for length...]';
}

/** Compress the free-form fields of a note before sending it to the AI provider. */
export function compressNoteInput(note: NoteInput, options: CompressOptions = {}): NoteInput {
  return {
    ...note,
    content: compressText(note.content || '', options).text,
  };
}

/** Compress the free-form fields of a critique request before sending it to the AI provider. */
export function compressCritiqueInput(input: CritiqueInput, options: CompressOptions = {}): CritiqueInput {
  return {
    ...input,
    answer: compressText(input.answer || '', options).text,
  };
}
