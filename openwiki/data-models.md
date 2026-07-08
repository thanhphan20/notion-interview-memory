# Data Models

This page documents the SQLite schema, key data structures, and how data flows through the system.

## Database Schema

All data is stored in SQLite at `data/app.sqlite`. The schema is version-controlled via numbered migrations in `src/migrations/`.

### Tables

#### `settings` (Key/Value Store)

Stores application configuration and state.

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PRIMARY KEY | Config key (e.g., `notion_db_id`, `ai_config`, `interview_date`) |
| `value` | TEXT NOT NULL | JSON-encoded value |

**Example rows**:

```sql
INSERT INTO settings (key, value) VALUES ('interview_date', '"2026-08-15"');
INSERT INTO settings (key, value) VALUES ('ai_config', '{"provider":"openai","apiKey":"sk-...","model":"gpt-4-mini"}');
INSERT INTO settings (key, value) VALUES ('notion_db_id', '"abc123def"');
```

**Key names**:
- `interview_date` — Target interview date (ISO 8601 string or null)
- `ai_config` — AI provider settings (JSON)
- `notion_config` — Notion database settings (JSON)

#### `notes` (Synced Notion Pages)

Stores synced pages from the user's Notion database.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `notion_page_id` | TEXT NOT NULL UNIQUE | Notion page UUID |
| `title` | TEXT NOT NULL | Page title from Notion |
| `content` | TEXT NOT NULL | Markdown content (extracted from Notion blocks) |
| `source_url` | TEXT NOT NULL | Notion page URL |
| `tags_json` | TEXT NOT NULL | JSON array of tags/topics |
| `notion_last_edited_time` | TEXT NOT NULL | ISO 8601 timestamp from Notion |
| `synced_at` | TEXT NOT NULL | ISO 8601 timestamp of local sync |

**Example row**:

```sql
INSERT INTO notes (
  notion_page_id, title, content, source_url, tags_json, notion_last_edited_time, synced_at
) VALUES (
  'abc-123-def-456',
  'Binary Search Tree Basics',
  '# Binary Search Tree...\n\n## Definition...',
  'https://notion.so/abc-123-def-456',
  '["data-structures","algorithms"]',
  '2026-07-01T14:30:00Z',
  '2026-07-01T14:35:00Z'
);
```

#### `card_drafts` (AI-Generated Card Candidates)

Stores AI-generated open-recall card drafts pending approval.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `note_id` | INTEGER NOT NULL | Foreign key to `notes` (CASCADE delete) |
| `question` | TEXT NOT NULL | Open-recall question |
| `expected_answer` | TEXT NOT NULL | Expected/model answer |
| `rubric_json` | TEXT NOT NULL | JSON array of grading criteria |
| `tags_json` | TEXT NOT NULL | JSON array of tags (inherited from note) |
| `status` | TEXT NOT NULL | `'draft'` (pending), `'approved'`, or `'rejected'` |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Example row**:

```sql
INSERT INTO card_drafts (
  note_id, question, expected_answer, rubric_json, tags_json, status, created_at
) VALUES (
  1,
  'Describe the time complexity of searching in a binary search tree.',
  'O(log n) average case; O(n) worst case if unbalanced. Uses divide-and-conquer.',
  '["mentions time complexity","distinguishes average vs worst","explains why"]',
  '["data-structures","algorithms"]',
  'draft',
  '2026-07-01T14:40:00Z'
);
```

#### `cards` (Approved Study Cards)

Stores approved open-recall cards that are actively used in practice.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `note_id` | INTEGER NOT NULL | Foreign key to `notes` (CASCADE delete) |
| `source_draft_id` | INTEGER UNIQUE | Foreign key to `card_drafts` (nullable; tracks lineage) |
| `question` | TEXT NOT NULL | Open-recall question |
| `expected_answer` | TEXT NOT NULL | Expected/model answer |
| `rubric_json` | TEXT NOT NULL | JSON array of grading criteria |
| `tags_json` | TEXT NOT NULL | JSON array of tags |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Example row**:

