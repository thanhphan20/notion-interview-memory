# Workflows

This page documents key workflows for both users and developers.

## User Workflows

### Setup & Notion Sync

**Goal**: Get Notion notes into the app and start generating study materials.

**Steps**:

1. **Open the app** → `http://localhost:3000`
2. **Click Settings** (sidebar)
3. **Configure Notion**:
   - Paste your Notion database URL (the page containing your database)
   - Optionally add a topic/property filter (e.g., only sync "system-design" tagged pages)
   - Click "Save"
4. **Configure AI** (optional):
   - Select provider (OpenAI, Groq, offline, etc.)
   - Add API key if using a real provider
   - Select model (e.g., gpt-4-mini for OpenAI)
   - Click "Save"
5. **Sync Notion**:
   - Go back to Dashboard or Notes
   - Click "Sync from Notion" button
   - Wait for sync to complete (shows import count)
   - Synced pages appear in Notes view
6. **Generate Study Materials**:
   - Click a note in Notes view
   - Click "Generate Drafts"
   - AI generates open-recall card drafts + MCQs
   - Drafts appear in Drafts view (MCQs auto-approve and appear in Diagnostic)
7. **Approve Cards**:
   - Go to Drafts view
   - Review each draft
   - Click "Approve" to add card to practice (creates schedule)
   - Click "Reject" to discard draft

**Key Points**:

- Sync is one-way: notes flow from Notion → local app. Changes to cards do not write back to Notion.
- MCQs are auto-approved and immediately available for practice.
- Card drafts require manual approval before entering practice.
- Interview Date is optional at this stage but recommended.

### Interview Date & Scheduler Clamp

**Goal**: Set a target interview date so the scheduler pressures you toward one final review before the date.

**Steps**:

1. **Go to Dashboard**
2. **Click the Countdown tile** (days, sprint avg, % green)
3. **Enter your interview date** (YYYY-MM-DD format)
4. **Click "Save"** or press Enter
5. **Scheduler adjusts** automatically:
   - `scheduledDays` for future reviews is capped at `daysUntil - 1`
   - This ensures every card gets at least one more review before the interview date
6. **Monitor progress**:
   - Dashboard countdown updates
   - Sprint average and % green persist from week to week
   - Lapses tile highlights cards to review the night before

**Scheduler Behavior**:

- **Before clamp**: FSRS suggests `scheduledDays = 30` (for example)
- **After clamp**: If interview is in 14 days, `scheduledDays = min(30, 13) = 13`
- **Effect**: Card is due one day sooner, ensuring final review

**Key Points**:

- Interview Date is stored in the `settings` table as a JSON string
- Clamping is applied to every review after the date is set
- Clearing the date (empty input) removes clamping
- Past interview dates are allowed but ineffective (all cards become immediately due)

### Beginner: Cram for Interview (3–6 weeks)

**Goal**: Efficiently prepare for an interview using spaced repetition + adaptive diagnostics.

**Prerequisite**: Interview Date is set, study materials are approved and in practice.

**Steps**:

1. **Week 1: Diagnostic + Drill Weak Tags**
   - Go to Dashboard
   - Click "Start Diagnostic" or go to Diagnostic in sidebar
   - Answer 15 MCQs (~8 minutes)
   - Review Weakness Report at the end
   - Click "Drill these tags" → Opens Interview Practice filtered to weak tags
   - Spend 15–30 minutes answering open-recall cards for those tags
   - AI critique is optional (helps refine answers)
   - Self-grade honestly (guides scheduler)

2. **Ongoing: Daily/3x Weekly Practice**
   - Go to Dashboard
   - Note count of Due cards in the Countdown tile
   - Click "Start Practice" or go to Practice in sidebar
   - Answer cards (tag filter available if you want to focus on one area)
   - For each card:
     - Read question
     - Type your answer
     - Click "Show Answer Key" to see expected answer
     - Request AI Critique if needed (optional, advisory only)
     - Self-grade: `again` (forgot), `hard` (struggled), `good` (correct with effort), `easy` (obvious)
     - Scheduler updates based on your grade
   - Repeat until Due queue is empty

