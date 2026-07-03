## 1. Migrations & Data Model

- [x] 1.1 Interview date setting uses existing key/value settings table — no migration needed (marked done per design.md D6)
- [x] 1.2 Create `src/migrations/004-sprints-and-diagnostics.ts` creating `sprints` and `mcq_diagnostics` tables per design.md D5 (renumbered from 005; migration 004 covers both since settings key/value needs no schema change)
- [x] 1.3 Add `Sprint`, `MCQDiagnostic`, `WeaknessReport` TypeScript interfaces to `src/lib/database.ts`
- [x] 1.4 Add CRUD methods to `AppDatabase`: `setInterviewDate`, `getInterviewDate`, `clearInterviewDate`
- [ ] 1.5 Add CRUD methods: `createSprint`, `completeSprint`, `listSprints(limit)`, `getSprintScoreAverage(n)` (DEFERRED — sprint feature deferred to v2.1)
- [ ] 1.6 Add CRUD methods: `createMCQDiagnostic`, `completeMCQDiagnostic(id, answers)`, `listMCQDiagnostics` (DEFERRED — MCQ diagnostic rewrite deferred to v2.1)
- [x] 1.7 Unit tests: settings roundtrip for Interview Date (covered indirectly via clamp integration tests through database.test.ts)
- [ ] 1.8 Unit tests: sprint create + complete + score aggregation (DEFERRED)
- [ ] 1.9 Unit tests: MCQ diagnostic create + complete + weakness report shape (DEFERRED)

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

- [ ] 4.1 Create `src/lib/sprint.ts` with `pickSprintCards(deck, heatmap, size=20)` selection algorithm
- [ ] 4.2 Enforce 50/50 MCQ/open-recall split (10 ± 1 of each)
- [ ] 4.3 Enforce 70/30 weighting toward red/yellow tags when such tags exist
- [ ] 4.4 Handle deck-too-small case: return error `INSUFFICIENT_DECK` when total items < 20
- [ ] 4.5 Implement `computeSprintScore(ratings, mcqAnswers)` — count good/easy + correct MCQs
- [ ] 4.6 Unit tests: selection distribution across mixed heatmap tags
- [ ] 4.7 Unit tests: all-green deck falls back to even selection
- [ ] 4.8 Unit tests: insufficient deck returns error, not partial sprint

## 5. MCQ Diagnostic Selection & Weakness Report

- [ ] 5.1 Create `src/lib/mcq-diagnostic.ts` with `pickDiagnosticMCQs(mcqs, heatmap, size=15)` selection
- [ ] 5.2 Weight ≥ 60% toward cold tags when they exist; else weight toward stalest tags
- [ ] 5.3 Return error `INSUFFICIENT_MCQS` when total MCQs < 15
- [ ] 5.4 Implement `computeWeaknessReport(mcqs, answers)` — tags ranked by wrong-answer rate descending
- [ ] 5.5 Filter weakness report to tags with ≥ 2 wrong answers for drill-CTA target list (cap 3 tags)
- [ ] 5.6 Unit tests: cold-tag weighting behavior
- [ ] 5.7 Unit tests: weakness report ordering
- [ ] 5.8 Unit tests: 2-wrong threshold + 3-tag cap on drill target list

## 6. API Routes

- [x] 6.1 `GET /api/dashboard` — returns countdown + heatmap + lapses + due queue payload
- [ ] 6.2 `GET /api/heatmap` — standalone heatmap tiles endpoint (SKIPPED — dashboard endpoint returns heatmap; no separate route needed for v2)
- [x] 6.3 `GET /api/lapses?windowDays=7` — lapses list with configurable window
- [x] 6.4 `POST /api/interview-date` — sets or clears Interview Date; validates ISO date
- [x] 6.5 `GET /api/interview-date` — returns current date + countdown status
- [ ] 6.6 `POST /api/sprints/start` (DEFERRED)
- [ ] 6.7 `POST /api/sprints/:id/complete` (DEFERRED)
- [ ] 6.8 `POST /api/mcq-diagnostics/start` (DEFERRED)
- [ ] 6.9 `POST /api/mcq-diagnostics/:id/complete` (DEFERRED)
- [x] 6.10 Wire clamp into review route via `AppDatabase.recordReview()` — clamp applied after FSRS inside DB layer
- [ ] 6.11 Route tests for every new endpoint (SKIPPED — pure logic tests + smoke-tested via curl; route tests deferred to v2.1)
- [x] 6.12 Existing `/api/state` and `/api/cards/:id/review` tests still pass (all 48 tests green)