```sql
INSERT INTO cards (
  note_id, source_draft_id, question, expected_answer, rubric_json, tags_json, created_at
) VALUES (
  1,
  42,
  'Describe the time complexity of searching in a binary search tree.',
  'O(log n) average case; O(n) worst case if unbalanced.',
  '["mentions time complexity","distinguishes average vs worst"]',
  '["data-structures","algorithms"]',
  '2026-07-01T14:40:00Z'
);
```

**Note**: Unlike drafts, a card does not have a status column. Approved cards are in the `cards` table; drafts remain in `card_drafts`.

#### `schedules` (FSRS Scheduling State)

Stores spaced-repetition scheduling state for each card.

| Column | Type | Notes |
|--------|------|-------|
| `card_id` | INTEGER PRIMARY KEY | Foreign key to `cards` (CASCADE delete) |
| `due_at` | TEXT NOT NULL | ISO 8601 timestamp; when card is due |
| `stability` | REAL NOT NULL | FSRS stability (how well-learned) |
| `difficulty` | REAL NOT NULL | FSRS difficulty (how hard the card is) |
| `elapsed_days` | INTEGER NOT NULL | Days since creation |
| `scheduled_days` | INTEGER NOT NULL | Days until next review |
| `reps` | INTEGER NOT NULL | Total number of reviews completed |
| `lapses` | INTEGER NOT NULL | Number of `'again'` ratings |
| `state` | TEXT NOT NULL | `'new'` or `'review'` |
| `last_reviewed_at` | TEXT | ISO 8601 timestamp of last review |

**Example row**:

```sql
INSERT INTO schedules (
  card_id, due_at, stability, difficulty, elapsed_days, scheduled_days,
  reps, lapses, state, last_reviewed_at
) VALUES (
  1,
  '2026-07-05T10:00:00Z',  -- due in 4 days
  1.8,                       -- learned fairly well
  4.2,                       -- moderate difficulty
  0,
  4,
  1,
  0,
  'review',
  '2026-07-01T10:00:00Z'
);
```

**FSRS Terminology**:
- **Stability**: How stable the memory is (higher = more resistant to forgetting)
- **Difficulty**: Subjective difficulty of the card (1–10 scale)
- **Reps**: Total reviews completed
- **Lapses**: Times the user rated `'again'` (forgot the card)
- **State**: `'new'` = never reviewed; `'review'` = been reviewed at least once

#### `reviews` (Open-Recall Practice Attempts)

Stores every open-recall practice attempt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `card_id` | INTEGER NOT NULL | Foreign key to `cards` (CASCADE delete) |
| `user_answer` | TEXT NOT NULL | User's typed answer |
| `ai_feedback_json` | TEXT | Optional JSON object with AI critique |
| `rating` | TEXT NOT NULL | Self-grade: `'again'`, `'hard'`, `'good'`, `'easy'` |
| `elapsed_seconds` | INTEGER NOT NULL | Time spent on this card |
| `reviewed_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Example row**:

```sql
INSERT INTO reviews (
  card_id, user_answer, ai_feedback_json, rating, elapsed_seconds, reviewed_at
) VALUES (
  1,
  'Binary search trees have O(log n) for balanced trees, O(n) worst case.',
  '{"summary":"Good understanding, but missed mention of balancing techniques","missingKeyPoints":["Red-Black trees","AVL trees"],"suggestedRating":"good"}',
  'good',
  92,
  '2026-07-01T14:50:00Z'
);
```

**AI Feedback Schema** (when present):

```json
{
  "summary": "string; high-level assessment of the answer",
  "missingKeyPoints": ["string", "..."],
  "suggestedRating": "'again' | 'hard' | 'good' | 'easy'"
}
```

**Important**: The user's self-selected `rating` is the only input to the scheduler. The AI's `suggestedRating` is advisory only and never overrides the user's choice.

#### `mcq_questions` (Multiple-Choice Questions)

Stores AI-generated MCQs that are auto-approved and ready to practice.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `note_id` | INTEGER NOT NULL | Foreign key to `notes` (CASCADE delete) |
| `question` | TEXT NOT NULL | MCQ question text |
| `options` | TEXT NOT NULL | JSON array of 4 option strings |
| `correct_index` | INTEGER NOT NULL | 0-indexed position of correct option |
| `explanation` | TEXT NOT NULL | Why the correct answer is right |
| `tags_json` | TEXT NOT NULL | JSON array of tags (inherited from note) |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Example row**:

```sql
INSERT INTO mcq_questions (
  note_id, question, options, correct_index, explanation, tags_json, created_at
) VALUES (
  1,
  'What is the average-case time complexity of searching in a balanced BST?',
  '["O(log n)","O(n)","O(n log n)","O(n²)"]',
  0,
  'A balanced BST has height log(n), so each level eliminates half the remaining nodes.',
  '["data-structures","algorithms"]',
  '2026-07-01T14:42:00Z'
);
```

#### `mcq_reviews` (MCQ Practice Attempts)

Stores every MCQ practice attempt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `mcq_id` | INTEGER NOT NULL | Foreign key to `mcq_questions` (CASCADE delete) |
| `selected_index` | INTEGER NOT NULL | 0-indexed option the user selected |
| `correct_index` | INTEGER NOT NULL | 0-indexed position of correct answer (denormalized from mcq_questions for history) |
| `reviewed_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Example row**:

```sql
INSERT INTO mcq_reviews (
  mcq_id, selected_index, correct_index, reviewed_at
) VALUES (
  1,
  0,  -- user selected "O(log n)"
  0,  -- correct answer is "O(log n)"
  '2026-07-01T15:10:00Z'
);
```

#### `sprints` (20-Item Sprint Sessions)

Stores sprint sessions (fixed 20-item time-pressured reviews).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `started_at` | TEXT NOT NULL | ISO 8601 timestamp when sprint started |
| `completed_at` | TEXT | ISO 8601 timestamp when sprint completed (null if abandoned) |
| `card_ids` | TEXT NOT NULL | JSON array of card IDs in this sprint (10 items) |
| `mcq_ids` | TEXT NOT NULL | JSON array of MCQ IDs in this sprint (10 items) |
| `score` | INTEGER | Number of correct answers (out of 20) |
| `tag_breakdown` | TEXT | JSON array of `{tag, score, total}` objects |

**Example row**:

```sql
INSERT INTO sprints (
  started_at, completed_at, card_ids, mcq_ids, score, tag_breakdown
) VALUES (
  '2026-07-02T10:00:00Z',
  '2026-07-02T10:25:00Z',
  '[1,2,3,4,5,6,7,8,9,10]',
  '[42,43,44,45,46,47,48,49,50,51]',
  16,
  '[{"tag":"data-structures","score":9,"total":12},{"tag":"algorithms","score":7,"total":8}]'
);
```

#### `mcq_diagnostics` (15-MCQ Diagnostic Sessions)

Stores diagnostic sessions (15-question weakness scanner).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `started_at` | TEXT NOT NULL | ISO 8601 timestamp when diagnostic started |
| `completed_at` | TEXT | ISO 8601 timestamp when diagnostic completed |
| `mcq_ids` | TEXT NOT NULL | JSON array of 15 MCQ IDs selected for this diagnostic |
| `score` | INTEGER | Number of correct answers (out of 15) |
| `weakness_report` | TEXT | JSON array of `{tag, wrongCount, total}` objects |

**Example row**:

```sql
INSERT INTO mcq_diagnostics (
  started_at, completed_at, mcq_ids, score, weakness_report
) VALUES (
  '2026-07-03T09:00:00Z',
  '2026-07-03T09:12:00Z',
  '[42,43,44,...,56]',
  11,
  '[{"tag":"concurrency","wrongCount":3,"total":5},{"tag":"networking","wrongCount":2,"total":4}]'
);
```

## Data Relationships