3. **Weekly Sprint: Benchmark Yourself**
   - Every Sunday (or any fixed day):
     - Go to Dashboard
     - Click "Start Sprint"
     - Answer 20 items (10 open-recall + 10 MCQ) without any interruptions
     - Your score is recorded + compared to previous sprints
     - Tag breakdown shows which areas need work
     - Score feeds into Dashboard rolling average

4. **Night-Before Ritual: Review Recent Lapses**
   - Day before the interview:
     - Go to Dashboard
     - Click the Lapses tile
     - It shows every card you rated `'again'` or `'hard'` in the last 7 days
     - One click "Drill Lapses" → Opens Practice filtered to those cards
     - Quick final review of areas you struggled with

**Typical Week**:

- **Mon–Fri**: 20–30 min daily practice (answer due cards)
- **Wednesday**: Mid-week diagnostic (15 min) if needed to reassess weak tags
- **Sunday**: Sprint (25 min)
- **Thursday night (before Fri interview)**: Drill Lapses (15 min)

**Key Points**:

- MCQ Diagnostic is a diagnostic tool, not for memorization. Results inform what to drill.
- Sprints are for benchmarking and maintaining a broad review rhythm, not for new learning.
- Open-recall practice with self-grading is where the learning happens.
- Scheduler clamping ensures no card is forgotten in the final week.

### Practice Modes Explained

#### Interview Practice (Open-Recall)

- **When**: Anytime you want to practice
- **What**: Answer due cards (or filtered to a tag) in your own words
- **How**:
  1. Question appears
  2. Type your answer in the text box
  3. Click "Show Answer Key" to see expected answer
  4. Optionally request AI Critique (non-binding feedback)
  5. Self-grade: `again`, `hard`, `good`, or `easy`
  6. Scheduler updates; next card appears
- **Outcome**: FSRS scheduling updated based on your grade; review recorded

#### MCQ Diagnostic (Weakness Scanner)

- **When**: Once per week, or when you need to reassess knowledge gaps
- **What**: 15 MCQs weighted toward cold/stale tags
- **How**:
  1. Click "Start Diagnostic"
  2. Answer 15 MCQs in sequence (one per page)
  3. At the end, see Weakness Report sorted by wrong rate
  4. Drill-target list shows tags with 2+ wrong (max 3 tags)
  5. Click "Drill these tags" → Opens Interview Practice filtered to those tags
- **Outcome**: No scheduling impact. Diagnostic results identify what to drill next.

#### Sprint (Weekly Benchmark)

- **When**: Once per week (same day each week for consistency)
- **What**: Fixed 20-item session (10 open-recall + 10 MCQ) under time pressure
- **How**:
  1. Click "Start Sprint"
  2. Answer 20 items as quickly as possible
  3. Timer shows elapsed time; no strict time limit (pressure is self-imposed)
  4. At the end, see score (X/20) and tag breakdown
  5. Score added to running average on Dashboard countdown
- **Outcome**: FSRS scheduling updated for each card. Score tracked for progress monitoring.

#### Freeform MCQ Drilling (Topic Focus)

- **When**: To practice MCQs on a specific topic
- **What**: All MCQs filtered to one tag, answered in sequence
- **How**:
  1. Go to MCQ Practice in sidebar
  2. Select a tag from dropdown
  3. Answer MCQs on that tag
  4. View correctness immediately
- **Outcome**: History recorded; no FSRS impact (MCQs are diagnostic, not scheduled).

### Dashboard & Home

**Goal**: See a snapshot of your learning state at a glance.

**Layout**:

1. **Countdown Widget** (top):
   - Days until interview (clickable to set/change date)
   - Rolling sprint average score (weekly sprints)
   - % of tags in green (retention >= 80%)
   - Provides a north-star metric for interview readiness

