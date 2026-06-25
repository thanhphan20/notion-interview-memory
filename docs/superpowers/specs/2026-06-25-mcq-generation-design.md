# MCQ Generation Design

**Goal:** Generate MCQ questions from synced notes alongside open-recall card drafts, auto-approved and available immediately in MCQ practice mode.

**Architecture:** New `generateMCQs(note)` method on the AI provider. Generated during draft generation (per-note and batch). Stored in new `mcq_questions` table. Served via state API to the MCQ practice tab.

### AI Provider

```typescript
interface MCQ {
  question: string;
  options: string[];       // 4 options
  correctIndex: number;    // index into options
  explanation: string;
  tags: string[];
}

interface AiProvider {
  generateCards(note: NoteInput): Promise<CardDraft[]>;
  generateMCQs(note: NoteInput): Promise<MCQ[]>;          // NEW
  critiqueAnswer(input: CritiqueInput): Promise<AnswerCritique>;
}
```

- **Offline:** Generates 1 MCQ per call (first-sentence → question + 1 correct + 3 distractor options)
- **Groq/OpenAI:** Generates 2-3 MCQs per call with proper distractors and explanations

### Database

```sql
CREATE TABLE IF NOT EXISTS mcq_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,     -- JSON array of 4 strings
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

Methods: `createMCQs(noteId, mcqs)` inserts all, `listMCQs()` returns all for practice mode.

### Generation Flow

- `POST /api/notes/[id]/generate` — generates open-recall drafts AND MCQs, saves both
- `POST /api/notes/generate-all` — same for all notes (already handles iteration)
- MCQs auto-approve (no draft queue), available immediately

### Practice View

- MCQ tab reads from `mcq_questions` table via the state API
- Removes dependency on `mockMCQs` entirely
- After answering all MCQs, shows "Completed all MCQs" state

### Files

- **Modify:** `src/lib/ai.ts` — add `MCQ` type, `generateMCQs` to interface, offline impl, Groq/OpenAI impl
- **Modify:** `src/lib/database.ts` — migration + `createMCQs` + `listMCQs`
- **Modify:** `src/app/api/notes/[id]/generate/route.ts` — also generate MCQs
- **Modify:** `src/app/api/notes/generate-all/route.ts` — also generate MCQs
- **Modify:** `src/app/api/state/route.ts` — include `mcqs` in response
- **Modify:** `src/app/page.tsx` — load real MCQs from state, remove mockMCQs usage
- **Modify:** `src/components/PracticeView.tsx` — pass real MCQs
- **Modify:** `src/lib/mock-data.ts` — keep mockMCQs for reference but no longer used in page.tsx
