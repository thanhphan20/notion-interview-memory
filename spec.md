---
title: Notion Interview Memory Application Specification
version: 1.3
date_created: 2026-06-24
last_updated: 2026-07-03
owner: Local project owner
tags: [architecture, design, app, notion, spaced-repetition, interview-practice]
---

# Introduction

This specification defines the requirements, constraints, interfaces, data contracts, and validation criteria for the Notion Interview Memory application. The application is a private local web app that converts selected Notion knowledge notes into interview-style open-recall practice cards, schedules reviews with a spaced-repetition algorithm, and optionally uses AI providers for draft generation and answer critique.

## 1. Purpose & Scope

The purpose of this specification is to give humans and AI agents a complete, unambiguous source of truth for maintaining and extending the Notion Interview Memory application.

The scope includes:

- Local web app behavior.
- Notion database synchronization.
- AI-assisted card generation.
- AI-assisted answer critique.
- Draft approval workflow.
- SQLite persistence.
- Interview practice and review scheduling.
- API contracts used by the browser UI.
- Testing and validation expectations.

The scope excludes:

- Hosted multi-user SaaS behavior.
- Account management.
- Billing.
- Cloud deployment.
- Multi-device synchronization.
- Writing review state back to Notion.

Intended audience:

- AI coding agents.
- Human maintainers.
- Test automation agents.
- Documentation agents.

Assumptions:

- The app is single-user and private.
- The app runs on the user's local machine.
- Notion is the source of raw learning notes.
- SQLite is the source of learning state, review state, and scheduling state.

## 2. Definitions

| Term | Definition |
| --- | --- |
| AI | Artificial Intelligence. In this app, an external or offline provider that generates card drafts or critiques answers. |
| AI Provider | A module that implements the provider-neutral generation and critique contract. |
| Card | An approved open-recall study item used in interview practice. |
| Draft | An AI-generated candidate card that has not yet been approved or rejected. |
| FSRS | Free Spaced Repetition Scheduler. In this app, the scheduling behavior is FSRS-style and tracks stability, difficulty, reps, lapses, due date, and rating history. |
| Mock Data | Predefined realistic data in `src/lib/mock-data.ts` used to preview the UI without a backend. |
| Notion Database | The user's source database containing interview, system design, programming, language, and design pattern notes. |
| Note | A local SQLite record synced from one Notion page. |
| Open Recall | A review format where the user answers in their own words before seeing the expected answer. |
| Review | A completed practice attempt with user answer, rating, optional AI feedback, elapsed time, and timestamp. |
| Self-grade | The user's final review rating: `again`, `hard`, `good`, or `easy`. |
| SQLite | Local embedded relational database used for durable state. |
| MCQ | Multiple Choice Question. Auto-approved AI-generated questions with 4 options and one correct answer. No draft queue — MCQs enter practice immediately. |
| MCQ Question | A stored multiple-choice question with options, correct index, explanation, and tags. |
| MCQ Review | A completed MCQ practice attempt recording the user's selected index, correctness, and timestamp. |
| Migration | A numbered SQL migration file in `src/migrations/` applied in order via `_migrations` tracking table. |
| Tag Filter | A dropdown that filters visible items by tag. Applied client-side in the SPA for MCQs, card drafts, open recall cards, and review history. |

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: The app shall run as a local localhost web application.
- **REQ-002**: The app shall sync pages from exactly one configured Notion database for v1.
- **REQ-003**: The app shall support selected topic filtering during Notion sync.
- **REQ-004**: The app shall persist synced notes locally in SQLite.
- **REQ-005**: The app shall generate open-recall card drafts from synced notes.
- **REQ-006**: The app shall keep generated drafts out of review until approved.
- **REQ-007**: The app shall allow users to approve draft cards.
- **REQ-008**: The app shall allow users to reject draft cards.
- **REQ-009**: The app shall create a schedule when a draft is approved.
- **REQ-010**: The app shall show due cards in interview practice mode.
- **REQ-011**: The app shall allow users to type an answer before grading.
- **REQ-012**: The app shall optionally request AI critique for a user answer.
- **REQ-013**: The app shall store AI critique with the review when provided.
- **REQ-014**: The app shall use the user's final self-grade as the only scheduling input.
- **REQ-015**: The app shall support ratings `again`, `hard`, `good`, and `easy`.
- **REQ-016**: The app shall update the schedule after every completed review.
- **REQ-017**: The app shall expose a review history.
- **REQ-018**: The app shall provide an offline deterministic AI provider for local testing.
- **REQ-019**: The app shall provide an OpenAI-compatible provider mode for real AI generation and critique.
- **REQ-020**: The app shall keep raw Notion content and review state separate.
- **REQ-021**: The app shall generate MCQs alongside open-recall card drafts from synced notes.
- **REQ-022**: The app shall auto-approve generated MCQs — no draft queue, available immediately for practice.
- **REQ-023**: The app shall track MCQ review history (selected index, correct/incorrect, timestamp) in `mcq_reviews`.
- **REQ-024**: The app shall merge MCQ reviews and open-recall card reviews into a unified history view with type badges.
- **REQ-025**: The app shall shuffle MCQ options on load and provide a shuffle button.
- **REQ-026**: The app shall provide question navigation (numbered circles) for MCQ practice with current, answered-correct, answered-incorrect states.
- **REQ-027**: The app shall support tag filtering across all views: Practice (open recall + MCQs), Drafts, and History.
- **REQ-028**: The app shall use a numbered SQL migration system (`src/migrations/`) with a `_migrations` tracking table.