2. **Heatmap Grid** (middle):
   - One tile per topic/tag
   - Each tile shows:
     - Tag name
     - Retention % (last 3 reviews)
     - Trend arrow (↗ improving, → stable, ↘ declining)
     - Status dot (🟢 green >= 80%, 🟡 yellow 50–80%, 🔴 red < 50%, ⚫ cold < 3 reviews)
   - Click a tile to drill that tag in Interview Practice

3. **Lapses Tile** (bottom-left):
   - Cards rated `'again'` or `'hard'` in the last 7 days
   - Thumbnail list with question text
   - One-click "Drill Lapses" button

4. **Due Queue** (bottom-right):
   - Count of cards due right now
   - Quick link to start practice

**Key Points**:

- Dashboard updates are on-demand (not real-time). Click "Refresh" or navigate away and back to refresh.
- Heatmap is computed from the last 3 reviews per card (not lifetime history), focusing on recent performance.
- Cold tags (< 3 reviews) are prioritized in the MCQ Diagnostic to ensure balanced learning.

### History & Review Timeline

**Goal**: See all your practice attempts (open-recall + MCQs) in one merged timeline.

**Features**:

1. **Merged Timeline**:
   - Every open-recall review and MCQ review in chronological order
   - Type badge (🟦 "Open-Recall" vs 🟫 "MCQ") to distinguish at a glance
   - Question, rating/correctness, timestamp

2. **Filtering**:
   - By tag (dropdown)
   - By type (Open-Recall, MCQ, or all)

3. **Analytics** (at top):
   - Total reviews
   - Total MCQ reviews
   - Retention rate (correct / total over last 3 reviews per card)
   - Weakest tags (sorted by wrong rate in last 7 days)

**Key Points**:

- History is read-only. You cannot delete or modify reviews.
- This is your audit trail of learning progress.

## Developer Workflows

### Adding a Feature

**Example**: You want to add a "Review Again" button that immediately re-queues a card.

**Steps**:

1. **Understand the spec**:
   - Read `spec.md` to understand product requirements and constraints
   - Make sure your feature aligns with the spec

2. **Identify affected layers**:
   - This feature touches: UI (button), state (handler), API (endpoint), database (query), logic (scheduler)

3. **Start with tests** (if logic or scheduler change):
   - Write test in `test/scheduler.test.ts` if you're modifying FSRS behavior
   - Example: "re-queued card should have dueAt = now"
   - Run `bun test` to verify test fails before implementation

4. **Implement in bottom-up order**:
   - **Data Layer** (`src/lib/database.ts`): Add method `requeueCard(cardId)` to mark a card due again
   - **Logic Layer** (`src/lib/scheduler.ts` or similar): If needed, pure functions for new behavior
   - **API Layer** (`src/app/api/cards/[id]/requeue/route.ts`): New endpoint `POST /api/cards/:id/requeue`
   - **State Layer** (`src/hooks/useAppState.ts`): Add handler `handleRequeueCard(cardId)`
   - **UI Layer** (`src/components/OpenRecallView.tsx`): Add button that calls handler

5. **Test at each layer**:
   - Unit test: Pure functions in isolation
   - Integration test: Database CRUD + logic combined
   - Route test: HTTP endpoint directly
   - Manual UI test: Click button in browser

6. **Before completing**:
   - Run `bun test` — all tests pass
   - Run `bun run lint` — no linting errors
   - Test `http://localhost:3000` — UI works as expected
   - Commit with clear message

### Adding a New Practice Mode

**Example**: You want to add a "Timed Drill" mode (answer X cards in Y seconds).

**Steps**:

1. **Update spec.md** with requirements (in the spec, not here)

2. **Design the data model**:
   - Do you need a new table (like `sprints` and `mcq_diagnostics`)? Create a migration in `src/migrations/`
   - Or reuse existing tables? Modify your migration accordingly
   - Run migrations on test database to verify

3. **Implement selection logic** (pure function in `src/lib/`):
   - Create `src/lib/timed-drill.ts`
   - Export `pickTimedDrillCards(cards, timeSeconds)` → array of cards to drill
   - Write tests in `test/timed-drill.test.ts`
   - Run tests to verify