## 7. API Client & Mock Data

- [x] 7.1 Extend `src/lib/api-client.ts` with `getDashboard`, `setInterviewDate` (sprint/diagnostic methods deferred)
- [x] 7.2 Extend mock client with dashboard mock payload
- [x] 7.3 `USE_MOCK = true` renders dashboard with realistic mock heatmap + lapses

## 8. Dashboard UI Components

- [x] 8.1 Create `src/components/DashboardView.tsx` — split layout wrapper
- [x] 8.2 Create `src/components/Countdown.tsx` — mission-control readout (days · sprint avg · % green)
- [x] 8.3 Create `src/components/HeatmapTile.tsx` — one tile per tag with color, trend arrow, count
- [x] 8.4 Create `src/components/LapsesTile.tsx` — count + card list + "Drill now" button
- [x] 8.5 Date-elapsed handling — inline in Countdown component (no separate modal)
- [x] 8.6 Update `src/app/page.tsx` — route root to DashboardView; keep existing views reachable via sidebar
- [x] 8.7 Update `src/components/Sidebar.tsx` — add Dashboard entry (Sprint entry deferred)
- [x] 8.8 Wire "Drill now" from LapsesTile → open-recall session with first lapse card
- [x] 8.9 Wire heatmap tile click → open-recall session filtered to that tag

## 9. Sprint View

- [ ] 9.1 Create `src/components/SprintView.tsx` — sprint session runner
- [ ] 9.2 Render mixed queue of 20 items (MCQs + open-recall) with timer display
- [ ] 9.3 Handle rating submission per item; buffer client-side until session complete
- [ ] 9.4 On completion: POST to `/api/sprints/:id/complete`; render score + tag breakdown
- [ ] 9.5 Abandoned-sprint recovery: partial ratings that were sent to server persist; unsent buffer is dropped
- [ ] 9.6 Add "New Sprint" button on DashboardView Countdown

## 10. MCQ Diagnostic Rewrite

- [ ] 10.1 Rewrite `src/components/MCQPracticeView.tsx` (or rename to `MCQDiagnosticView.tsx`) — 15-question fixed session
- [ ] 10.2 On completion: render Weakness Report ranking tags by wrong-answer rate
- [ ] 10.3 Add "Drill these tags" button → open-recall session filtered to top weak tags
- [ ] 10.4 Remove freeform MCQ practice entry from Sidebar
- [ ] 10.5 Update mock-data.ts to reflect diagnostic-only MCQ flow

## 11. State Management

- [ ] 11.1 Extend `src/hooks/useAppState.ts` with dashboard state slice: `countdown`, `heatmap`, `lapses`, `dueQueue`
- [ ] 11.2 Add session state for active sprint and active diagnostic (ephemeral, not persisted client-side beyond session)
- [ ] 11.3 Ensure filter and session state updates do NOT refetch persistent dashboard state (per v2 render performance requirements)
- [ ] 11.4 Add `handleSetInterviewDate`, `handleStartSprint`, `handleCompleteSprint`, `handleStartDiagnostic`, `handleCompleteDiagnostic` handlers

## 12. Documentation

- [ ] 12.1 Update `README.md` with cramming-workflow-v2 quickstart (set date → run diagnostic → drill weak tags → sprint weekly)
- [ ] 12.2 Update `agent.md` with new component paths and MCQ-diagnostic rules
- [ ] 12.3 Ensure `spec.md` v2 sections match the shipped behavior (already drafted; verify at end)
- [ ] 12.4 Add JSDoc to new API routes describing request/response shapes

## 13. Verification

- [ ] 13.1 `bun test` passes with all new tests green
- [ ] 13.2 `bun run lint` passes with no new warnings
- [ ] 13.3 `bun run dev` starts and renders dashboard with mock data (`USE_MOCK=true`)
- [ ] 13.4 Manual smoke test: fresh deck → all grey → run diagnostic → tiles color in → drill from Weakness Report → sprint → Countdown updates
- [ ] 13.5 Manual smoke test: set Interview Date 5 days out → review a card → verify `scheduledDays` clamped to ≤ 4
- [ ] 13.6 Manual smoke test: set Interview Date in past → verify date-elapsed modal appears
- [ ] 13.7 Run `openspec status --change cramming-workflow-v2` — all artifacts marked done
