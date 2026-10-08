import { createHash } from 'node:crypto';

export type ChecklistSourceStatus = '✅' | '🟡' | '🔴' | '⚠️' | null;

export interface ChecklistImportItem {
  itemKey: string;
  partKey: string;
  partTitle: string;
  sectionTitle: string;
  category: string | null;
  ordinal: number;
  sourceText: string;
  sourceStatus: ChecklistSourceStatus;
  claimFlags: string[];
}

const STATUS_MARKS = ['✅', '🟡', '🔴', '⚠️'] as const;
const CLAIM_PATTERN = /\[(CV|JD|fund)(?::[^\]]*)?\]/gi;
const PART_HEADING = /^#\s+PART\s+(\d+)\s*(?:—|-|:)\s*(.+?)\s*$/i;
const SECTION_HEADING = /^##\s+(.+?)\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+?)\s*$/;

interface ParsedMetadata {
  text: string;
  status: ChecklistSourceStatus;
  claimFlags: string[];
}

interface ChecklistContext {
  partKey: string;
  partTitle: string;
  sectionTitle: string;
  sectionStatus: ChecklistSourceStatus;
  sectionClaims: string[];
  category: string | null;
  categoryStatus: ChecklistSourceStatus;
  categoryClaims: string[];
}

function parseMetadata(value: string): ParsedMetadata {
  let text = value;
  let status: ChecklistSourceStatus = null;

  const withoutCode = text.replace(/`[^`]*`/g, (code) => ' '.repeat(code.length));
  const candidates: { mark: ChecklistSourceStatus; start: number; end: number }[] = [];

  for (const mark of STATUS_MARKS) {
    let from = 0;
    while (true) {
      const index = withoutCode.indexOf(mark, from);
      if (index < 0) break;
      const before = withoutCode.slice(0, index);
      const after = withoutCode.slice(index + mark.length);
      const isLeadingBoldMark = /^\*\*\s*$/.test(before);
      const isTrailingMark = after.trim() === '';
      const followsDash = /(?:—|–|-)\s*$/.test(before);
      const followsBoldHeading = /\*\*\s*$/.test(before);
      const followsQuestion = /Q\d+\s*$/i.test(before);
      const hasStatusSuffix = /^\s*(?:\*\(|\*\*|Q\d|\[(?:CV|JD|fund)(?::[^\]]*)?\]|$)/i.test(after);
      const hasQuestionSuffix = /^\s*(?:[,;)]|$)/.test(after);

      if (
        isLeadingBoldMark ||
        isTrailingMark ||
        ((followsDash || followsBoldHeading) && hasStatusSuffix) ||
        (followsQuestion && hasQuestionSuffix)
      ) {
        candidates.push({ mark, start: index, end: index + mark.length });
      }
      from = index + mark.length;
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.start - b.start);
    const candidate = candidates[0];
    status = candidate.mark;
    text = `${text.slice(0, candidate.start)}${text.slice(candidate.end)}`;
  }

  const claimFlags: string[] = [];
  text = text.replace(CLAIM_PATTERN, (_marker, flag: string) => {
    const normalized = flag.toUpperCase();
    if (!claimFlags.includes(normalized)) claimFlags.push(normalized);
    return '';
  });
  text = text.replace(/``/g, '').replace(/\s+([,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();

  return { text, status, claimFlags };
}

function normalizedKeyText(sourceText: string): string {
  return parseMetadata(sourceText)
    .text
    .replace(/\s+(?:✅|🟡|🔴|⚠️)(?=\s*(?:\[(?:CV|JD|fund)(?::[^\]]*)?\])?\s*$)/g, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function createChecklistItemKey(
  partKey: string,
  sectionTitle: string,
  category: string | null,
  sourceText: string
): string {
  const identity = [partKey, sectionTitle, category ?? '', normalizedKeyText(sourceText)].join('\u001f');
  return createHash('sha256').update(identity).digest('hex');
}

function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let escaped = false;

  for (const char of line.trim()) {
    if (escaped) {
      cell += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  if (escaped) cell += '\\';
  if (cell.trim()) cells.push(cell.trim());

  if (line.trim().startsWith('|') && cells[0] === '') cells.shift();
  if (line.trim().endsWith('|') && cells.at(-1) === '') cells.pop();
  return cells;
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function addItem(
  items: ChecklistImportItem[],
  context: ChecklistContext,
  text: string,
  lineNumber: number
): void {
  const parsed = parseMetadata(text);
  if (!parsed.text) throw new Error(`Empty checklist item at line ${lineNumber}`);

  const claimFlags = [...new Set([...context.sectionClaims, ...context.categoryClaims, ...parsed.claimFlags])];
  const sourceStatus = parsed.status ?? context.categoryStatus ?? context.sectionStatus;
  items.push({
    itemKey: createChecklistItemKey(context.partKey, context.sectionTitle, context.category, parsed.text),
    partKey: context.partKey,
    partTitle: context.partTitle,
    sectionTitle: context.sectionTitle,
    category: context.category,
    ordinal: items.length + 1,
    sourceText: parsed.text,
    sourceStatus,
    claimFlags,
  });
}

export function parseChecklist(markdown: string): ChecklistImportItem[] {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
  const items: ChecklistImportItem[] = [];
  let context: ChecklistContext | null = null;
  let inTable = false;

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index].trim();
    if (!line) continue;

    const partMatch = PART_HEADING.exec(line);
    if (partMatch) {
      const metadata = parseMetadata(partMatch[2]);
      context = {
        partKey: `part-${partMatch[1]}`,
        partTitle: `PART ${partMatch[1]} — ${metadata.text}`,
        sectionTitle: `PART ${partMatch[1]} — ${metadata.text}`,
        sectionStatus: metadata.status,
        sectionClaims: metadata.claimFlags,
        category: null,
        categoryStatus: null,
        categoryClaims: [],
      };
      inTable = false;
      continue;
    }

    if (!context) continue;

    const sectionMatch = SECTION_HEADING.exec(line);
    if (sectionMatch) {
      const metadata = parseMetadata(sectionMatch[1]);
      context.sectionTitle = metadata.text;
      context.sectionStatus = metadata.status;
      context.sectionClaims = metadata.claimFlags;
      context.category = null;
      context.categoryStatus = null;
      context.categoryClaims = [];
      inTable = false;
      continue;
    }

    if (/^\*\*.+\*\*/.test(line) && !LIST_ITEM.test(line)) {
      const headingContent = /^\*\*(.+?)\*\*/.exec(line)?.[1] ?? line;
      const headingMetadata = parseMetadata(headingContent);
      const fullMetadata = parseMetadata(line);
      const contentWithoutMark = STATUS_MARKS.reduce(
        (content, mark) => content.startsWith(mark) ? content.slice(mark.length).trimStart() : content,
        headingMetadata.text
      );
      context.category = contentWithoutMark.replace(/:\s*$/, '').trim() || null;
      context.categoryStatus = fullMetadata.status ?? headingMetadata.status;
      context.categoryClaims = [...new Set([...headingMetadata.claimFlags, ...fullMetadata.claimFlags])];
      inTable = false;
      continue;
    }

    if (line.startsWith('|')) {
      if (isTableSeparator(line)) {
        inTable = true;
        continue;
      }
      if (!inTable) {
        const nextLine = lines[index + 1]?.trim() ?? '';
        if (isTableSeparator(nextLine)) {
          inTable = true;
          continue;
        }
        inTable = true;
      }
      const cells = splitTableRow(line);
      if (cells.length < 2) throw new Error(`Malformed checklist table row at line ${lineNumber}`);
      if (/^item$/i.test(cells[0].replace(/\*/g, '').trim())) continue;
      addItem(items, context, cells.join(' — '), lineNumber);
      continue;
    }

    inTable = false;
    if (/^(?:[-*+]|\d+[.)])$/.test(line)) {
      throw new Error(`Empty checklist item at line ${lineNumber}`);
    }
    const itemMatch = LIST_ITEM.exec(line);
    if (itemMatch) {
      addItem(items, context, itemMatch[1], lineNumber);
      continue;
    }

    if (/^(?:---+|\*\*Marks\*\*:?|>)/.test(line)) continue;
    // Ordinary prose is section context, not a checklist step.
  }

  return items;
}