- **SEC-001**: The app shall not commit real Notion tokens, AI API keys, or SQLite data files.
- **SEC-002**: Secrets shall be stored only in local settings, local environment variables, or local ignored files.
- **SEC-003**: The app shall not expose network listeners other than the local HTTP server.
- **SEC-004**: The app shall not send note content to an AI provider unless the user selects or configures an AI provider that performs network requests.

- **CON-001**: The app shall use TypeScript and ESM module system supported by Bun and Next.js.
- **CON-002**: The app shall run on Bun `>=1.1.0`.
- **CON-003**: The app shall minimize mandatory external npm dependencies for v1. ESLint and config packages are excluded from this constraint.
- **CON-004**: The app shall use `bun:sqlite` for local persistence.
- **CON-005**: The browser UI shall be implemented as a Next.js frontend running on the Bun runtime.
- **CON-006**: Tests shall run through `bun test`.
- **CON-007**: Tests shall run using Bun's built-in test runner.

- **GUD-001**: Prefer small modules with single responsibilities.
- **GUD-002**: Keep business logic testable without the HTTP server.
- **GUD-003**: Keep API dispatch testable without browser automation.
- **GUD-004**: Preserve user control over scheduling decisions.
- **GUD-005**: Use explicit JSON contracts for AI provider input and output.

- **PAT-001**: Put pure scheduling behavior in `src/lib/scheduler.ts`.
- **PAT-002**: Put AI parsing and provider creation in `src/lib/ai.ts`.
- **PAT-003**: Put Notion mapping and sync logic in `src/lib/notion.ts`.
- **PAT-004**: Put SQLite schema and persistence methods in `src/lib/database.ts`.
- **PAT-005**: Put Next.js API route handlers in `src/app/api/`.
- **PAT-006**: Put Next.js pages and page-level React components in `src/app/`.
- **PAT-007**: Keep application entry and runtime setup controlled by Next.js configuration.
- **PAT-008**: Put reusable UI components in `src/components/ui/`.
- **PAT-009**: Put view-level components in `src/components/` (OpenRecallView, MCQPracticeView, DraftsView, etc.).
- **PAT-011**: Put shared state and event handlers in a custom hook at `src/hooks/useAppState.ts`.
- **PAT-012**: Put API facade with mock interceptor in `src/lib/api-client.ts`.
- **PAT-013**: Route tests shall isolate the database to a temp directory via `DATA_DIR` — never write to the real `data/app.sqlite`.
- **PAT-010**: Put mock data for offline UI preview in `src/lib/mock-data.ts`.

## 4. Interfaces & Data Contracts

### 4.1 Runtime Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start Next.js local development server at `http://localhost:3000` or configured `PORT`. |
| `bun run build` | Create production build. |
| `bun run start` | Start production server. |
| `bun run lint` | Run ESLint with `next/core-web-vitals` rules. |
| `bun test` | Run all automated tests using Bun's native test runner. |

### 4.2 Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Local HTTP port. Default: `3000`. |
| `DATA_DIR` | No | Directory for SQLite data. Default: `./data`. |
| `NOTION_TOKEN` | For Notion sync if not configured in UI | Notion integration token. |
| `NOTION_DATABASE_ID` | For Notion sync if not configured in UI | Source database ID. |
| `NOTION_TOPIC_PROPERTY` | No | Topic property used for filtering. Default: `Topic`. |
| `NOTION_TOPIC_FILTERS` | No | Comma-separated topic filters. |
| `AI_PROVIDER` | No | `offline` or `openai-compatible`. Default behavior should be safe for local use. |
| `AI_API_KEY` | For network AI provider | API key for OpenAI-compatible provider. |
| `AI_BASE_URL` | No | Chat completions base URL. |
| `AI_MODEL` | No | Model name for OpenAI-compatible provider. |

### 4.3 AI Provider Contract

```js
{
  async generateCards(note) {
    return CardDraft[];
  },
  async generateMCQs(note) {
    return MCQ[];
  },
  async critiqueAnswer({ card, answer }) {
    return AnswerCritique;
  }
}
```

### 4.4 Note Contract

```json
{
  "id": 1,
  "notionPageId": "page-id",
  "title": "Load Balancing",
  "content": "Layer 4 vs Layer 7...",
  "sourceUrl": "https://notion.so/page-id",
  "tags": ["System Design"],
  "notionLastEditedTime": "2026-06-24T08:00:00.000Z",
  "syncedAt": "2026-06-24T08:05:00.000Z"
}
```

### 4.5 Card Draft Contract

