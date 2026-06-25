# MCQ Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate MCQ questions from synced notes alongside open-recall card drafts, auto-approved and available immediately in MCQ practice mode.

**Architecture:** New `generateMCQs(note)` method on the AI provider. Called during draft generation (per-note and batch). Stored in new `mcq_questions` table. Served via state API to MCQ practice tab. Mock data replaced with real data.

**Tech Stack:** Bun 1.1+, Next.js 14, React 18, TypeScript 5, bun:sqlite, ESM

---

### Task 1: Add MCQ types and generateMCQs to AI provider

**Files:**
- Modify: `src/lib/ai.ts`
- Test: `test/ai.test.ts`

- [ ] **Step 1: Write test for offline provider generateMCQs**

```typescript
// Add to test/ai.test.ts
import type { NoteInput, MCQ } from '../src/lib/ai';

test('generateMCQs from offline provider returns a deterministic MCQ', async () => {
  const { createAiProvider } = await import('../src/lib/ai');
  const provider = createAiProvider({ provider: 'offline' });
  const note: NoteInput = {
    title: 'B+Tree Indexing',
    content: 'B+Tree is a balanced tree data structure that enables O(log n) search, insert, and delete operations. It is commonly used in database indexing because of its efficient range queries and predictable performance.',
    tags: ['Databases'],
  };
  const mcqs = await provider.generateMCQs(note);
  expect(mcqs).toHaveLength(1);
  expect(mcqs[0]).toHaveProperty('question');
  expect(mcqs[0]).toHaveProperty('options');
  expect(mcqs[0].options).toHaveLength(4);
  expect(typeof mcqs[0].correctIndex).toBe('number');
  expect(mcqs[0].correctIndex).toBeGreaterThanOrEqual(0);
  expect(mcqs[0].correctIndex).toBeLessThan(4);
  expect(mcqs[0]).toHaveProperty('explanation');
  expect(mcqs[0].tags).toEqual(['Databases']);
});

test('generateMCQs from offline provider handles empty content gracefully', async () => {
  const { createAiProvider } = await import('../src/lib/ai');
  const provider = createAiProvider({ provider: 'offline' });
  const mcqs = await provider.generateMCQs({ title: 'Empty', content: '' });
  expect(mcqs).toHaveLength(1);
  expect(mcqs[0].options.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/ai.test.ts -t "generateMCQs"`
Expected: FAIL — `generateMCQs` not defined on `AiProvider`

- [ ] **Step 3: Add MCQ type, update AiProvider interface, implement offline generateMCQs**

