## 1. Migrations & Data Model

- [x] 1.1 Interview date setting uses existing key/value settings table — no migration needed (per design.md D6)
- [x] 1.2 Create `src/migrations/004-sprints-and-diagnostics.ts` creating `sprints` and `mcq_diagnostics` tables per design.md D5
- [x] 1.3 Add `Sprint`, `MCQDiagnostic`, `WeaknessReportEntry`, `SprintTagBreakdown` TypeScript interfaces to `src/lib/database.ts`
- [x] 1.4 Add CRUD methods to `AppDatabase`: `setInterviewDate`, `getInterviewDate`, `clearInterviewDate`
- [x] 1.5 Add CRUD methods: `createSprint`, `completeSprint`, `getSprint`, `listSprints(limit)`, `getSprintScoreAverage(n)`
- [x] 1.6 Add CRUD methods: `createMCQDiagnostic`, `completeMCQDiagnostic`, `getMCQDiagnostic`, `listMCQDiagnostics`
- [x] 1.7 Unit tests: settings roundtrip for Interview Date — `test/database-v2.test.ts`
- [x] 1.8 Unit tests: sprint create + complete + score aggregation — `test/database-v2.test.ts`
- [x] 1.9 Unit tests: MCQ diagnostic create + complete + weakness report shape — `test/database-v2.test.ts`

## 2. Scheduler Clamp

- [x] 2.1 Add `applyInterviewDateClamp(schedule, interviewDate)` helper in `src/lib/scheduler.ts` (pure function, no coupling to DB)
- [x] 2.2 Ensure `gradeReview` signature is unchanged; clamp is applied by callers, not inside `gradeReview`
- [x] 2.3 Unit test: FSRS proposes 14 days, only 8 remain → clamped to 7
- [x] 2.4 Unit test: FSRS proposes 3 days, 8 remain → unchanged
- [x] 2.5 Unit test: no Interview Date set → no clamping applied
- [x] 2.6 Unit test: clamp never produces `scheduledDays < 0`

## 3. Heatmap Computation

- [x] 3.1 Create `src/lib/heatmap.ts` with pure `computeHeatmap(cards, reviews)` function
- [x] 3.2 Implement retention rate over last 3 reviews per card
- [x] 3.3 Implement cold-tag detection: `averageReviewsPerCard < 3` → grey
- [x] 3.4 Implement rating-average trend: mean(last 3) − mean(prior 3), averaged across cards
- [x] 3.5 Implement color-status thresholds: green ≥ 0.80, yellow 0.50–0.80, red < 0.50, grey for cold
- [x] 3.6 Unit tests: fresh deck (no reviews) → all tiles grey
- [x] 3.7 Unit tests: retention 78% → yellow, 82% → green, 45% → red
- [x] 3.8 Unit tests: last-3 window ignores earlier reviews
- [x] 3.9 Unit tests: trend arrow up/down/neutral cases

## 4. Sprint Selection & Scoring

- [x] 4.1 Create `src/lib/sprint.ts` with `pickSprintItems(cards, mcqs, heatmap, size=20, rng?)` selection algorithm
- [x] 4.2 Enforce 50/50 MCQ/open-recall split (10 ± 1 of each)
- [x] 4.3 Enforce 70/30 weighting toward red/yellow tags when such tags exist
- [x] 4.4 Handle deck-too-small case: throw `INSUFFICIENT_DECK` when total items < 20
- [x] 4.5 Implement `computeSprintScore(ratings, mcqAnswers, cards, mcqs)` — count good/easy + correct MCQs + tag breakdown
- [x] 4.6 Unit tests: selection distribution across mixed heatmap tags
- [x] 4.7 Unit tests: all-green deck falls back to even selection
- [x] 4.8 Unit tests: insufficient deck throws error, not partial sprint

## 5. MCQ Diagnostic Selection & Weakness Report

- [x] 5.1 Create `src/lib/mcq-diagnostic.ts` with `pickDiagnosticMCQs(mcqs, reviews, heatmap, size=15, rng?)` selection
- [x] 5.2 Weight ≥ 60% toward cold tags when they exist; else weight toward stalest tags
- [x] 5.3 Throw `INSUFFICIENT_MCQS` when total MCQs < 15
- [x] 5.4 Implement `computeWeaknessReport(mcqs, answers)` — tags ranked by wrong-answer rate descending
- [x] 5.5 Filter weakness report to tags with ≥ 2 wrong answers for drill-CTA target list (cap 3 tags)
- [x] 5.6 Unit tests: cold-tag weighting behavior
- [x] 5.7 Unit tests: weakness report ordering
- [x] 5.8 Unit tests: 2-wrong threshold + 3-tag cap on drill target list

## 6. API Routes