4. **Add API endpoint** (`src/app/api/timed-drills/route.ts`):
   - POST to start drill → returns session
   - POST `:id/complete` to finish drill → returns score + results

5. **Add state management** in `useAppState`:
   - `timedDrillSession` state
   - `handleStartTimedDrill()`, `handleCompleteTimedDrill()` handlers

6. **Add UI component**:
   - Create `src/components/TimedDrillView.tsx`
   - Wire into `page.tsx` routing
   - Add sidebar link

7. **Test**:
   - `bun test`
   - `bun run lint`
   - Manual browser testing
   - Verify history records drill results

### Debugging a Scheduling Issue

**Scenario**: User says "I marked this card 'easy' but it's due again in 1 day instead of 7 days."

**Investigation**:

1. **Check the spec** (`spec.md`):
   - What should happen when a card is rated 'easy'?
   - Is interview-date clamping supposed to affect this?

2. **Reproduce in mock mode**:
   - Set `USE_MOCK = true` in `src/lib/mock-data.ts`
   - Answer a card with 'easy' rating
   - Check dashboard — what's the next due date?

3. **Check the database**:
   - Run `bun run dev`
   - Open DevTools Console
   - Query the database directly (if possible) or check `data/app.sqlite`
   - Look at the schedule row for the card
   - Verify `scheduledDays`, `dueAt`, etc.

4. **Trace the code**:
   - Open `src/lib/scheduler.ts` → `gradeReview()` function
   - Verify it returns correct `scheduledDays` for 'easy' rating
   - Check `applyInterviewDateClamp()` — is it clamping incorrectly?

5. **Write a test**:
   - Add test to `test/scheduler.test.ts`:
     ```typescript
     it('should schedule easy rating for 7 days if no interview date', () => {
       const schedule = gradeReview(oldSchedule, 'easy');
       expect(schedule.scheduledDays).toBe(7); // or whatever the correct value is
     });
     ```
   - Run test to confirm the bug
   - Fix the code
   - Run test again to confirm fix

6. **Test the fix end-to-end**:
   - `bun run dev`
   - Verify UI behavior matches expected behavior
   - Check database to confirm schedule is correct

### Modifying the FSRS Algorithm

**Scenario**: You want to adjust difficulty scaling or stability multipliers.

**Steps**:

1. **Locate the algorithm**: `src/lib/scheduler.ts` → `gradeReview()` function

2. **Understand the current logic**:
   - Read the FSRS paper/documentation
   - Trace through existing code
   - Understand what each parameter does

3. **Write tests for your change** (before modifying code):
   - `test/scheduler.test.ts`
   - Example: "difficulty should increase when rated 'hard'"
   - Run test to confirm current behavior

4. **Modify the algorithm**:
   - Update the calculation in `gradeReview()`
   - Keep changes minimal and focused

5. **Run tests**:
   - `bun test` — ensure your change doesn't break existing tests
   - Update tests if needed (but only if the spec changed)

6. **Document the change**:
   - Add a comment explaining the change
   - Update spec.md if it affects user-visible behavior

### Running and Writing Tests

**Run all tests**:

```bash
bun test
```

**Run tests for a specific file**:

```bash
bun test test/scheduler.test.ts
```

**Write a new test**:

1. Create or open a test file in `test/`
2. Use `bun:test` API:

```typescript
import { describe, it, expect } from 'bun:test';
import { gradeReview } from '@/lib/scheduler';

describe('gradeReview', () => {
  it('should increment reps on any rating', () => {
    const oldSchedule = { reps: 5, /* ... */ };
    const newSchedule = gradeReview(oldSchedule, 'good');
    expect(newSchedule.reps).toBe(6);
  });
});
```

**Isolate database tests**:

```typescript
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpDir = mkdtempSync(join(tmpdir(), 'test-'));
const db = createAppDatabase(join(tmpDir, 'test.sqlite'));
```

