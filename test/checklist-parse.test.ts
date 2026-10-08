import { expect, test } from 'bun:test';
import { createChecklistItemKey, parseChecklist } from '../src/lib/checklist';

const SOURCE = `# Revision checklist

Legend before the checklist is intentionally ignored.

# PART 1 — CORE FUNDAMENTALS

## 1. Java Core \`[CV: Java 21]\`

**Language & OOP**
- Primitive vs reference types
- **Four OOP pillars** with one example each

**Collections**
- HashMap internals — hashing, buckets, and collisions
- Primitive vs reference types

# PART 2 — KNOWN WEAK SPOTS

**🔴 Still open, no defensible answer:**
1. Node event loop — ordering and one production bug story
2. Thread-pool decision — ⚠️ Q10

**🟡 Drilled but shallow:**
- RxJS — Observable vs Promise

**Request lifecycle Q10 ✅, one correction logged**
- Interceptors return an Observable

# PART 3 — ROLE-SPECIFIC ITEMS

| Item | Roles | What to do |
|---|---|---|
| **DS&A fundamentals** [JD] | SPARTAN X | Rehearse Story 3; use an escaped pipe: a\\|b |

# PART 4 — REVISION ORDER

## Ordered steps
1. Java Core → Spring Core, in that order
`;

test('parseChecklist preserves all four parts, hierarchy, and source order', () => {
  const items = parseChecklist(SOURCE);

  expect(items.map(({ partKey, sourceText }) => [partKey, sourceText])).toEqual([
    ['part-1', 'Primitive vs reference types'],
    ['part-1', '**Four OOP pillars** with one example each'],
    ['part-1', 'HashMap internals — hashing, buckets, and collisions'],
    ['part-1', 'Primitive vs reference types'],
    ['part-2', 'Node event loop — ordering and one production bug story'],
    ['part-2', 'Thread-pool decision — Q10'],
    ['part-2', 'RxJS — Observable vs Promise'],
    ['part-2', 'Interceptors return an Observable'],
    ['part-3', '**DS&A fundamentals** — SPARTAN X — Rehearse Story 3; use an escaped pipe: a|b'],
    ['part-4', 'Java Core → Spring Core, in that order'],
  ]);
  expect(items.map((item) => item.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(items[0].itemKey).not.toBe(items[3].itemKey);
  expect(items.every((item) => item.sourceText.trim().length > 0)).toBe(true);
});

test('parseChecklist inherits source badges and claim labels without checking items', () => {
  const items = parseChecklist(SOURCE);

  expect(items[0]).toMatchObject({
    sectionTitle: '1. Java Core',
    category: 'Language & OOP',
    sourceStatus: null,
    claimFlags: ['CV'],
  });
  expect(items[4]).toMatchObject({
    category: 'Still open, no defensible answer',
    sourceStatus: '🔴',
    claimFlags: [],
  });
  expect(items[6]).toMatchObject({
    category: 'Drilled but shallow',
    sourceStatus: '🟡',
  });
  expect(items[5].sourceStatus).toBe('⚠️');
  expect(items[7]).toMatchObject({
    category: 'Request lifecycle Q10, one correction logged',
    sourceStatus: '✅',
  });
  expect(items[8]).toMatchObject({
    sourceStatus: null,
    claimFlags: ['JD'],
  });
});

test('createChecklistItemKey ignores volatile status marks and whitespace', () => {
  const strong = createChecklistItemKey('part-1', 'Java Core', 'Collections', '- HashMap internals [CV]');
  const open = createChecklistItemKey('part-1', 'Java Core', 'Collections', '- HashMap internals 🔴 [CV]');
  const otherCategory = createChecklistItemKey('part-1', 'Java Core', 'Language', 'HashMap internals');

  expect(strong).toBe(open);
  expect(strong).not.toBe(otherCategory);
});

test('parseChecklist strips BOM and supports CRLF without reading status emoji inside code', () => {
  const markdown = '\uFEFF# PART 1 — Core\r\n## 1. Java\r\n- Mention `✅` in an interview answer\r\n';
  const [item] = parseChecklist(markdown);

  expect(item.sourceText).toBe('Mention `✅` in an interview answer');
  expect(item.sourceStatus).toBeNull();
});

test('parseChecklist rejects empty actionable rows with a source line number', () => {
  expect(() => parseChecklist('# PART 1 — Core\n## Java\n- \n')).toThrow(/line 3/i);
});

test('parseChecklist keeps the first data row of a headerless table', () => {
  const items = parseChecklist('# PART 3 — Roles\n| DS&A fundamentals | SPARTAN X | Rehearse Story 3 |\n');

  expect(items).toHaveLength(1);
  expect(items[0].sourceText).toBe('DS&A fundamentals — SPARTAN X — Rehearse Story 3');
});