- [x] 6.1 `GET /api/dashboard` — returns countdown + heatmap + lapses + due queue payload
- [ ] 6.2 `GET /api/heatmap` — standalone heatmap tiles endpoint (SKIPPED — dashboard endpoint returns heatmap; redundant for v2)
- [x] 6.3 `GET /api/lapses?windowDays=7` — lapses list with configurable window
- [x] 6.4 `POST /api/interview-date` — sets or clears Interview Date; validates ISO date
- [x] 6.5 `GET /api/interview-date` — returns current date + countdown status
- [x] 6.6 `POST /api/sprints/start` — creates sprint, returns selected cards + MCQs
- [x] 6.7 `POST /api/sprints/:id/complete` — records ratings, applies FSRS + clamp, returns score
- [x] 6.8 `POST /api/mcq-diagnostics/start` — creates diagnostic, returns 15 MCQs
- [x] 6.9 `POST /api/mcq-diagnostics/:id/complete` — records answers, returns weakness report
- [x] 6.10 Wire clamp into review route via `AppDatabase.recordReview()` — clamp applied after FSRS inside DB layer
- [ ] 6.11 Route tests for every new endpoint (SKIPPED — pure logic covered by unit tests, live smoke-tested via curl)
- [x] 6.12 Existing `/api/state` and `/api/cards/:id/review` tests still pass (all 67 tests green with clamp active)

## 7. API Client & Mock Data

- [x] 7.1 Extend `src/lib/api-client.ts` with `getDashboard`, `setInterviewDate`, `startSprint`, `completeSprint`, `startMCQDiagnostic`, `completeMCQDiagnostic`
- [x] 7.2 Mock client returns dashboard payload; sprint/diagnostic throw a clear "not available in mock mode" error (require real DB for reproducibility)
- [x] 7.3 `USE_MOCK = true` renders dashboard with realistic mock heatmap + lapses

## 8. Dashboard UI Components

- [x] 8.1 Create `src/components/DashboardView.tsx` — split layout wrapper
- [x] 8.2 Create `src/components/Countdown.tsx` — mission-control readout (days · sprint avg · % green)
- [x] 8.3 Create `src/components/HeatmapTile.tsx` — one tile per tag with color, trend arrow, count
- [x] 8.4 Create `src/components/LapsesTile.tsx` — count + card list + "Drill now" button
- [x] 8.5 Date-elapsed handling — inline in Countdown component (no separate modal)
- [x] 8.6 Update `src/app/page.tsx` — route root to DashboardView; keep existing views reachable via sidebar
- [x] 8.7 Update `src/components/Sidebar.tsx` — add Dashboard, Diagnostic, Sprint entries
- [x] 8.8 Wire "Drill now" from LapsesTile → open-recall session with first lapse card
- [x] 8.9 Wire heatmap tile click → open-recall session filtered to that tag

## 9. Sprint View

- [x] 9.1 Create `src/components/SprintView.tsx` — sprint session runner
- [x] 9.2 Render interleaved queue of 20 items (MCQs + open-recall) with progress bar
- [x] 9.3 Handle rating submission per item; buffer client-side until session complete
- [x] 9.4 On completion: POST to `/api/sprints/:id/complete`; render score + tag breakdown
- [ ] 9.5 Abandoned-sprint recovery (DEFERRED per design — abandon returns to dashboard; unsent buffer dropped, no partial credit)
- [x] 9.6 "Start sprint" + "Run diagnostic" CTAs in DashboardView section-heading

## 10. MCQ Diagnostic Rewrite

- [x] 10.1 Rewrite `src/components/MCQPracticeView.tsx` — 15-question fixed diagnostic session
- [x] 10.2 On completion: render Weakness Report ranking tags by wrong-answer rate
- [x] 10.3 Add "Drill these tags" button → open-recall session filtered to top weak tags
- [x] 10.4 Remove freeform MCQ practice entry from Sidebar / Practice tabs (Practice view now = Open Recall only)
- [ ] 10.5 Update mock-data.ts (SKIPPED — mock client returns clear "not available in mock mode" error; diagnostic requires real deck)

## 11. State Management

- [x] 11.1 Extend `src/hooks/useAppState.ts` with dashboard state slice: `dashboard` (payload with countdown/heatmap/lapses/dueQueue)
- [x] 11.2 Add session state for active sprint (`sprintSession`, `sprintResult`) and active diagnostic (`diagnosticSession`, `diagnosticResult`)
- [ ] 11.3 Ensure filter and session state updates do NOT refetch persistent dashboard state (DEFERRED — current implementation triggers refresh; state splitting refactor is a separate PR)
- [x] 11.4 Add `handleSetInterviewDate`, `handleStartSprint`, `handleCompleteSprint`, `handleStartDiagnostic`, `handleCompleteDiagnostic`, `handleDrillTags`, `handleExit*` handlers

## 12. Documentation

- [x] 12.1 Update `README.md` with cramming-workflow-v2 quickstart
- [x] 12.2 Update `agent.md` with new component paths and MCQ-diagnostic rules
- [x] 12.3 `spec.md` reverted to pre-v2 state; OpenSpec change is the canonical source
- [ ] 12.4 JSDoc on API routes (SKIPPED — routes are small, self-documenting; deferred)

## 13. Verification

- [x] 13.1 `bun test` passes with all new tests green (74 pass across 11 files)
- [x] 13.2 `bun run lint` passes with no new warnings
- [x] 13.3 `bun run build` succeeds; all new routes registered
- [x] 13.4 Manual smoke test: `/api/dashboard`, `/api/sprints/start`, `/api/mcq-diagnostics/start` all respond correctly (including structured INSUFFICIENT_* errors)
- [x] 13.5 Clamp verified via scheduler-clamp unit tests + integration through recordReview
- [x] 13.6 Date-elapsed handling verified in Countdown component
- [x] 13.7 `openspec validate cramming-workflow-v2` passes