### Deploying / Preparing for Production

**Current Status**: The app is local-first and does not deploy to servers. It runs on the user's machine.

**Before Release**:

1. **Run full test suite**:
   ```bash
   bun test
   ```

2. **Lint code**:
   ```bash
   bun run lint
   ```

3. **Build**:
   ```bash
   bun run build
   ```

4. **Manual smoke test**:
   ```bash
   bun run dev
   ```
   - Sync Notion
   - Generate drafts
   - Approve a draft
   - Practice a card
   - Run a diagnostic
   - Run a sprint

5. **Check database**:
   - Verify schema migrations applied correctly
   - Spot-check a few data rows

6. **Create release notes**:
   - Document new features
   - Document bug fixes
   - Document breaking changes (if any)

### Updating Documentation

**When to update OpenWiki docs**:

- You add a new feature or change existing behavior
- You modify the API contract
- You change how data is stored or computed
- You refactor code significantly

**Where to update**:

- `openwiki/quickstart.md` — Overview, key concepts, quick start
- `openwiki/architecture.md` — Layering, data flow, key modules
- `openwiki/data-models.md` — Schema changes, new tables/columns
- `openwiki/workflows.md` — User workflows, developer workflows (this file)
- `openwiki/api-reference.md` — New endpoints, request/response changes
- `openwiki/testing.md` — New test patterns or test changes

**How to update**:

1. Make your code changes
2. Update relevant OpenWiki pages to reflect the changes
3. Verify links and cross-references work
4. Commit code + doc changes together

## Common Tasks

### Task: Add a New AI Provider

**Scenario**: Users want to use Claude instead of GPT-4.

**Steps**:

1. **Read `src/lib/ai.ts`**:
   - Understand `AiProvider` interface
   - See how `createOpenAiCompatibleProvider()` is implemented

2. **Implement Claude provider**:
   ```typescript
   // src/lib/ai.ts
   export function createClaudeProvider(apiKey: string): AiProvider {
     return {
       async generateCards(note) { /* ... */ },
       async generateMCQs(note, existing) { /* ... */ },
       async critiqueAnswer(input) { /* ... */ },
     };
   }
   ```

3. **Update AI config**:
   - Add to provider list in settings form (`src/components/SettingsView.tsx`)
   - Add to model lookup in `src/lib/ai-models.ts`

4. **Update tests**:
   - Add test case for Claude provider in `test/ai.test.ts`

5. **Update docs**:
   - Update `openwiki/quickstart.md` to mention Claude
   - Update `openwiki/workflows.md` setup instructions

### Task: Export Data

**Scenario**: User wants to export all their cards + reviews to CSV.

**Steps**:

1. **Add API endpoint** (`src/app/api/export/route.ts`):
   ```typescript
   export async function GET() {
     const db = createAppDatabase();
     const cards = db.getCards();
     const reviews = db.getReviews();
     // Format as CSV
     // Return as file download
   }
   ```

2. **Add UI button** in `src/components/SettingsView.tsx` or `HistoryView.tsx`:
   ```typescript
   onClick={() => window.open('/api/export', '_blank')}
   ```

3. **Test**:
   - Click button
   - Verify file downloads
   - Verify CSV format is correct

### Task: Change Default FSRS Parameters

**Scenario**: You want to adjust initial stability/difficulty settings.

**Steps**:

1. **Edit `src/lib/scheduler.ts`** → `createInitialSchedule()`:
   ```typescript
   export function createInitialSchedule(...) {
     return {
       stability: 0.4,        // <- adjust this
       difficulty: 5,         // <- or this
       // ...
     };
   }
   ```

2. **Update tests** to match new defaults:
   ```typescript
   // test/scheduler.test.ts
   expect(schedule.stability).toBe(0.4); // new value
   ```

3. **Run `bun test` to verify**

4. **Note in spec.md** if this is a user-facing change

5. **Consider backward compat**:
   - Do existing cards get re-initialized? (Probably not—only new cards)
   - Document in release notes