```
notes
  ├── card_drafts (one-to-many, CASCADE delete)
  ├── cards (one-to-many, CASCADE delete)
  │    ├── schedules (one-to-one, CASCADE delete, PK=card_id)
  │    └── reviews (one-to-many, CASCADE delete)
  └── mcq_questions (one-to-many, CASCADE delete)
       └── mcq_reviews (one-to-many, CASCADE delete)

settings (key-value store, no foreign keys)
sprints (not linked to cards/mcqs directly; just stores IDs as JSON)
mcq_diagnostics (not linked to mcqs directly; just stores IDs as JSON)
card_drafts
  └── cards (one-to-one via source_draft_id, UNIQUE)
```

**Cascade Delete**: When a note is deleted, all child notes, card_drafts, cards, schedules, reviews, mcq_questions, and mcq_reviews are automatically deleted.

**Denormalization**: `mcq_reviews` stores `correct_index` even though it can be joined from `mcq_questions`. This is intentional for history queries; it preserves the correct answer even if the MCQ is updated or deleted.

## Key Data Structures in Code

### TypeScript Interfaces (from `src/lib/database.ts`)

```typescript
export interface Note {
  id: number;
  notionPageId: string;
  title: string;
  content: string;
  sourceUrl: string;
  tags: string[];
  notionLastEditedTime: string;
  syncedAt: string;
}

export interface Draft {
  id: number;
  noteId: number;
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
  status: string;
  createdAt: string;
}

export interface Card {
  id: number;
  noteId: number;
  sourceDraftId: number | null;
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
  createdAt: string;
}

export interface Review {
  id: number;
  cardId: number;
  userAnswer: string;
  aiFeedback: any;
  rating: string;
  elapsedSeconds: number;
  reviewedAt: string;
  tags?: string[];
}

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

export interface MCQReview {
  id: number;
  mcqId: number;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  correct: boolean;
  reviewedAt: string;
  tags?: string[];
}

export interface Schedule {
  cardId: number;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: ScheduleState;
  lastReviewedAt: string | null;
}

export interface Sprint {
  id: number;
  startedAt: string;
  completedAt: string | null;
  cardIds: number[];
  mcqIds: number[];
  score: number | null;
  tagBreakdown: SprintTagBreakdown[] | null;
}

export interface MCQDiagnostic {
  id: number;
  startedAt: string;
  completedAt: string | null;
  mcqIds: number[];
  score: number | null;
  weaknessReport: WeaknessReportEntry[] | null;
}
```

## Data Flow Examples

### Adding a Card from Notion

1. **Notion Sync** (`POST /api/notion/sync`):
   - Fetch pages from user's Notion database
   - Extract title, content (block children), tags
   - For each page not already in `notes`, insert row
   - For each page that exists, update content if changed

2. **Generate Drafts** (`POST /api/notes/:id/generate`):
   - Fetch note from `notes` table
   - Send to AI provider → get CardDraft[] and MCQ[]
   - Insert each CardDraft into `card_drafts` with status='draft'
   - Insert each MCQ into `mcq_questions` (auto-approved, no status column)

3. **Approve Draft** (`POST /api/drafts/:id/approve`):
   - Fetch draft from `card_drafts`
   - Insert new row into `cards` with same question/answer/rubric/tags
   - Create initial schedule: `createInitialSchedule(cardId)` → insert into `schedules`
   - Update draft status to 'approved'
   - Card is now due immediately and available for practice

4. **First Review** (`POST /api/cards/:id/review`):
   - Fetch card and schedule
   - Fetch expected answer, rubric
   - User submits answer + rating
   - Call `gradeReview(schedule, rating)` → new FSRS schedule
   - If interview date set, call `applyInterviewDateClamp(schedule, interviewDate, now)`
   - Insert review record into `reviews`
   - Update schedule row in `schedules` with new due_at, stability, reps, etc.

### Running a Diagnostic

