# Batch Generate All Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Generate from All" button that creates draft cards from every synced note in one action.

**Architecture:** New `POST /api/notes/generate-all` route iterates all notes, calls AI once per note, saves all drafts. Client-side handler calls it and navigates to Drafts view.

**Tech Stack:** Next.js 14 API route, AI provider (offline/OpenAI-compatible), bun:sqlite.

---

### Task 1: Add test for generate-all route

**Files:**
- Modify: `test/route.test.ts`
- Create: `src/app/api/notes/generate-all/route.ts`

- [ ] **Step 1: Write failing test**

Add to `test/route.test.ts`:

```typescript
test('generate-all route creates drafts from all notes', async () => {
  global.fetch = mock(async (url: string) => {
    if (url.includes('databases')) {
      return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 });
    }
    if (url.includes('blocks')) {
      return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 });
    }
    if (url.includes('chat/completions')) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          cards: [{
            question: 'Test question?',
            expectedAnswer: 'Test answer.',
            rubric: ['Key point 1'],
            tags: ['Test']
          }]
        }) } }]
      }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });

  // First sync a note so there's data
  const modSync = await import('../src/app/api/notion/sync/route');
  const reqSync = new NextRequest('http://localhost/api/notion/sync', {
    method: 'POST',
    body: JSON.stringify({ token: 'fake', databaseId: 'fake' })
  });
  await modSync.POST(reqSync);

  // Now call generate-all
  const modGen = await import('../src/app/api/notes/generate-all/route');
  const reqGen = new NextRequest('http://localhost/api/notes/generate-all', {
    method: 'POST',
    body: JSON.stringify({})
  });
  const res = await modGen.POST(reqGen);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('drafts');

  global.fetch = originalFetch;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/route.test.ts`
Expected: FAIL — module not found for generate-all route

- [ ] **Step 3: Create route handler**

Create `src/app/api/notes/generate-all/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const targetCount = Math.min(Math.max(Number(body.count) || 20, 1), 50);
    const notes = db.listNotes();
    if (notes.length === 0) {
      return NextResponse.json({ error: 'No notes synced yet.' }, { status: 400 });
    }
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const allDrafts: any[] = [];
    for (const note of notes) {
      const generated = await aiProvider.generateCards(note);
      const saved = db.createDrafts(note.id, generated);
      allDrafts.push(...saved);
    }
    return NextResponse.json({ drafts: allDrafts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/route.test.ts`
Expected: PASS (both state, sync, and generate-all tests)

- [ ] **Step 5: Commit**

```
git add test/route.test.ts src/app/api/notes/generate-all/route.ts
git commit -m "feat: add batch generate-all API route"
```

### Task 2: Wire up UI handler and button

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/NotesView.tsx`

- [ ] **Step 1: Add handler in page.tsx**

After `handleGenerateDrafts` (around line 160), add:

```typescript
async function handleGenerateAllDrafts() {
  triggerStatus('Generating drafts from all notes...');
  try {
    const result = await api('/api/notes/generate-all', { method: 'POST', body: {} });
    triggerStatus(`Generated ${result.drafts.length} drafts.`);
    await loadState();
    setView('drafts');
  } catch (err: any) {
    triggerStatus(err.message, true);
  }
}
```

Also pass `onGenerateAll={handleGenerateAllDrafts}` to NotesView.

- [ ] **Step 2: Add button to NotesView.tsx**

Add `onGenerateAll` prop to NotesViewProps, then add a second button in the section heading next to "Sync Notion":

```tsx
<div className="section-heading">
  <div>
    <h2>Notion Notes</h2>
    <p className="muted">Sync selected topics, then generate interview questions.</p>
  </div>
  <div className="actions" style={{ gap: '0.5rem' }}>
    <Button onClick={onGenerateAll}>Generate from All</Button>
    <Button variant="secondary" onClick={onSync}>Sync Notion</Button>
  </div>
</div>
```

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: All 16 tests pass (15 existing + 1 new generate-all test)

- [ ] **Step 4: Commit**

```
git add src/app/page.tsx src/components/NotesView.tsx
git commit -m "feat: add generate-from-all button to Notes view"
```