```typescript
// Add to src/lib/ai.ts after CardDraft interface
export interface MCQ {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

// Add to AiProvider interface
export interface AiProvider {
  generateCards(note: NoteInput): Promise<CardDraft[]>;
  generateMCQs(note: NoteInput): Promise<MCQ[]>;  // NEW
  critiqueAnswer(input: CritiqueInput): Promise<AnswerCritique>;
}

// Add to createOfflineProvider return
async generateMCQs(note: NoteInput): Promise<MCQ[]> {
  const tags = Array.isArray(note.tags) ? note.tags : [];
  const sentence = firstUsefulSentence(note.content) || note.title;
  // Create a true/false question from the content
  const words = sentence.split(/\s+/).filter(w => w.length > 3);
  const correctWord = words.length > 0 ? words[Math.floor(words.length / 2)] : note.title;
  const options = [
    `The key concept described is ${correctWord}.`,
    `The key concept described is the opposite of ${correctWord}.`,
    correctWord.length > 0 ? `${correctWord} is unrelated to this topic.` : 'None of the above.',
    correctWord.length > 0 ? `${correctWord} only applies to NoSQL databases.` : 'All of the above.',
  ];
  return [{
    question: `Which statement best describes ${note.title}?`,
    options,
    correctIndex: 0,
    explanation: sentence,
    tags,
  }];
}

// Add to createOpenAiCompatibleProvider return
async generateMCQs(note: NoteInput): Promise<MCQ[]> {
  const content = await completeJson([
    { role: 'system', content: 'Generate 2-3 multiple-choice questions from the note for interview practice. Return JSON with a mcqs array. Each MCQ needs question, options (4 items), correctIndex, explanation, and tags array.' },
    { role: 'user', content: JSON.stringify(note) },
  ]);
  return parseMCQs(content);
}

// Add parseMCQs function
export function parseMCQs(raw: string | any): MCQ[] {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const mcqs = Array.isArray(parsed) ? parsed : parsed.mcqs;
  if (!Array.isArray(mcqs)) {
    throw new Error('AI provider output must include a mcqs array.');
  }
  return mcqs.map((mcq: any) => {
    const options = Array.isArray(mcq.options) ? mcq.options.map(String) : [];
    if (options.length < 2) throw new Error('Each MCQ must have at least 2 options.');
    return {
      question: String(mcq.question || '').trim(),
      options,
      correctIndex: Number(mcq.correctIndex),
      explanation: String(mcq.explanation || '').trim(),
      tags: normalizeStringList(mcq.tags),
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/ai.test.ts -t "generateMCQs"`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts test/ai.test.ts
git commit -m "feat: add generateMCQs to AI provider with offline and OpenAI impl"
```

---

### Task 2: Add database methods for MCQ questions

**Files:**
- Modify: `src/lib/database.ts`
- Test: `test/database.test.ts`

- [ ] **Step 1: Write tests for createMCQs and listMCQs**

```typescript
// Add to test/database.test.ts
test('createMCQs stores questions and listMCQs returns them', () => {
  const { createAppDatabase } = require('../src/lib/database');
  const db = createAppDatabase();
  const note = db.upsertNote({
    notionPageId: 'mcq-test-1',
    title: 'MCQ Test',
    content: 'Test content for MCQ storage.',
    tags: ['Test'],
  });
  const mcqs = db.createMCQs(note.id, [
    {
      question: 'What is test?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Because A is correct.',
      tags: ['Test'],
    },
  ]);
  expect(mcqs).toHaveLength(1);
  expect(mcqs[0].question).toBe('What is test?');
  expect(mcqs[0].correctIndex).toBe(0);

  const all = db.listMCQs();
  expect(all.length).toBeGreaterThanOrEqual(1);
  const found = all.find((m: any) => m.id === mcqs[0].id);
  expect(found).toBeDefined();
  expect(found!.options).toEqual(['A', 'B', 'C', 'D']);

  db.db.prepare('DELETE FROM reviews').run();
  db.db.prepare('DELETE FROM schedules').run();
  db.db.prepare('DELETE FROM cards').run();
  db.db.prepare('DELETE FROM card_drafts').run();
  db.db.prepare('DELETE FROM mcq_questions').run();
  db.db.prepare('DELETE FROM notes').run();
  db.close();
});