```json
{
  "id": 1,
  "noteId": 1,
  "question": "Explain load balancing as you would in an interview.",
  "expectedAnswer": "Load balancing distributes traffic across healthy backends.",
  "rubric": ["Defines load balancing", "Mentions health checks", "Explains tradeoffs"],
  "tags": ["System Design"],
  "status": "draft",
  "createdAt": "2026-06-24T08:10:00.000Z"
}
```

### 4.6 Card Contract

```json
{
  "id": 1,
  "noteId": 1,
  "sourceDraftId": 1,
  "question": "Explain load balancing as you would in an interview.",
  "expectedAnswer": "Load balancing distributes traffic across healthy backends.",
  "rubric": ["Defines load balancing", "Mentions health checks", "Explains tradeoffs"],
  "tags": ["System Design"],
  "createdAt": "2026-06-24T08:12:00.000Z"
}
```

### 4.7 Schedule Contract

```json
{
  "cardId": 1,
  "dueAt": "2026-06-25T08:12:00.000Z",
  "stability": 1,
  "difficulty": 4.85,
  "elapsedDays": 0,
  "scheduledDays": 1,
  "reps": 1,
  "lapses": 0,
  "state": "review",
  "lastReviewedAt": "2026-06-24T08:12:00.000Z"
}
```

### 4.8 MCQ Contract

```json
{
  "question": "What is the primary function of a load balancer?",
  "options": [
    "Distribute traffic across healthy backends",
    "Encrypt network packets",
    "Compress database queries",
    "Cache static assets"
  ],
  "correctIndex": 0,
  "explanation": "A load balancer distributes incoming traffic across healthy backend servers.",
  "tags": ["System Design"]
}
```

### 4.9 MCQQuestion Contract

```json
{
  "id": 1,
  "noteId": 1,
  "question": "What is the primary function of a load balancer?",
  "options": ["Distribute traffic...", "Encrypt...", "Compress...", "Cache..."],
  "correctIndex": 0,
  "explanation": "A load balancer distributes...",
  "tags": ["System Design"],
  "createdAt": "2026-06-27T08:10:00.000Z"
}
```

### 4.10 MCQReview Contract

```json
{
  "id": 1,
  "mcqId": 1,
  "question": "What is the primary function of a load balancer?",
  "options": ["Distribute traffic...", "Encrypt...", "Compress...", "Cache..."],
  "correctIndex": 0,
  "selectedIndex": 0,
  "correct": true,
  "reviewedAt": "2026-06-27T08:20:00.000Z",
  "tags": ["System Design"]
}
```

### 4.11 Migration System

Each migration is a file in `src/migrations/` exporting `{ id, description, up() }`.
Migrations are applied in order by `src/lib/migrate.ts` via a `_migrations` tracking table.
New migrations should be sequenced after the highest existing migration ID.

### 4.12 Review Contract

```json
{
  "id": 1,
  "cardId": 1,
  "userAnswer": "It distributes requests across servers and checks health.",
  "aiFeedback": {
    "summary": "Good answer. Add tradeoffs.",
    "missingKeyPoints": ["tradeoffs"],
    "suggestedRating": "hard"
  },
  "rating": "good",
  "elapsedSeconds": 45,
  "reviewedAt": "2026-06-24T08:20:00.000Z"
}
```

### 4.9 HTTP API