1. **Start** (`POST /api/mcq-diagnostics`):
   - Fetch all MCQs: `SELECT * FROM mcq_questions`
   - Fetch MCQ review history: `SELECT * FROM mcq_reviews`
   - Call `pickDiagnosticMCQs(mcqs, reviews)` → 15 cold-weighted MCQs
   - Insert row into `mcq_diagnostics` with mcqIds, startedAt
   - Return session to UI

2. **Answer MCQ** (`POST /api/mcqs/:id/review`):
   - User selects option index
   - Insert row into `mcq_reviews` with selectedIndex, correct_index, timestamp
   - Return result to UI

3. **Complete** (`POST /api/mcq-diagnostics/:id/complete`):
   - Fetch diagnostic from `mcq_diagnostics`
   - Fetch all mcq_reviews for this diagnostic's mcqIds
   - Count correct per tag
   - Call `computeWeaknessReport(reviews)` → sorted by wrong rate
   - Update diagnostic row: completedAt, score, weaknessReport
   - Return weakness report to UI
   - User clicks drill → route to OpenRecallView filtered to weak tags

### Calculating Dashboard

1. **Fetch Dashboard** (`GET /api/dashboard`):
   - Fetch all cards: `SELECT * FROM cards`
   - Fetch all reviews: `SELECT * FROM reviews`
   - Fetch all schedules: `SELECT * FROM schedules`
   - Fetch interview date: `SELECT value FROM settings WHERE key='interview_date'`

2. **Compute Heatmap** (pure function):
   - For each unique tag, collect cards with that tag
   - For each card, find last 3 reviews
   - Calculate retention % = correct / 3
   - Determine status (green/yellow/red/cold)
   - Calculate trend (recent vs older)

3. **Compute Due Queue**:
   - Filter schedules where `due_at <= now`
   - Count distinct cards

4. **Compute Lapses**:
   - Filter reviews where `rating in ('again', 'hard')` and `reviewedAt >= now - 7 days`
   - Group by card, take most recent per card
   - Return cards with lapse info

5. **Compute Countdown**:
   - If interview date set, calculate days remaining
   - Fetch sprint results and calculate rolling average score
   - Calculate % of tags in green (retention >= 0.80)

6. **Return Dashboard Payload**:

```json
{
  "countdown": {
    "daysUntilInterview": 14,
    "sprintAverage": 78.5,
    "percentGreen": 65
  },
  "heatmap": [
    {"tag": "data-structures", "retentionRate": 0.85, "status": "green", "trend": "↗", "cardCount": 12},
    {"tag": "algorithms", "retentionRate": 0.65, "status": "yellow", "trend": "↘", "cardCount": 8}
  ],
  "lapses": [
    {"id": 42, "question": "...", "tags": ["algorithms"], "lastReviewedAt": "..."}
  ],
  "dueQueue": [
    {"id": 1, "question": "...", "tags": ["data-structures"]}
  ]
}
```

## Data Integrity

### Foreign Key Constraints

All foreign keys are enforced with `PRAGMA foreign_keys = ON`:

```typescript
sqlite.run('PRAGMA foreign_keys = ON');
```

Deleting a note cascades to:
- `card_drafts` (status='draft' disappears)
- `cards` (approved cards disappear)
- `schedules` (all schedules disappear)
- `reviews` (all reviews disappear)
- `mcq_questions` (all MCQs disappear)
- `mcq_reviews` (all MCQ review history disappears)

### Unique Constraints

- `notes.notion_page_id` is UNIQUE (prevent duplicate syncs)
- `card_drafts.source_draft_id` is UNIQUE in `cards` (one card per draft at most)
- `schedules.card_id` is PRIMARY KEY (one schedule per card)

### Not-Null Constraints

All critical fields are NOT NULL (see schema above).

## Backward Compatibility

Schema changes are applied via migrations. Once a migration is applied and deployed, it must never be modified or deleted. New changes are new migrations. This ensures:

- Existing databases can be upgraded incrementally
- No data loss between versions
- Deterministic schema evolution

See `src/migrations/` for the history of schema changes.