test('createMCQs deletes old MCQs for the same note_id', () => {
  const { createAppDatabase } = require('../src/lib/database');
  const db = createAppDatabase();
  const note = db.upsertNote({
    notionPageId: 'mcq-test-2',
    title: 'MCQ Replace',
    content: 'Test content for replacement.',
  });
  db.createMCQs(note.id, [
    { question: 'Old?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Old.', tags: [] },
  ]);
  db.createMCQs(note.id, [
    { question: 'New?', options: ['W', 'X', 'Y', 'Z'], correctIndex: 3, explanation: 'New.', tags: [] },
  ]);
  const all = db.listMCQs();
  const noteMcqs = all.filter((m: any) => m.noteId === note.id);
  expect(noteMcqs).toHaveLength(1);
  expect(noteMcqs[0].question).toBe('New?');

  db.db.prepare('DELETE FROM mcq_questions').run();
  db.db.prepare('DELETE FROM notes').run();
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/database.test.ts -t "MCQ"`
Expected: FAIL — `createMCQs` / `listMCQs` not found

- [ ] **Step 3: Add migration and database methods**

```typescript
// In migrate() function, add after the reviews table:
db.run(`
  CREATE TABLE IF NOT EXISTS mcq_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Add methods to AppDatabase class:

createMCQs(noteId: number, mcqs: MCQInput[]): MCQQuestion[] {
  // Delete old MCQs for this note first (idempotent regenerate)
  this.db.prepare('DELETE FROM mcq_questions WHERE note_id = ?').run(noteId);
  const now = new Date().toISOString();
  const insert = this.db.prepare(`
    INSERT INTO mcq_questions (note_id, question, options_json, correct_index, explanation, tags_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const created: MCQQuestion[] = [];
  this.withTransaction(() => {
    for (const mcq of mcqs) {
      const result = insert.run(
        noteId,
        mcq.question,
        JSON.stringify(mcq.options || []),
        mcq.correctIndex,
        mcq.explanation,
        JSON.stringify(mcq.tags || []),
        now
      ) as { lastInsertRowid: number };
      created.push(this.getMCQ(Number(result.lastInsertRowid))!);
    }
  });
  return created;
}

getMCQ(id: number): MCQQuestion | undefined {
  const row = this.db.prepare('SELECT * FROM mcq_questions WHERE id = ?').get(id) as any;
  return row ? mapMCQ(row) : undefined;
}

listMCQs(): MCQQuestion[] {
  return (this.db.prepare('SELECT * FROM mcq_questions ORDER BY created_at DESC, id DESC').all() as any[])
    .map(mapMCQ);
}
```

- [ ] **Step 4: Add types and mapper for MCQQuestion**

```typescript
// Add interface after Card
export interface MCQQuestion {
  id: number;
  noteId: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
  createdAt: string;
}

// Add after mapCard function
function mapMCQ(row: any): MCQQuestion {
  return {
    id: row.id,
    noteId: row.note_id,
    question: row.question,
    options: JSON.parse(row.options_json),
    correctIndex: row.correct_index,
    explanation: row.explanation,
    tags: JSON.parse(row.tags_json),
    createdAt: row.created_at
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test test/database.test.ts -t "MCQ"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/database.ts test/database.test.ts
git commit -m "feat: add mcq_questions table and database methods"
```

---

### Task 3: Modify generate routes to also create MCQs

**Files:**
- Modify: `src/app/api/notes/[id]/generate/route.ts`
- Modify: `src/app/api/notes/generate-all/route.ts`
- Test: `test/route.test.ts`

- [ ] **Step 1: Write test for MCQ generation in generate-all route**

```typescript
// Add to test/route.test.ts
test('generate-all route creates MCQs alongside drafts', async () => {
  const { createAppDatabase } = await import('../src/lib/database');
  const testDb = createAppDatabase();
  testDb.upsertNote({
    notionPageId: 'mcq-gen-page-1',
    title: 'MCQ Generation Test',
    content: 'This content verifies that calling generate-all produces both drafts and MCQ questions.',
    tags: ['Test'],
  });
  testDb.close();

  const mod = await import('../src/app/api/notes/generate-all/route');
  const req = new NextRequest('http://localhost/api/notes/generate-all', {
    method: 'POST', body: JSON.stringify({}),
  });
  const res = await mod.POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('mcqs');
  expect(Array.isArray(body.mcqs)).toBe(true);
  expect(body.mcqs.length).toBeGreaterThanOrEqual(1);
  expect(body.mcqs[0]).toHaveProperty('question');
  expect(body.mcqs[0]).toHaveProperty('options');

  const cleanDb = createAppDatabase();
  cleanDb.db.prepare('DELETE FROM reviews').run();
  cleanDb.db.prepare('DELETE FROM schedules').run();
  cleanDb.db.prepare('DELETE FROM cards').run();
  cleanDb.db.prepare('DELETE FROM card_drafts').run();
  cleanDb.db.prepare('DELETE FROM mcq_questions').run();
  cleanDb.db.prepare('DELETE FROM notes').run();
  cleanDb.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/route.test.ts -t "MCQ"`
Expected: FAIL — response has no `mcqs` property

- [ ] **Step 3: Modify generate routes to call generateMCQs**

```typescript
// src/app/api/notes/[id]/generate/route.ts — full file:
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAppDatabase();
  try {
    const note = db.getNote(Number(id));
    if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const [drafts, mcqs] = await Promise.all([
      aiProvider.generateCards(note),
      aiProvider.generateMCQs(note),
    ]);
    const savedDrafts = db.createDrafts(note.id, drafts);
    const savedMCQs = db.createMCQs(note.id, mcqs);
    return NextResponse.json({ drafts: savedDrafts, mcqs: savedMCQs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

```typescript
// src/app/api/notes/generate-all/route.ts — full file:
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const notes = db.listNotes();
    if (notes.length === 0) {
      return NextResponse.json({ error: 'No notes synced yet.' }, { status: 400 });
    }
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const allDrafts: any[] = [];
    const allMCQs: any[] = [];
    for (const note of notes) {
      const [drafts, mcqs] = await Promise.all([
        aiProvider.generateCards(note),
        aiProvider.generateMCQs(note),
      ]);
      allDrafts.push(...db.createDrafts(note.id, drafts));
      allMCQs.push(...db.createMCQs(note.id, mcqs));
    }
    return NextResponse.json({ drafts: allDrafts, mcqs: allMCQs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/route.test.ts -t "MCQ"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notes/\[id\]/generate/route.ts src/app/api/notes/generate-all/route.ts test/route.test.ts
git commit -m "feat: generate MCQs alongside drafts in generate routes"
```

---

### Task 4: Add MCQs to state API response

**Files:**
- Modify: `src/app/api/state/route.ts`
- Test: `test/route.test.ts`

- [ ] **Step 1: Update state route test to expect mcqs**

```typescript
// Modify existing test in test/route.test.ts — change the assertion block
test('state route returns valid JSON', async () => {
  const mod = await import('../src/app/api/state/route');
  const res = await mod.GET(new NextRequest('http://localhost/api/state'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('stats');
  expect(body).toHaveProperty('notes');
  expect(body).toHaveProperty('drafts');
  expect(body).toHaveProperty('cards');
  expect(body).toHaveProperty('dueCards');
  expect(body).toHaveProperty('reviews');
  expect(body).toHaveProperty('mcqs');           // NEW
  expect(Array.isArray(body.mcqs)).toBe(true);   // NEW
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/route.test.ts -t "state route"`
Expected: FAIL — no `mcqs` property

- [ ] **Step 3: Modify state route to include mcqs**

```typescript
// In src/app/api/state/route.ts, add after const reviews = db.listReviews():
const mcqs = db.listMCQs();

// Update the response JSON:
return NextResponse.json({ stats, notes, drafts, cards, dueCards, reviews, mcqs });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/route.test.ts -t "state route"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/state/route.ts test/route.test.ts
git commit -m "feat: include mcqs in state API response"
```

---

### Task 5: Wire up page.tsx to load real MCQs

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update page.tsx to load MCQs from state**

```typescript
// In the state initialization section, change:
const [mcqCards, setMcqCards] = useState<any[]>([]);

// In loadState(), add after setReviews(data.reviews):
if (data.mcqs) setMcqCards(data.mcqs);

// Remove mockMCQs import — the mcqCards state variable replaces it entirely
// Remove:   mockMCQs,
// Remove:   const mcqCards: any[] = USE_MOCK ? mockMCQs : [];
// The mcqCards is now always managed by state
```

Full changes:

```typescript
// Delete from imports (line 18):
mockMCQs,

// Remove the mock variable (line 40):
// OLD: const mcqCards: any[] = USE_MOCK ? mockMCQs : [];

// Add state variable after setSettings:
const [mcqCards, setMcqCards] = useState<any[]>([]);

// In loadState, add after setReviews(data.reviews):
if (data.mcqs) setMcqCards(data.mcqs);
```

- [ ] **Step 2: Verify the build passes**

Run: `bun run lint`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: load real MCQs from state API in page.tsx"
```

---

### Task 6: Remove mockMCQs from mock-data

**Files:**
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 1: Delete mockMCQs array and its export**

Remove lines 236-278 (the full `mockMCQs` array) and its export on line 19.

- [ ] **Step 2: Verify build**

Run: `bun run lint`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock-data.ts
git commit -m "chore: remove unused mockMCQs (no longer needed)"
```

---

### Task 7: Run full test suite and verify

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: all pass

- [ ] **Step 2: If any tests fail, fix them**

Check test output and fix any regressions.

- [ ] **Step 3: Run lint check**

Run: `bun run lint`
Expected: clean

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: test and lint fixes after MCQ generation"
```