| Method | Path | Request Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/state` | None | Stats, notes, drafts, cards, due cards, reviews. |
| `GET` | `/api/settings` | None | Local Notion and AI settings. |
| `POST` | `/api/settings` | `{ notion, ai }` | `{ saved: true }`. |
| `POST` | `/api/notion/sync` | Optional Notion config override | Imported notes. |
| `POST` | `/api/notes/:id/generate` | Empty object | Generated drafts. |
| `POST` | `/api/drafts/:id/approve` | Optional `{ now }` | Approved card. |
| `POST` | `/api/drafts/:id/reject` | Empty object | Rejected draft. |
| `POST` | `/api/cards/:id/critique` | `{ answer }` | AI critique. |
| `POST` | `/api/cards/:id/review` | `{ answer, aiFeedback, rating, elapsedSeconds, reviewedAt }` | Review and updated schedule. |
| `POST` | `/api/mcqs/generate` | Empty object | MCQs from all notes. |
| `POST` | `/api/mcqs/:id/review` | `{ selectedIndex }` | Recorded MCQ review. |
| `POST` | `/api/notes/generate-all` | Empty object | Drafts and MCQs from all notes. |
| `POST` | `/api/notes/:id/generate` | Empty object | Drafts and MCQs from one note. |

## 5. Acceptance Criteria

- **AC-001**: Given a configured Notion database, When the user syncs selected topics, Then the app stores matching pages as local notes.
- **AC-002**: Given a synced note, When the user generates drafts, Then the app creates draft cards with question, expected answer, rubric, and tags.
- **AC-003**: Given a draft card, When the user approves it, Then the app creates a card and an initial schedule due immediately.
- **AC-004**: Given a draft card, When the user rejects it, Then the app shall not create a card or schedule.
- **AC-005**: Given a due card, When the user opens practice mode, Then the app shows the question before the expected answer.
- **AC-006**: Given a written answer, When the user requests AI critique, Then the app returns structured critique without automatically grading the review.
- **AC-007**: Given a written answer and selected self-grade, When the user submits review, Then the app stores the review and updates the schedule.
- **AC-008**: Given AI suggests a rating, When the user selects a different self-grade, Then the user-selected grade controls scheduling.
- **AC-009**: Given the app restarts, When state is loaded, Then notes, drafts, cards, schedules, and reviews remain available from SQLite.
- **AC-010**: Given no AI API key is configured, When the offline provider is selected, Then the app can still generate deterministic drafts and critique answers.
- **AC-011**: Given `USE_MOCK = true` in `src/lib/mock-data.ts`, When the app starts, Then the UI renders with realistic mock data and all interactions (answer, critique, approve, reject, review) work locally without a backend.
- **AC-012**: Given synced notes, When MCQs are generated, Then they are immediately available for practice (no draft queue).
- **AC-013**: Given an MCQ, When the user selects an option, Then the answer is recorded in `mcq_reviews` and the nav circle updates with correct/incorrect state.
- **AC-014**: Given both open-recall and MCQ reviews exist, When viewing history, Then the user sees a merged timeline with type badges (`Open Recall` / `Multiple Choice`).
- **AC-015**: Given tag filter controls, When the user selects a tag, Then visible items are filtered to only those matching the selected tag.

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for pure modules, integration tests for persistence and API dispatch, HTTP adapter tests for static and API routing.
- **Frameworks**: Bun's native test runner `bun:test` and `bun:assert`.
- **Test Data Management**: Use SQLite `:memory:` databases for persistence tests. Do not depend on local `data/app.sqlite`.
- **CI/CD Integration**: Any future CI pipeline shall run `bun test` from the app root.
- **Coverage Requirements**: Each new module or behavior shall have automated tests. No numeric coverage threshold is defined for v1.
- **Performance Testing**: No load testing is required for v1 because the app is single-user local software.
- **Network Test Policy**: Automated tests shall not require real Notion or AI network calls. Use injected fakes for external integrations.
- **Lint Policy**: `bun run lint` shall pass without errors before merging changes.

## 7. Rationale & Context

The product goal is long-term interview memory, not passive note browsing. Open-recall interview practice is prioritized because interview performance requires explaining concepts in the user's own words. Draft approval is required because AI-generated cards can be incorrect, vague, duplicated, or misaligned with the user's intent. The review schedule is stored locally because Notion is optimized for notes, not review history or spaced-repetition state.

The app is local-first to keep personal knowledge private, reduce setup scope, and avoid account management. The AI layer is provider-neutral so the user can start offline, use OpenAI-compatible APIs, or add other providers later without rewriting review logic.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Notion API - Required for reading selected pages from the configured Notion database.
- **EXT-002**: OpenAI-compatible Chat Completions API - Optional network AI provider for card generation and answer critique.

### Third-Party Services

- **SVC-001**: Notion - Must support database query and block children retrieval for shared pages.
- **SVC-002**: AI Provider - Must accept chat-style prompts and return JSON-compatible text for generation and critique workflows.

### Infrastructure Dependencies

- **INF-001**: Local filesystem - Required for SQLite database storage and static asset serving.
- **INF-002**: Local HTTP loopback - Required for browser access at localhost.

### Data Dependencies

- **DAT-001**: Notion database pages - Source note data with title, content blocks, topic tags, URL, and last edited timestamp.
- **DAT-002**: SQLite database file - Local durable data store for notes, drafts, cards, schedules, reviews, and settings.

### Technology Platform Dependencies

- **PLT-001**: Bun `>=1.1.0` - Required for `bun:sqlite` and fast TypeScript execution.
- **PLT-002**: Modern browser - Required for `fetch`, standard DOM APIs, and CSS custom properties.
- **PLT-003**: Geist and JetBrains Mono fonts - Loaded via Google Fonts CDN.

### Compliance Dependencies

- **COM-001**: Personal data handling - Notes may contain sensitive personal learning data; agents shall avoid uploading, logging, or committing private content unless explicitly required by the user.

## 9. Examples & Edge Cases

### 9.1 AI Card Generation Output

```json
{
  "cards": [
    {
      "question": "Explain database indexing tradeoffs.",
      "expectedAnswer": "Indexes improve read performance but add write cost and storage overhead.",
      "rubric": ["Mentions read speed", "Mentions write cost", "Mentions storage overhead"],
      "tags": ["Database"]
    }
  ]
}
```

### 9.2 AI Critique Output

```json
{
  "summary": "The answer defines the concept but misses the operational tradeoff.",
  "missingKeyPoints": ["write amplification", "storage overhead"],
  "suggestedRating": "hard"
}
```

### 9.3 Empty Notion Page

If a Notion page has a title but no extractable content, the app may sync it as a note. AI generation should still validate output and reject malformed drafts before saving.

### 9.4 Duplicate Notion Sync

If the same Notion page is synced more than once, the app shall update the existing note row by `notionPageId` and shall not create duplicate notes.

### 9.5 Double Approval

If a draft is already approved or rejected, a second approval attempt shall fail with an explicit error.

### 9.6 AI Rating Disagreement

If AI suggests `hard` and the user selects `good`, the schedule shall use `good`.

## 10. Error Handling & Edge Cases

### 10.1 API Error Responses

All API routes shall return structured error responses with HTTP status codes and error metadata. No route shall respond with an untyped `500` or silent failure.

#### 10.1.1 Error Response Contract

```json
{
  "error": true,
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

#### 10.1.2 Common Error Codes

| Code | HTTP Status | Scenario | Recovery |
| --- | --- | --- | --- |
| `NOTION_RATE_LIMIT` | 429 | Notion API rate limit (3 req/sec) | Client should retry with exponential backoff after `retry-after` seconds |
| `NOTION_AUTH_INVALID` | 401 | Invalid or missing Notion token | User must reconfigure Notion settings |
| `NOTION_NETWORK_ERROR` | 503 | Notion API unreachable | Retry; if persistent, check network connectivity |
| `AI_PARSE_ERROR` | 400 | AI output is not valid JSON or missing required fields | Reject the malformed output; ask user to retry generation |
| `AI_VALIDATION_ERROR` | 400 | AI output is valid JSON but violates schema (e.g., `correctIndex` out of bounds) | Reject and log; notify user generation failed |
| `DRAFT_ALREADY_APPROVED` | 409 | Draft already approved or rejected | Return the existing card/rejection state; do not duplicate |
| `CARD_NOT_FOUND` | 404 | Card ID does not exist | Return 404; UI should not attempt to review non-existent cards |
| `DATABASE_LOCKED` | 503 | SQLite database is locked by another process | Retry after brief backoff; if persistent, check for concurrent access |
| `INVALID_REQUEST_BODY` | 400 | Request payload is missing required fields or has wrong type | Return error with list of required fields |

### 10.1.3 Route-Specific Error Handling

**`POST /api/notion/sync`**
- If Notion token is missing or invalid: return `NOTION_AUTH_INVALID` with 401.
- If Notion API returns rate limit (429): return `NOTION_RATE_LIMIT` with 429 and `retry-after` header.
- If Notion API is unreachable: return `NOTION_NETWORK_ERROR` with 503.
- If database insert fails due to lock: return `DATABASE_LOCKED` with 503 and retry guidance.

**`POST /api/notes/:id/generate`**
- If note ID does not exist: return `CARD_NOT_FOUND` with 404.
- If AI provider is offline and returns deterministic output: validate JSON before saving.
- If AI provider returns valid JSON with invalid schema (missing `cards`, `mcqs`, or invalid MCQ structure):
  - Reject the output.
  - Return `AI_VALIDATION_ERROR` with 400 and details on which field failed.
  - Do not save partial or malformed drafts.

**`POST /api/drafts/:id/approve`**
- If draft was already approved: return `DRAFT_ALREADY_APPROVED` with 409 and the existing card ID.
- If draft was already rejected: return error indicating rejection and the rejection reason if stored.
- If insert fails due to database constraint: return error with constraint details.

**`POST /api/cards/:id/critique`**
- If card ID does not exist: return `CARD_NOT_FOUND` with 404.
- If answer text is empty or whitespace-only: return `INVALID_REQUEST_BODY` with 400.
- If AI provider fails: return structured error with provider-specific code and message.

**`POST /api/cards/:id/review`**
- If card ID does not exist: return `CARD_NOT_FOUND` with 404.
- If rating is not one of `[again, hard, good, easy]`: return `INVALID_REQUEST_BODY` with 400 and valid ratings list.
- If `elapsedSeconds` is negative: return `INVALID_REQUEST_BODY` with 400.
- If insert fails: return database error code.

### 10.1.4 Client-Side Error Handling

- All API calls shall wrap responses in a try-catch or `.catch()` handler.
- On error, UI shall display error message to user via toast/alert.
- UI shall not hide error details in console-only logs.
- For transient errors (429, 503), UI should offer a "Retry" button.
- For permanent errors (401, 404, 400), UI should offer "Fix Settings" or "Go Back" button.

### 10.2 AI Output Validation

**MCQ Generation**

Before saving MCQ questions, validate:
- `question` is non-empty string.
- `options` array has exactly 4 strings.
- Each option is non-empty and distinct from others.
- `correctIndex` is an integer in range `[0, 3]`.
- `explanation` is non-empty string.
- `tags` is array of non-empty strings or empty array.

If any field fails validation, reject the entire MCQ set and return `AI_VALIDATION_ERROR`.

**Card Draft Generation**

Before saving card drafts, validate:
- `question` is non-empty string (max 500 chars recommended).
- `expectedAnswer` is non-empty string.
- `rubric` is array of 1+ non-empty strings.
- `tags` is array of non-empty strings matching the note's tags.

If validation fails, reject and return `AI_VALIDATION_ERROR` with details.

### 10.3 Notion Sync Edge Cases

**Empty Pages**

If a Notion page has title but no synced content:
- Store the note with `content: ""`.
- Allow draft generation (may produce generic or empty drafts).
- User can still approve/reject or delete note.

**Duplicate Sync**

If the same Notion page is synced multiple times:
- Update existing note by `notionPageId` instead of creating duplicate.
- Preserve card and review history tied to the note (do not orphan them).
- Merge tag updates (add new tags, do not remove existing tags unless explicitly synced as empty).

**Orphaned Drafts and Cards**

If a note is deleted or sync is reversed:
- Do not cascade-delete associated drafts or cards.
- Mark them as "note deleted" or preserve them as independent records.
- User can still review cards even if source note is deleted.

### 10.4 Scheduling Edge Cases

**Future Review Date**

If a user's system clock is set to past, and a card's `dueAt` is in the future:
- Card shall not appear in due list until local clock catches up.
- UI should not assume cards are always due.

**Zero Stability**

If scheduling calculation results in `stability === 0`:
- Clamp to minimum `0.4` to prevent infinite loops or division errors.
- Log warning if this occurs more than expected.

**Negative Elapsed Days**

If `reviewedAt` is before `lastReviewedAt` (clock skew or test scenario):
- Clamp `elapsedDays` to 0.
- Do not fail scheduling; continue with current state.

---

## 11. Notion Sync Reliability

### 11.1 Rate Limiting

Notion API enforces rate limits: **3 requests per second** per integration token.

**Behavior:**
- Client shall implement exponential backoff on receiving 429 (Too Many Requests).
- First retry after 1 second; second after 2 seconds; third after 4 seconds (capped at 32 seconds).
- If rate limit persists after 5 retries, return `NOTION_RATE_LIMIT` error to user.
- UI shall offer "Retry Sync" button with backoff countdown.

**Implementation in `src/lib/notion.ts`:**

```typescript
async function fetchWithRetry(url: string, options: any, maxRetries: number = 5): Promise<Response> {
  let lastError: Error;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '1');
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }
        throw new Error(`Rate limited after ${attempt} retries`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const backoff = Math.min(2 ** attempt * 1000, 32000);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  throw lastError;
}
```

### 11.2 Transaction Integrity

Syncing multiple Notion pages shall be atomic: either all pages sync successfully or none do.

**Implementation:**
- Begin a SQLite transaction before syncing any pages.
- Sync all pages within the transaction.
- Commit only if all pages succeed.
- Rollback if any page sync fails.

**Prevents:**
- Partial syncs leaving notes in inconsistent state.
- Duplicate notes if sync crashes mid-flight.

```typescript
function syncNotionPages(pages: NotionPage[], config: NotionConfig): Note[] {
  const db = createAppDatabase();
  try {
    db.exec('BEGIN TRANSACTION');
    const notes = pages.map(page => syncSinglePage(page, config, db));
    db.exec('COMMIT');
    return notes;
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`Sync failed; no pages were imported: ${error.message}`);
  }
}
```

### 11.3 Idempotent Sync

If sync is interrupted and retried, it shall not create duplicate notes or corrupt existing data.

**Mechanism:**
- Notes are identified by `notionPageId` (Notion's unique identifier).
- Upsert logic: `INSERT OR REPLACE` by `notionPageId`.
- Preserves card and review history by cascading through `noteId` foreign key.

**Test Case:**
```
1. Sync page A and page B → 2 notes created.
2. Sync page A again (without B) → Page A updated, page B unchanged.
3. Both notes and all reviews survive.
```

### 11.4 Network Failure Handling

If Notion API becomes unreachable mid-sync:
- Return 503 `NOTION_NETWORK_ERROR` with user-friendly message.
- Do not save partial results.
- User can retry when network is restored.

**UI Behavior:**
- Show "Network Error" toast with "Retry" button.
- Keep previous sync results available (do not clear UI).
- Log error details for debugging.

### 11.5 Token Expiration

If Notion token expires or is revoked:
- Next sync returns 401 `NOTION_AUTH_INVALID`.
- UI prompts user to re-enter token in Settings.
- User must re-authenticate before syncing again.

**Does not affect:**
- Existing synced notes.
- Card practice and review.
- Only blocks new sync operations.

### 11.6 Configuration Validation

Before syncing, validate Notion configuration:

```typescript
if (!config.token || config.token.trim() === '') {
  throw new Error('Notion token is required');
}
if (!config.databaseId || config.databaseId.trim() === '') {
  throw new Error('Notion database ID is required');
}
if (config.databaseId.length !== 32 && config.databaseId.length !== 36) {
  // Notion IDs can be with or without hyphens; validate length
  throw new Error('Invalid Notion database ID format');
}
```

### 11.7 Content Extraction Robustness

Notion pages contain varied block types. Sync shall:
- Extract text from paragraph blocks.
- Extract text from heading blocks (with hierarchy preserved).
- Extract text from bulleted and numbered lists.
- Extract text from code blocks (with language tag).
- Skip or log unsupported block types (images, videos, databases).
- Never fail sync due to unsupported block type; continue with extracted content.

**Example:**
```
If a page has:
- Paragraph block ✓
- Image block (skip, log)
- Code block ✓
- Video block (skip, log)
- Heading block ✓

Result: Note with paragraph + code + heading content. No error.
```

---

## 12. Bun Lock File & Dependency Management

### 12.1 Lock File Strategy

The `bun.lock` file (99 KB) is committed to version control to ensure:
- Reproducible builds across machines and CI/CD.
- All developers use the same dependency versions.
- No surprises from upstream package updates.

**Policy:**
- `bun.lock` is generated by `bun install` and automatically committed.
- Never manually edit `bun.lock`.
- On dependency update, run `bun install` and commit the new lock file.

### 12.2 Dependency Review

Current dependencies are minimal (3 production, 6 dev):

**Production:**
- `next@16.2.9` — Required for framework and routing.
- `react@19.2.7` — Required for UI.
- `react-dom@19.2.7` — Required for DOM rendering.

**Development:**
- `@types/node`, `@types/react`, `@types/react-dom` — TypeScript definitions.
- `bun-types` — Bun runtime types.
- `eslint`, `eslint-config-next` — Code linting.
- `typescript` — Language compiler.
- `postcss` — CSS processing (via Next.js).

All dependencies are necessary for v1. No unused or redundant packages.

### 12.3 PostCSS Pinning

`postcss` is pinned to `8.5.15` via `overrides` in `package.json` to avoid breaking changes:

```json
"overrides": {
  "postcss": "8.5.15"
}
```

This prevents:
- Transitive dependency version conflicts.
- CSS processing breakage from PostCSS major versions.

**Rationale:** PostCSS major versions introduce breaking changes. Pinning ensures stable builds across updates.

### 12.4 Audit & Vulnerability

Regular security audits are required:

```bash
bun audit
```

**Action Plan:**
- If critical vulnerabilities are found: update dependency immediately and test.
- If non-critical vulnerabilities are found: review and plan update in next sprint.
- Never use `--ignore-scripts` or other security bypasses to mask vulnerabilities.

### 12.5 Updating Dependencies

To update a single dependency:

```bash
bun add --save-dev package@version
bun install  # Updates lock file
```

Commit both `package.json` and `bun.lock`.

To update all dependencies (caution):

```bash
bun update
bun install
```

Review `bun.lock` diff for major version jumps before committing.

### 12.6 ESLint Tree-Shaking

`eslint` and `eslint-config-next` are dev-only and will not appear in production builds. Next.js build process excludes them automatically. No additional configuration needed.

---

## 13. Component Re-renders & State Management

### 13.1 Current State Architecture

**Single Root Hook:** `src/hooks/useAppState.ts`

All application state is managed in one custom hook:

```typescript
const {
  stats, notes, drafts, cards, dueCards, reviews, mcqs, mcqReviews,
  handleNotionSync, handleGenerateDrafts, handleApproveDraft, handleRejectDraft,
  handleCritique, handleReview, handleMCQReview,
  // ... handlers
} = useAppState();
```

**Problem:**
- All state is tightly coupled.
- Any state update triggers re-render of entire component tree (page.tsx → all views).
- Views that don't use updated state still re-render unnecessarily.
- Filters, current card, and MCQ session state are not memoized; each render recalculates.

### 13.2 Re-render Scenarios (Current Inefficiency)

| Trigger | Affected Components | Re-renders | Impact |
| --- | --- | --- | --- |
| User answers a card | `useAppState()` updates `reviews`, `stats`, `dueCards` | Page, Sidebar, TopBar, OpenRecallView, MCQPracticeView, all other views | 8+ components re-render even though user is in OpenRecallView |
| Filter tag changes | Only view filter state changes | Page, all views | Entire page tree |
| MCQ shuffle button | Only session state changes | Page, MCQPracticeView | Entire page tree |
| User clicks approve draft | Drafts list and stats update | Page, Sidebar, TopBar, DraftsView, NotesView | Multiple views re-render |

### 13.3 Solution: State Splitting (Recommended)

Split `useAppState` into three independent hooks:

1. **`usePersistentState`** — Synced with backend (notes, cards, drafts, reviews)
   - Updates only when server returns new data.
   - Used by OpenRecallView, MCQPracticeView, DraftsView, HistoryView, NotesView.

2. **`useSessionState`** — Ephemeral client-side state (current card, MCQ shuffle, filter selections)
   - Updates on every user interaction but doesn't touch backend.
   - Used only by views that need it.
   - Memoized to prevent child re-renders.

3. **`useSettings`** — Configuration (Notion token, AI provider, display preferences)
   - Rarely changes.
   - Isolated from other state.

**Benefits:**
- MCQ shuffle or filter change doesn't re-render OpenRecallView.
- DraftsView approval doesn't re-render NotesView.
- Each view is independently testable.
- Performance scales linearly with feature complexity.

### 13.4 Implementation Strategy

**Phase 1: Extract Persistent State**

Create `src/hooks/usePersistentState.ts`:

```typescript
export function usePersistentState() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppState().then(setState).catch(setError).finally(() => setLoading(false));
  }, []);

  const handleReview = (cardId: number, answer: string, rating: string) => {
    return apiClient.submitReview(cardId, answer, rating).then(newState => {
      setState(newState);
      return newState;
    });
  };

  return { state, loading, error, handleReview, handleApproveDraft, ... };
}
```

**Phase 2: Extract Session State**

Create `src/hooks/useSessionState.ts`:

```typescript
export function useSessionState() {
  const [currentCardId, setCurrentCardId] = useState<number | null>(null);
  const [filteredTag, setFilteredTag] = useState<string | null>(null);
  const [mcqShuffle, setMcqShuffle] = useState<boolean>(false);

  // Memoized selectors to prevent downstream re-renders
  const getDueCardsForTag = useCallback((cards: Card[], tag: string | null) => {
    return tag ? cards.filter(c => c.tags.includes(tag)) : cards;
  }, []);

  return { currentCardId, setCurrentCardId, filteredTag, setFilteredTag, getDueCardsForTag, ... };
}
```

**Phase 3: Update Page Layout**

Replace monolithic `useAppState` with:

```typescript
function Page() {
  const persistent = usePersistentState();
  const session = useSessionState();
  const settings = useSettings();

  return (
    <Sidebar stats={persistent.state?.stats} view={session.currentView} />
    <OpenRecallView
      dueCards={persistent.state?.dueCards}
      onReview={persistent.handleReview}
      isActive={session.currentView === 'practice'}
    />
    // ... other views only subscribe to state they use
  );
}
```

### 13.5 Memoization Guidelines

To prevent unnecessary re-renders within each hook:

**Use `useMemo` for derived state:**

```typescript
const filteredCards = useMemo(
  () => cards.filter(c => tag === null || c.tags.includes(tag)),
  [cards, tag]
);
```

**Use `useCallback` for event handlers:**

```typescript
const handleApprove = useCallback((draftId: number) => {
  return apiClient.approveDraft(draftId).then(newState => setState(newState));
}, []);
```

**Do NOT memoize:**
- Render prop or component functions (use inline or extracted components instead).
- Primitive values or simple objects (overhead > benefit).

### 13.6 Testing State Hooks

Each state hook must be tested independently with `@testing-library/react-hooks` or similar:

```typescript
test('usePersistentState fetches initial app state', async () => {
  const { result } = renderHook(() => usePersistentState());
  expect(result.current.loading).toBe(true);

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.state).not.toBeNull();
  expect(result.current.state?.notes).toBeDefined();
});

test('useSessionState filter does not trigger persistent state refetch', () => {
  const { result } = renderHook(() => {
    const persistent = usePersistentState();
    const session = useSessionState();
    return { persistent, session };
  });

  act(() => result.current.session.setFilteredTag('System Design'));
  // Persistent state should not have refetched
  expect(result.current.persistent.state).toEqual(previousState);
});
```

### 13.7 Performance Metrics

After state splitting, verify:

1. **Component re-render count:** Use React DevTools Profiler.
   - Baseline (before): 8+ views re-render on every state change.
   - Target (after): Only affected views re-render.

2. **Render time:** Use React DevTools Profiler.
   - Measure time for OpenRecallView → answer submit → review recorded.
   - Target: <100ms for view re-render (excluding API latency).

3. **Bundle size:** No change expected (same code, reorganized).

---

## 14. Validation Criteria

- `bun test` shall pass with all tests green.
- `bun run lint` shall pass with no errors.
- The app shall start with `bun run dev`.
- `GET /` shall return the static app shell.
- `GET /api/state` shall return valid JSON with `stats`, `notes`, `drafts`, `cards`, `dueCards`, `reviews`, `mcqs`, and `mcqReviews`.
- Tests shall cover scheduler behavior for new cards, `again`, and repeated successful reviews.
- Tests shall cover AI output parsing and malformed output rejection.
- Tests shall cover Notion filter construction and Notion block text extraction.
- Tests shall cover note upsert, draft approval, schedule creation, review recording, and AI feedback persistence.
- Tests shall cover API sync, draft generation, approval, critique, and review submission.
- Tests shall not require real API credentials.
- With `USE_MOCK = true`, the UI shall render all 5 views with populated data and support all interaction flows locally.
- **Error handling tests:** All API routes shall return proper error codes (429, 401, 400, 404, 500) with structured error responses.
- **Notion sync tests:** Sync shall be atomic (all-or-nothing) and idempotent (safe to retry).
- **State management tests:** Session state updates shall not trigger persistent state refetches; derived state shall use memoization.
- **Performance baseline:** After state splitting, component re-render count shall be ≤3 per user action (down from current 8+).

## 11. Related Specifications / Further Reading

- [README.md](./README.md)
- [agent.md](./agent.md)
- [docs/design-guide.md](./docs/design-guide.md)
- [docs/design-implementation-plan.md](./docs/design-implementation-plan.md)
- [Notion API documentation](https://developers.notion.com/)
- [Bun SQLite documentation](https://bun.sh/docs/api/sqlite)
