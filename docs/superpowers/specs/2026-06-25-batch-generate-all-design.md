# Batch Generate All Design

> **Goal:** Add a button that generates 10-20 draft cards from all synced notes in one action.

**Architecture:** New `POST /api/notes/generate-all` server route that iterates all notes, calls the configured AI provider once per note, saves all drafts to SQLite, and returns them. No changes to AI provider interface or existing per-note generate flow.

**Tech Stack:** Next.js 14 API route, same AI provider (offline/OpenAI-compatible), bun:sqlite.

---

### API Contract

**`POST /api/notes/generate-all`**

- Request body: `{ count?: number }` (default 20, hint for AI provider)
- Response: `{ drafts: Draft[] }` — all newly created drafts
- Error: `{ error: string }` with status 400

### Distribution

The route calls `aiProvider.generateCards(note)` once per synced note. The offline provider produces 1 card per call; the OpenAI provider typically produces 2-5. With 5-20 notes, the total naturally falls in the 10-20 range.

### UI Changes

- **NotesView.tsx:** Add "Generate from All" button in the section heading, next to "Sync Notion"
- **page.tsx:** Add `handleGenerateAllDrafts` handler — calls the new route, shows status toast, reloads state, navigates to Drafts view

### Files

- **Create:** `src/app/api/notes/generate-all/route.ts` — batch generation route
- **Modify:** `src/components/NotesView.tsx` — add button
- **Modify:** `src/app/page.tsx` — add handler
- **Modify:** `test/route.test.ts` — add test for new route
