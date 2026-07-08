# Testing Guide

This page documents testing patterns, existing test coverage, and how to add new tests.

## Quick Start

```bash
# Run all tests
bun test

# Run tests for a specific file
bun test test/scheduler.test.ts

# Run tests with verbose output
bun test --verbose

# Watch mode (re-run on file changes)
bun test --watch
```

## Test Structure

The project uses **bun:test** (Bun's built-in test runner) with the following test files:

| File | Coverage |
|------|----------|
| `test/scheduler.test.ts` | FSRS scheduling, gradeReview, getDueCards |
| `test/scheduler-clamp.test.ts` | Interview-date clamping behavior |
| `test/heatmap.test.ts` | Retention calculation, cold-tag detection |
| `test/sprint.test.ts` | 20-item sprint selection logic |
| `test/mcq-diagnostic.test.ts` | 15-MCQ diagnostic selection, weakness scoring |
| `test/lapses.test.ts` | Recent "again"/"hard" card detection |
| `test/database.test.ts` | SQLite CRUD operations, migrations |
| `test/database-v2.test.ts` | Additional database scenarios |
| `test/ai.test.ts` | AI provider interface, output parsing |
| `test/notion.test.ts` | Notion API sync and filtering |
| `test/route.test.ts` | API route handlers |
| `test/compress.test.ts` | Input compression for token savings |

## Testing Layers

### Layer 1: Pure Function Tests (Unit Tests)

Test business logic in isolation without database or network.

**File**: `test/scheduler.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { gradeReview, createInitialSchedule } from '../src/lib/scheduler';

test('good rating increases review interval after repeated successful reviews', () => {
  const firstReviewAt = new Date('2026-06-24T08:00:00.000Z');
  const first = gradeReview(createInitialSchedule({ cardId: 3, now: firstReviewAt }), 'good', firstReviewAt);

  const secondReviewAt = new Date('2026-06-25T08:00:00.000Z');
  const second = gradeReview(first, 'good', secondReviewAt);

  expect(first.scheduledDays).toBe(1);
  expect(first.dueAt).toBe('2026-06-25T08:00:00.000Z');
  expect(second.scheduledDays).toBeGreaterThan(first.scheduledDays);
  expect(second.reps).toBe(2);
  expect(second.lapses).toBe(0);
});
```

**Benefits**:
- Fast to run
- No setup required
- Deterministic (same input = same output)
- Easy to understand

**Coverage**:
- Scheduler (FSRS calculations)
- Heatmap (retention %, trend, cold-tag detection)
- Sprint selection (item weighting)
- MCQ Diagnostic (cold-tag selection, weakness scoring)
- Lapses detection (time-window filtering)
- Countdown computation

### Layer 2: Integration Tests (Data + Logic)

Test database CRUD combined with business logic using in-memory SQLite.

**File**: `test/database.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { createAppDatabase } from '../src/lib/database';

test('draft approval creates a scheduled card and prevents double approval', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'notion-2',
    title: 'Indexes',
    content: 'Indexes speed reads.',
    sourceUrl: 'https://notion.so/notion-2',
    tags: ['database'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const [draft] = db.createDrafts(note.id, [
    {
      question: 'What is the tradeoff of an index?',
      expectedAnswer: 'Faster reads, slower writes.',
      rubric: ['reads', 'writes'],
      tags: ['database']
    }
  ]);

  const card = db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'));

  expect(card.question).toBe('What is the tradeoff of an index?');
  expect(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length).toBe(1);
  expect(() => db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'))).toThrow(/already handled/);
  db.close();
});
```

**Key Pattern: In-Memory Database**:

```typescript
const db = createAppDatabase(':memory:');
// Use db for CRUD operations
// Run any queries
db.close();
```

Using `:memory:` instead of a real file:
- Isolated per test (no side effects)
- Fast (no disk I/O)
- Automatically cleaned up (no temp file cleanup needed)

**Benefits**:
- Tests real CRUD against real schema
- Catches migration issues
- Validates data relationships and constraints
- More realistic than mocking the database

**Coverage**:
- Note upsert (sync, duplicate handling)
- Draft CRUD (create, approve, reject)
- Card creation (when draft approved)
- Schedule creation (when card created)
- Review recording (FSRS updates)
- MCQ creation and review recording
- Sprint and diagnostic session creation

### Layer 3: Route Tests (HTTP Endpoints)

Test API routes directly without spinning up a full server.

**File**: `test/route.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('POST /api/cards/:id/review records review and updates schedule', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-'));
  process.env.DATA_DIR = tmpDir;

  // Your route test here
});
```

**Isolation Pattern**:

```typescript
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'test-'));
process.env.DATA_DIR = tmpDir;  // Set before creating database
const db = createAppDatabase(join(tmpDir, 'test.sqlite'));
```

Each route test:
1. Creates a temporary directory
2. Sets `DATA_DIR` environment variable
3. Creates a test database in that directory
4. Calls the route handler
5. Verifies response and database state
6. Cleans up temp directory

**Benefits**:
- Tests request/response contract
- Validates error handling
- Ensures routes call database correctly
- Can mock external APIs if needed

**Coverage**:
- Dashboard payload assembly
- Draft approval workflow
- Review submission and clamping
- MCQ recording
- Sprint creation and completion
- Diagnostic workflow
- Interview date get/set
- Notion sync
- Note generation
- Settings persistence

## Writing a New Test

### Step 1: Identify What to Test

Decide which layer:
- **Pure logic** (scheduler, heatmap, sprint) → Unit test
- **Database + logic** (CRUD with business rules) → Integration test
- **HTTP endpoint** → Route test

### Step 2: Create Test File

If file doesn't exist, create it in `test/`:

```bash
touch test/my-feature.test.ts
```

### Step 3: Write Test Using bun:test

```typescript
import { test, expect } from 'bun:test';
import { myFunction } from '../src/lib/my-module';

test('myFunction returns expected result', () => {
  const result = myFunction({ input: 'value' });
  expect(result).toBe('expected');
});

test('myFunction handles edge cases', () => {
  expect(() => myFunction({ input: null })).toThrow('Input required');
});
```

### Step 4: Run Test

```bash
bun test test/my-feature.test.ts
```

The test should fail (because the feature doesn't exist yet). Implement the feature to make the test pass.

### Step 5: Add More Tests

Test success cases, edge cases, and error cases:

```typescript
test('valid input returns result', () => {
  const result = myFunction({ input: 'value' });
  expect(result.success).toBe(true);
});

test('empty input raises error', () => {
  expect(() => myFunction({ input: '' })).toThrow(/empty/);
});

test('result includes all required fields', () => {
  const result = myFunction({ input: 'value' });
  expect(result).toHaveProperty('id');
  expect(result).toHaveProperty('timestamp');
});
```

## Common Testing Patterns

### Testing Schedule Changes

```typescript
import { gradeReview, createInitialSchedule } from '../src/lib/scheduler';

test('hard rating increases difficulty', () => {
  const schedule = createInitialSchedule({ cardId: 1 });
  const next = gradeReview(schedule, 'hard');
  expect(next.difficulty).toBeGreaterThan(schedule.difficulty);
});
```

### Testing Database Isolation

```typescript
import { createAppDatabase } from '../src/lib/database';

test('two in-memory databases are isolated', () => {
  const db1 = createAppDatabase(':memory:');
  const db2 = createAppDatabase(':memory:');
  
  db1.upsertNote({...});
  expect(db2.listNotes().length).toBe(0);  // db2 is empty
  
  db1.close();
  db2.close();
});
```

### Testing Data Constraints

```typescript
test('foreign key constraint prevents orphan reviews', () => {
  const db = createAppDatabase(':memory:');
  // Create and then delete a card
  // Verify reviews are also deleted (CASCADE)
  db.close();
});
```

### Testing Error Handling

```typescript
test('reviewRating must be one of four values', () => {
  const db = createAppDatabase(':memory:');
  const card = db.createCard({...});
  expect(() => {
    db.recordReview(card.id, 'INVALID_RATING', 'answer');
  }).toThrow(/invalid rating/i);
  db.close();
});
```

### Testing Async Functions

```typescript
test('generateCards returns array of drafts', async () => {
  const provider = createOfflineAiProvider();
  const drafts = await provider.generateCards({
    title: 'My Note',
    content: 'Note content'
  });
  expect(Array.isArray(drafts)).toBe(true);
  expect(drafts.length).toBeGreaterThan(0);
});
```

### Testing With Mocking

When testing routes or integrations, you can set environment variables:

```typescript
test('uses correct AI provider from settings', () => {
  const db = createAppDatabase(':memory:');
  db.setSetting('ai_config', JSON.stringify({
    provider: 'offline'
  }));
  
  // Test that offline provider is used
});
```

## Test Coverage Map

### Scheduler Module

**File**: `test/scheduler.test.ts`, `test/scheduler-clamp.test.ts`

Coverage:
- ✅ `createInitialSchedule()` — New cards start with stability=0.4, state='new'
- ✅ `gradeReview()` — Rating changes schedule (again, hard, good, easy)
- ✅ `getDueCards()` — Filters by dueAt <= now
- ✅ `applyInterviewDateClamp()` — Caps scheduledDays to daysUntil - 1

**How to test new scheduler feature**:
1. Write test in `test/scheduler.test.ts`
2. Test with various ratings and time progressions
3. For clamping, test with and without interview date

Example:

```typescript
test('custom schedule behavior', () => {
  const schedule = createInitialSchedule({ cardId: 1 });
  const result = applyYourLogic(schedule);
  expect(result.property).toBe(expectedValue);
});
```

### Heatmap Module

**File**: `test/heatmap.test.ts`

Coverage:
- ✅ Retention % from last 3 reviews per card
- ✅ Status determination (green/yellow/red/cold)
- ✅ Trend calculation (↗/→/↘)
- ✅ Cold-tag detection (< 3 reviews)

**How to test new heatmap feature**:
1. Create cards and reviews
2. Call `computeHeatmap(cards, reviews)`
3. Verify tag-level statistics

Example:

```typescript
test('heatmap includes all tags from cards', () => {
  const cards = [
    {id: 1, tags: ['tag1', 'tag2']},
    {id: 2, tags: ['tag2', 'tag3']}
  ];
  const reviews = [];  // or add reviews
  const heatmap = computeHeatmap(cards, reviews);
  const tags = heatmap.map(tile => tile.tag);
  expect(tags).toContain('tag1');
  expect(tags).toContain('tag2');
  expect(tags).toContain('tag3');
});
```

### Sprint Module

**File**: `test/sprint.test.ts`

Coverage:
- ✅ `pickSprintItems()` selects exactly 20 items (10 open-recall + 10 MCQ)
- ✅ 70/30 weighting to red/yellow tags when they exist
- ✅ `computeSprintScore()` counts correct answers per tag

**How to test new sprint feature**:
1. Create cards with various tags and retention rates
2. Call `pickSprintItems(cards, mcqs)`
3. Verify selection criteria and weighting

Example:

```typescript
test('sprint weighs red/yellow tags higher', () => {
  const cards = [
    {id: 1, tags: ['weak'], createdAt: '...'},  // red
    {id: 2, tags: ['strong'], createdAt: '...'}  // green
  ];
  const items = pickSprintItems(cards, mcqs);
  const weakCount = items.filter(i => i.tags.includes('weak')).length;
  expect(weakCount).toBeGreaterThan(3);  // weighted higher
});
```

### MCQ Diagnostic Module

**File**: `test/mcq-diagnostic.test.ts`

Coverage:
- ✅ `pickDiagnosticMCQs()` selects exactly 15 MCQs
- ✅ >= 60% weighted to cold tags when they exist
- ✅ `computeWeaknessReport()` ranks tags by wrong rate

**How to test**:
1. Create MCQs with review history
2. Call `pickDiagnosticMCQs(mcqs, reviews)`
3. Verify cold-tag preference and count

Example:

```typescript
test('diagnostic prioritizes cold tags', () => {
  const mcqs = [
    {id: 1, tags: ['cold'], createdAt: '...'},
    {id: 2, tags: ['warm'], createdAt: '...'}
  ];
  const reviews = [];  // cold has 0 reviews, warm has 10
  const selected = pickDiagnosticMCQs(mcqs, reviews);
  const coldCount = selected.filter(m => m.tags.includes('cold')).length;
  expect(coldCount).toBeGreaterThanOrEqual(9);  // >= 60% of 15
});
```

### Database Module

**File**: `test/database.test.ts`, `test/database-v2.test.ts`

Coverage:
- ✅ CRUD operations for notes, cards, drafts, reviews, MCQs
- ✅ Migrations applied on startup
- ✅ Data constraints (foreign keys, unique, not-null)
- ✅ Interview date get/set/clear

**How to test new database feature**:
1. Create in-memory database
2. Call CRUD methods
3. Verify database state and constraints

Example:

```typescript
test('createCard requires noteId', () => {
  const db = createAppDatabase(':memory:');
  expect(() => {
    db.createCard({
      noteId: undefined,
      question: 'Q',
      expectedAnswer: 'A',
      rubric: [],
      tags: []
    });
  }).toThrow();
  db.close();
});
```

### AI Provider Module

**File**: `test/ai.test.ts`

Coverage:
- ✅ Offline provider output (deterministic)
- ✅ Output parsing (JSON extraction from LLM text)
- ✅ Provider interface implementation
- ✅ Error handling (invalid API key, rate limits)

**How to test**:
1. Call provider method
2. Verify output structure and types
3. Test error cases

Example:

```typescript
test('offline AI generates valid card drafts', async () => {
  const provider = createOfflineAiProvider();
  const drafts = await provider.generateCards({
    title: 'Topic',
    content: 'Content'
  });
  expect(drafts.length).toBeGreaterThan(0);
  expect(drafts[0]).toHaveProperty('question');
  expect(drafts[0]).toHaveProperty('expectedAnswer');
});
```

### API Route Module

**File**: `test/route.test.ts`

Coverage:
- ✅ Request parsing and validation
- ✅ Response structure
- ✅ Error status codes
- ✅ Database updates from route

**How to test new route**:
1. Set up test database and environment
2. Call route handler with request
3. Verify response and database state

Example:

```typescript
test('POST /api/cards/:id/review records review', async () => {
  const tmpDir = mkdtempSync(...);
  process.env.DATA_DIR = tmpDir;
  
  const db = createAppDatabase(...);
  // Set up card and schedule
  db.close();
  
  // Call route and verify response
});
```

## Running Full Test Suite Before Commit

```bash
# Run all tests
bun test

# Lint code
bun run lint

# Build (to catch TypeScript errors)
bun run build
```

Before claiming a feature is complete, ensure:
- ✅ All tests pass: `bun test`
- ✅ No linting errors: `bun run lint`
- ✅ Build succeeds: `bun run build`
- ✅ Manual UI test works: `bun run dev` and click around

## Debugging Failed Tests

### Run with Verbose Output

```bash
bun test --verbose test/scheduler.test.ts
```

### Add Console Logging

```typescript
test('my test', () => {
  const result = myFunction();
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

### Inspect Test File Directly

```bash
# Run a single test file
bun test test/scheduler.test.ts

# Run a single test by name
bun test --grep "good rating increases"
```

### Check Database State in Test

```typescript
test('verify database state', () => {
  const db = createAppDatabase(':memory:');
  db.upsertNote({...});
  
  const notes = db.listNotes();
  console.log('Notes after upsert:', notes);
  
  expect(notes.length).toBe(1);
  db.close();
});
```

## Performance Considerations

- In-memory SQLite tests are very fast (< 1ms each usually)
- Avoid heavy AI provider calls in tests; use offline provider or mocks
- Use temporary directories for file-based tests to avoid cleanup issues
- Tests should be deterministic; avoid using random data or current time in assertions

## Future Testing Enhancements

Potential areas for expanded testing (not yet implemented):
- React component snapshot tests (if needed)
- Performance benchmarks (scheduler scalability)
- Fuzz testing (random inputs to find edge cases)
- Load testing (many cards/reviews)
- End-to-end UI tests (if using headless browser automation)

See [Architecture: Testing Strategy](./architecture.md#testing-strategy) for layer overview.
