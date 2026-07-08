# Architecture

## Layered Design

The application is organized into distinct layers with clear responsibilities and minimal coupling:

```
┌──────────────────────────────────────────┐
│  UI Layer (React Components)             │
│  src/components/*.tsx                    │
├──────────────────────────────────────────┤
│  State Layer (SPA State Management)      │
│  src/hooks/useAppState.ts                │
├──────────────────────────────────────────┤
│  API Layer (REST Endpoints)              │
│  src/app/api/*/route.ts                  │
├──────────────────────────────────────────┤
│  Logic Layer (Pure Functions)            │
│  src/lib/*.ts (scheduler, heatmap, etc.) │
├──────────────────────────────────────────┤
│  Data Layer (SQLite CRUD)                │
│  src/lib/database.ts                     │
├──────────────────────────────────────────┤
│  Database (bun:sqlite)                   │
│  data/app.sqlite                         │
└──────────────────────────────────────────┘
```

### UI Layer

**Files**: `src/components/*.tsx`, `src/app/page.tsx`, `src/app/globals.css`

Renders the user interface. Responsibilities:

- Component composition and layout (Sidebar, TopBar, main views)
- User interaction (clicks, form inputs, keyboard events)
- Real-time visual feedback (buttons disabled during load, status messages)
- Displaying data from the state layer
- Delegating actions to event handlers in `useAppState`

**Key components**:

- `page.tsx` — SPA shell; thin routing layer mapping view type to component
- `DashboardView.tsx` — Home dashboard (countdown, heatmap, lapses, due queue)
- `OpenRecallView.tsx` — Open-recall practice interface
- `MCQPracticeView.tsx` — Diagnostic mode (15 MCQs with weakness report)
- `SprintView.tsx` — 20-item timed sprint
- `DraftsView.tsx` — Draft approval queue
- `SettingsView.tsx` — Configuration form for Notion and AI
- `ui/` — Reusable primitives (Button, Card, Tag, Toast, MetricCard)

**Design Constraints**:

- No business logic in components; all logic delegated to state layer or API layer
- No direct database access
- Mock data and real API hidden behind a facade (`api-client.ts`)
- Components are controlled by props and callbacks

### State Layer

**File**: `src/hooks/useAppState.ts`

Manages the entire application state using React hooks and implements event handlers. Responsibilities:

- Holds all state (view, cards, drafts, reviews, settings, etc.) via `useState`
- Fetches data from the API layer via `api-client`
- Handles user actions (review submission, draft approval, settings save, etc.)
- Coordinates complex workflows (sprint completion, diagnostic results, etc.)
- Manages UI feedback (status messages, error handling)

**Key state groups**:

- **View state**: Current view (`dashboard`, `practice`, `sprint`, `diagnostic`, etc.)
- **Data state**: Cards, drafts, MCQs, reviews, notes, settings
- **Session state**: Current sprint/diagnostic session, current card being reviewed
- **UI state**: Active card, user answer text, showing answer key, filter tag
- **Feedback state**: Status messages, provider check results

**Key event handlers**:

- `handleSyncNotion()` — Trigger Notion database sync
- `handleGenerateDrafts(noteId)` — AI-generate drafts for a note
- `handleApproveDraft(id)`, `handleRejectDraft(id)` — Approve/reject drafts
- `handleSubmitReview(rating)` — Submit open-recall review
- `handleRequestCritique()` — Request AI critique
- `handleStartSprint()`, `handleCompleteSprint()` — Sprint lifecycle
- `handleStartDiagnostic()`, `handleCompleteDiagnostic()` — Diagnostic lifecycle
- `handleSetInterviewDate(date)` — Update interview date

**API client isolation**:

- `getApiClient()` returns either mock or real implementation based on `USE_MOCK` flag
- All API calls go through this facade
- Enables seamless switching between offline (UI development) and online (real backend) modes

### API Layer

**Directory**: `src/app/api/*/route.ts`

Next.js API route handlers that implement REST endpoints. Responsibilities:

- Parse HTTP requests and extract parameters
- Validate inputs
- Call business logic functions
- Call database CRUD methods
- Return JSON responses
- Error handling and status codes

**Endpoints** (see [API Reference](./api-reference.md) for full details):

