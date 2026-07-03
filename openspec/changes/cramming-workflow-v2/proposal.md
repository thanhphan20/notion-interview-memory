## Why

The app was built as a general-purpose spaced-repetition tool for Notion notes, but its actual value is highest for a specific persona: a job seeker cramming for real interviews on a 3–6 week runway. Today the UI surfaces cards, drafts, MCQs, and history as peers, forcing the user to *decide* what to do next every time they open the app. For a cramming user, decision fatigue is the enemy — they need one glance to know where they stand and what to drill next.

This change reframes v2 around the cramming persona: a single Interview Date becomes the north star, a dashboard heatmap answers "where am I weak?" in one glance, and MCQs are demoted to a diagnostic role (their strength) rather than competing with open-recall as memory-building practice.

## What Changes

- Add **Interview Date** as a single global setting that drives countdown, scheduling clamp, and prioritization.
- Add **home dashboard** with split layout: mission-control Countdown + Heatmap tile + Lapses tile + Due Queue.
- Add **Heatmap** — tag tiles colored by retention rate (last 3 reviews per card), with rating-average trend arrows and grey "not measured" state for cold tags.
- Add **schedule clamping**: FSRS `scheduledDays` is capped at `days_until_interview - 1` when an Interview Date is set. **BREAKING** for scheduler consumers that assume raw FSRS output.
- Add **Sprint** feature: fixed 20 cards, ~50/50 MCQ/open-recall mix, 70% red-weighted; full FSRS updates; score feeds Countdown running average.
- Reframe **MCQ Diagnostic**: fixed 15 MCQs weighted toward stale/cold tags, ending with a Weakness Report + one-click "Drill these tags" open-recall handoff. Replaces the freeform MCQ practice mode.
- Add **Lapses tile** and re-drill flow: cards rated `again`/`hard` in the last 7 days, with one-click "Drill now".
- Add **date-passed modal**: prompt user to set a new date, pause, or enter browse mode when the Interview Date passes.
- Explicit **non-goals for v2** (documented but not built): per-tag retention targets, mastery archival, MCQ FSRS scheduling, AI-interviewer mode, deck editing from history, Notion write-back.

## Capabilities

### New Capabilities

- `interview-date`: Single global date setting; drives countdown, schedule clamp, and prioritization.
- `dashboard`: Split home dashboard aggregating countdown, heatmap, lapses, and due queue.
- `heatmap`: Tag-level retention scoring with color/trend/cold-state rendering.
- `sprint`: Fixed-shape timed practice session with full FSRS updates and score history.
- `mcq-diagnostic`: Weakness-weighted MCQ session ending with a weakness report and one-click drill handoff.
- `lapses`: Recent-lapse queue and re-drill session flow.

### Modified Capabilities

None — this is a v2 product model built on top of the existing scheduler and database. No existing capability specs exist yet in `openspec/specs/`, so all product behaviors are introduced as new capabilities.

## Impact

**Affected code:**
- `src/lib/scheduler.ts` — add clamp step after FSRS interval computation.
- `src/lib/database.ts` + `src/migrations/` — new tables: `sprints`, `mcq_diagnostics`; new settings row for `interviewDate`.
- `src/app/api/` — new routes: `/api/dashboard`, `/api/heatmap`, `/api/lapses`, `/api/interview-date`, `/api/sprints/*`, `/api/mcq-diagnostics/*`.
- `src/components/` — new views: `DashboardView`, `SprintView`; rewrite `MCQPracticeView` as diagnostic-only; new `LapsesTile`, `HeatmapTile`, `Countdown` primitives.
- `src/hooks/useAppState.ts` — extend state with dashboard payload, sprint session, diagnostic session.
- `src/lib/api-client.ts` — new client methods; mock implementations for USE_MOCK.

**Affected APIs:**
- 9 new HTTP endpoints (see design.md).
- Existing `/api/state` remains for legacy compatibility; new `/api/dashboard` is the primary home payload.

**Dependencies:** No new npm dependencies.

**Data model:** Two new tables (`sprints`, `mcq_diagnostics`) via numbered migrations 004 and 005. Settings gains `interview_date` (nullable ISO date string).

**Breaking:** Scheduler output changes when Interview Date is set — callers relying on raw FSRS `scheduledDays` must accept clamped values.