- `GET /api/state` — Whole-app state snapshot (for mock/testing)
- `GET /api/dashboard` — Dashboard payload (countdown + heatmap + lapses + due queue)
- `GET /api/cards` — List cards; `POST` to create
- `GET /api/drafts` — List drafts; `POST /api/drafts/:id/approve` to approve
- `POST /api/cards/:id/review` — Submit open-recall review
- `POST /api/cards/:id/critique` — Request AI critique
- `GET /api/mcqs` — List MCQs; `POST /api/mcqs/:id/review` to answer
- `POST /api/sprints` — Start sprint; `/api/sprints/:id/complete` to finish
- `POST /api/mcq-diagnostics` — Start diagnostic; `/api/mcq-diagnostics/:id/complete` to finish
- `GET /api/interview-date`, `POST /api/interview-date` — Get/set interview date
- `POST /api/notion/sync` — Sync Notion database
- `POST /api/settings` — Save settings
- `GET /api/notes` — List synced notes

**Design principle**: Routes are stateless functions that read from database, apply logic, and write results. No state persisted in memory across requests.

### Logic Layer

**Directory**: `src/lib/*.ts` (excluding `database.ts`, `api-client.ts`, `mock-data.ts`)

Pure, deterministic functions implementing business logic. Responsibilities:

- FSRS scheduling calculations
- Interview-date clamping
- Heatmap retention calculations
- Sprint and diagnostic selection algorithms
- Weakness report scoring
- AI provider abstraction
- Notion API interaction

**Key modules**:

| Module | Purpose |
|--------|---------|
| `scheduler.ts` | FSRS scheduling, gradeReview, interview-date clamping |
| `heatmap.ts` | Compute retention % per tag, identify cold tags |
| `sprint.ts` | Select 20 sprint items (10 open-recall + 10 MCQ) with tag weighting |
| `mcq-diagnostic.ts` | Select 15 diagnostic MCQs, compute weakness report |
| `lapses.ts` | Find cards rated "again" or "hard" within time window |
| `countdown.ts` | Assemble dashboard countdown payload |
| `ai.ts` | AI provider interface, output parsing, prompt engineering |
| `ai-models.ts` | Model info for different providers (pricing, context tokens) |
| `notion.ts` | Notion API client, database filters, block mapping |
| `compress.ts` | Input compression to save tokens before AI calls |

**Design principle**: Pure functions with no side effects. Given the same inputs, always produce the same output. Testable in isolation without database or network.

### Data Layer

**File**: `src/lib/database.ts`

SQLite CRUD operations and schema management. Responsibilities:

- Create `AppDatabase` instance with connection pooling
- Implement CRUD methods for notes, cards, drafts, reviews, MCQs, sprints, diagnostics
- Run migrations on app startup
- Enforce foreign key constraints and data integrity

**Key classes & methods**:

- `AppDatabase` — Main class wrapping a bun:sqlite `Database` instance
- `getSetting<T>(key)`, `setSetting<T>(key, value)` — Key/value config store (Notion URL, AI settings, interview date)
- `getNotes()`, `addNote()`, `updateNote()` — Note CRUD
- `getDrafts()`, `addDraft()`, `approveDraft()`, `rejectDraft()` — Draft CRUD
- `getCards()`, `createCard()` — Card CRUD
- `getSchedules()`, `createSchedule()`, `recordReview()` — Schedule and review CRUD
- `getMCQQuestions()`, `addMCQQuestion()` — MCQ CRUD
- `recordMCQReview()` — Record MCQ answer
- `getStats()` — Aggregate counts (due, drafts, reviews)

**Interview-date clamping integration**:

```typescript
recordReview(cardId, rating, userAnswer, aiFeedback) {
  const schedule = gradeReview(oldSchedule, rating);
  const interviewDate = this.getSetting<string>('interview_date');
  if (interviewDate) {
    schedule = applyInterviewDateClamp(schedule, interviewDate, now);
  }
  // persist schedule
}
```

**Migration system**:

- Migrations are numbered files in `src/migrations/` exporting `{id, description, up()}`
- Applied in order via a `_migrations` tracking table
- New schema changes added as new migration files, never modifying existing ones
- See [Migrations](#migrations) below.

## Data Flow

### User Answers a Card (Open-Recall)

```
1. User types answer in OpenRecallView
2. User clicks "Submit" or "Mark as Good/Easy"
3. React event handler in useAppState dispatches handleSubmitReview(rating)
4. useAppState calls api.submitReview(cardId, {answer, rating, elapsedSeconds})
5. POST /api/cards/:id/review receives request
6. Route calls database.recordReview(cardId, rating, userAnswer)
7. recordReview:
   a. Reads current schedule from database
   b. Calls gradeReview(schedule, rating) → new schedule
   c. If interview date set, calls applyInterviewDateClamp(schedule, interviewDate, now)
   d. Inserts review record into reviews table
   e. Updates schedule row in schedules table
8. Route returns updated card + new schedule
9. useAppState updates state (marks card done, advances to next card)
10. UI re-renders with next card
```

### User Approves a Draft

```
1. User sees draft in DraftsView
2. Clicks "Approve"
3. useAppState dispatches handleApproveDraft(draftId)
4. Calls api.approveDraft(draftId)
5. POST /api/drafts/:id/approve receives request
6. Route calls database.approveDraft(draftId):
   a. Updates draft status to 'approved' in card_drafts table
   b. Creates card row in cards table (question, expectedAnswer, rubric, tags, sourceDraftId)
   c. Calls createInitialSchedule(cardId) → new schedule with state='new', dueAt=now
   d. Inserts schedule into schedules table
7. Route returns new card + schedule
8. useAppState fetches updated state
9. UI shows card in due queue immediately (or on next refresh)
```

### Calculating the Dashboard Heatmap

```
1. User views Dashboard
2. useAppState calls loadState() → api.getState()
3. GET /api/dashboard returns payload with heatmap array
4. Route logic:
   a. Fetch all cards from database
   b. Fetch all reviews from database
   c. Call computeHeatmap(cards, reviews):
      - For each unique tag:
        * Collect all cards with that tag
        * For each card, get the last 3 reviews
        * Calculate retention % = (good + easy) / 3
        * Determine status: green >= 0.80, yellow 0.50-0.80, red < 0.50
        * If < 3 reviews per card, mark tag as 'cold' (grey)
        * Calculate trend arrow (comparing recent reviews to older)
5. Return heatmap array (tag, retentionRate, status, trend, cardCount)
6. useAppState.setDashboard(payload)
7. DashboardView renders HeatmapTile for each tag
```

### Running an MCQ Diagnostic

```
1. User clicks "Start Diagnostic" on Dashboard
2. useAppState dispatches handleStartDiagnostic()
3. Calls api.startMCQDiagnostic()
4. POST /api/mcq-diagnostics receives request
5. Route logic:
   a. Fetch all MCQs from database
   b. Fetch all MCQ reviews from database (to weight toward cold tags)
   c. Call pickDiagnosticMCQs(mcqs, mcqReviews) → 15 MCQs:
      - Identify cold tags (MCQs with < 3 reviews)
      - Weight >= 60% of the 15 selections toward cold-tag MCQs
      - Remaining 40% from stalest MCQs (oldest reviews)
   d. Create mcq_diagnostics row in database with startedAt, mcqIds
   e. Return diagnostic session {id, mcqIds, ...}
6. useAppState.setDiagnosticSession(session)
7. MCQPracticeView renders first MCQ
8. User answers each MCQ
9. On each answer, POST /api/mcqs/:id/review records selection
10. When diagnostic done, user clicks "Complete"
11. useAppState dispatches handleCompleteDiagnostic()
12. POST /api/mcq-diagnostics/:id/complete:
    a. Fetch diagnostic session and all review records
    b. Call computeWeaknessReport(reviews):
       - For each tag, count MCQs wrong / total
       - Sort by wrong rate descending
       - Return drill-target list = tags with >= 2 wrong, capped at 3
    c. Update diagnostic row: completedAt, score, weaknessReport
13. Route returns weaknessReport
14. useAppState.setDiagnosticResult(result)
15. MCQPracticeView shows Weakness Report
16. User clicks "Drill these tags"
17. Router switches to OpenRecallView with cardFilterTag set to first weak tag
```

### Setting Interview Date

```
1. User clicks Countdown tile on Dashboard
2. Modal opens to set new date
3. User enters date YYYY-MM-DD
4. useAppState dispatches handleSetInterviewDate(date)
5. Calls api.setInterviewDate(date)
6. POST /api/interview-date {date: "2026-08-15"}
7. Route calls database.setSetting('interview_date', date)
8. All subsequent reviews will be clamped to this date
9. Dashboard countdown updates
```

## Key Design Decisions

### Interview-Date Clamping

Rather than modify the FSRS algorithm, clamping is applied as a separate composition step after grading:

```typescript
const schedule = gradeReview(oldSchedule, rating);
const clamped = applyInterviewDateClamp(schedule, interviewDate, now);
db.updateSchedule(clamped);
```

This keeps scheduling pure and testable while enabling interview-specific behavior (forcing one more review before the interview date).

**Why**: FSRS is well-studied and documented. Modifying it directly would make maintenance harder. Clamping is interview-specific business logic, separate from spaced repetition. See `src/lib/scheduler.ts` and tests in `test/scheduler-clamp.test.ts`.

### Pure Logic Functions

Business logic (scheduler, heatmap, sprint selection, diagnostic) are pure functions living in `src/lib/` with no dependencies on React, database, or network.

**Why**: 
- Easy to test in isolation
- Can be reused in CLI, cron jobs, or headless workflows
- Deterministic: given the same input, always the same output
- No hidden state or side effects

### Mock Data & API Facade

The API client (`api-client.ts`) returns either mock or real implementations based on a `USE_MOCK` flag:

```typescript
export function getApiClient(): ApiClient {
  if (USE_MOCK) return createMockApiClient();
  return createRealApiClient();
}
```

**Why**:
- UI can be developed without backend running
- No need for real Notion credentials or AI keys during development
- Tests can use mock without setting up database
- Single source of truth for USE_MOCK flag

### Migrations System

Schema changes are versioned as numbered SQL files in `src/migrations/` applied in order:

```typescript
// 001-initial.ts
const migration = { id: 1, description: '...', up(): string { /* SQL */ } };

// 002-mcq-questions.ts
const migration = { id: 2, description: '...', up(): string { /* SQL */ } };
```

**Why**:
- Non-destructive schema evolution (append migrations, never modify)
- Deterministic startup: app auto-applies pending migrations
- Audit trail of schema changes
- Testable in isolation (can run migrations against test databases)

### Stateless Routes

API routes do not store state in memory. Each route:

1. Receives HTTP request with parameters
2. Reads data from database
3. Applies logic
4. Writes results to database
5. Returns HTTP response

**Why**:
- Supports serverless deployment (no persistent in-memory state)
- Enables horizontal scaling (routes can run on different servers)
- Simplifies testing (no mocking of global state)
- Matches Next.js pattern (routes as thin handlers)

## Testing Strategy

The architecture enables comprehensive testing at each layer:

### Unit Tests (Logic Layer)

Test pure functions in isolation without database or network:

```typescript
// test/scheduler.test.ts
const schedule = gradeReview(oldSchedule, 'good');
expect(schedule.reps).toBe(oldSchedule.reps + 1);
```

**Modules**: scheduler, heatmap, sprint, mcq-diagnostic, lapses, countdown, etc.

### Integration Tests (Data Layer + Logic)

Test CRUD + business logic using in-memory SQLite:

```typescript
// test/database.test.ts
const db = createAppDatabase(':memory:');
db.addDraft(...);
const draft = db.getDrafts()[0];
expect(draft.status).toBe('draft');
```

### Route Tests (API Layer)

Test HTTP endpoints by calling them directly:

```typescript
// test/route.test.ts
const response = await fetch('http://localhost:3000/api/cards', {method: 'POST', ...});
const json = await response.json();
expect(json.card.id).toBeDefined();
```

Uses temporary directories for test isolation:

```typescript
const tmpDir = mkdtempSync(join(tmpdir(), 'test-'));
const db = createAppDatabase(join(tmpDir, 'test.sqlite'));
```

### No UI Tests

React components are tested manually or via visual inspection. No automated component tests; the logic they depend on is covered by unit/integration tests above.

## Migrations

Numbered SQL files in `src/migrations/` are applied in order:

1. **001-initial.ts**: Core schema (settings, notes, card_drafts, cards, schedules, reviews)
2. **002-mcq-questions.ts**: MCQ support (mcq_questions, mcq_reviews tables)
3. **003-mcq-reviews.ts**: MCQ review tracking
4. **004-sprints-and-diagnostics.ts**: Sprint and diagnostic sessions

Each migration:
- Exports `{id, description, up()}`
- Implements idempotent SQL (CREATE TABLE IF NOT EXISTS, etc.)
- Is applied exactly once (tracked in `_migrations` table)
- Is never modified after creation

To add a new migration:

1. Create `src/migrations/005-new-feature.ts` with unique id
2. Implement SQL for the new schema
3. Restart the app; migrations run automatically
4. Write tests using the new schema

## Source Maps

**UI Components** → `src/components/` and `src/app/page.tsx`
- Component tree, view routing, user interaction

**State Management** → `src/hooks/useAppState.ts`
- SPA state, event handlers, API integration

**API Routes** → `src/app/api/*/route.ts`
- REST endpoints, request/response contracts

**Business Logic** → `src/lib/` (except `database.ts`, `api-client.ts`, `mock-data.ts`)
- Pure functions: scheduling, heatmap, sprint/diagnostic selection, AI, Notion

**Data Layer** → `src/lib/database.ts`
- SQLite CRUD, schema, migrations

**Database Schema** → `src/migrations/`
- Numbered SQL files applied in order

**Tests** → `test/*.test.ts`
- Unit, integration, and route tests using bun test

**Configuration** → `src/lib/mock-data.ts`, `package.json`
- USE_MOCK flag, tech stack, scripts
