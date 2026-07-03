## Context

The app currently exposes cards, drafts, MCQs, and history as peer navigation destinations. The user must decide what to work on every time they open the app. For the actual target user — a job seeker cramming for interviews on a 3–6 week runway — this decision cost is the biggest friction. FSRS runs "correctly" but nothing surfaces *readiness* or ties the deck to a real deadline.

Architecturally, the app is already well-suited to v2: pure `scheduler.ts`, isolated `database.ts`, a Next.js App Router structure, and a mock-friendly `api-client.ts`. The v2 changes are additive; the biggest scheduler change is a single clamp step. No new external dependencies.

**Constraints:**

- Bun 1.1+ runtime, `bun:sqlite`, Next.js App Router, single-user local app.
- Existing tests must keep passing; new behavior must ship with tests.
- No new npm dependencies.
- `data/app.sqlite` remains the single source of truth for review state.
- Existing users may have decks; migrations must not lose data.

## Goals / Non-Goals

**Goals:**

- Make the app open-to-value in under 15 seconds: one glance = "where do I stand, what should I drill next."
- Anchor the whole app on a single Interview Date without introducing per-tag targets or complex goal-tracking.
- Ship MCQs in the role they're actually good at (fast breadth scanner) instead of pretending they're equal to open-recall.
- Establish repeatable rituals (fixed-shape MCQ diagnostic + fixed-shape sprint) so users can benchmark themselves week-over-week.
- Keep the scheduler pure. All new orchestration lives above `scheduler.ts` in composition helpers or route handlers.

**Non-Goals:**

- Per-tag retention targets, mastery archival, or multi-goal management. One Interview Date, one countdown.
- MCQ FSRS scheduling. MCQs stay stateless per-question.
- AI-interviewer conversational mode. Sprint is the simulation.
- Deck editing from the History view. History is read-only except for the re-drill action.
- Notion write-back. Sync stays one-way.
- Daily-plan auto-generation. Dashboard-driven "pick your action" wins.

## Decisions

### D1: Schedule clamping is a post-FSRS transformation, not a modification to the algorithm

`scheduler.gradeReview` remains pure. A wrapper — `applyInterviewDateClamp(schedule, interviewDate)` — runs after FSRS and clamps `scheduledDays` and `dueAt`. The scheduler function signature is unchanged; a new caller layer (`src/lib/schedule-with-clamp.ts` or inline in the review route) applies the transformation when an Interview Date exists.

**Alternatives considered:**
- *Modify `gradeReview` to accept `interviewDate` directly.* Rejected — pollutes the pure scheduler with a config concern and breaks the existing test suite.
- *Compression factor that shrinks `scheduledDays` proportionally as the date approaches.* Rejected — hard to explain, hard to test, subtly bends FSRS calibration.

### D2: Retention rate uses last 3 reviews per card, not lifetime

Retention rate is defined as "fraction of cards in the tag whose most-recent review — within the last 3 reviews of that card — was `good` or `easy`." Cards with fewer than 3 reviews contribute to the "measured card count" only if they've been reviewed at least 3 times. Tags where the *average* card has < 3 reviews render grey.

**Rationale:** For a cramming user, the question is "am I still solid on this?" not "have I ever been solid?" Lifetime windows would keep stale cards green forever.

**Alternatives:**
- *Rolling 14-day window.* Rejected — creates awkward "no data" gaps for infrequently-scheduled cards.
- *FSRS stability threshold.* Rejected — opaque; users can't map "7 days stability" to intuition.

### D3: Heatmap tile status uses fixed thresholds (80% / 50%)

`green` ≥ 0.80, `yellow` 0.50 ≤ x < 0.80, `red` < 0.50, `grey` for cold tags. Thresholds are hardcoded, not user-configurable.

**Rationale:** Cramming users don't want to tune thresholds. Fixed values make screenshots comparable, tests stable, and mental models simple.

### D4: Dashboard is served by one endpoint (`GET /api/dashboard`)

All four dashboard elements load from a single payload. This avoids waterfall requests on the primary user-facing screen and gives the mock implementation one place to stub.

**Trade-off:** Payload is larger per request, but the whole app fits in a few KB of JSON. Worth the simpler client code.

### D5: Sprint and MCQ Diagnostic get their own tables

New tables: `sprints` (id, started_at, completed_at, card_ids JSON, mcq_ids JSON, score, tag_breakdown JSON) and `mcq_diagnostics` (id, started_at, completed_at, mcq_ids JSON, score, weakness_report JSON). Individual reviews still land in `reviews` / `mcq_reviews`; the new tables are session-level metadata.

**Alternatives:**
- *No new tables — reconstruct sprint history from `reviews` timestamps.* Rejected — session boundaries are fuzzy without an anchor; scoring becomes ambiguous.

### D6: Interview Date lives in the settings table, not its own table

A single row's worth of data. Adding a table would be overkill. Stored as ISO 8601 date string (no time component) in the existing settings key/value schema.

### D7: Date-passed prompt is a client-driven modal, not a server-side redirect

The server reports `countdown.status: "elapsed"` in the dashboard payload; the client renders the modal. Keeps the API declarative and lets the client control routing.

### D8: MCQ Diagnostic replaces standalone MCQ Practice mode

The current MCQPracticeView (freeform MCQ with shuffle) is repurposed as the diagnostic entry point. No separate "freeform MCQ" mode remains — this is a UX simplification: users can only enter MCQs through the diagnostic loop.

**Migration impact:** Users who liked freeform MCQ practice will notice the change. Mitigation: the diagnostic session shape (15 MCQs) is close enough to a practice session that this should feel like a refinement, not a removal.

### D9: Lapse window is 7 days, configurable via query param

Default `windowDays=7` matches the typical "last week of prep" cognitive frame. Callers can override via `GET /api/lapses?windowDays=14`.

### D10: Sprint score history lives only in the Countdown running average

No dedicated chart or "Sprint history" view in v2. The Countdown shows the mean of the last 10 sprint scores. Rationale: dashboard real estate is already dense; a chart adds noise without adding decisions.

**Reversal cost:** Adding a chart later is one component + one endpoint. Cheap to add if users ask.

## Risks / Trade-offs

- **[Clamp reduces FSRS effectiveness for long-runway users]** → Mitigation: users with runways > 12 weeks can skip setting the Interview Date, disabling clamping entirely. Documented in Settings UI copy.
- **[Fixed sprint shape may frustrate users who want longer/shorter sessions]** → Mitigation: measure usage post-launch; if users bounce off the length, consider a "quick sprint" (10 cards) variant. Do not add configurability in v2.
- **[Heatmap looks empty on day 1]** → Mitigation: onboarding copy prompts new users to run an MCQ diagnostic first, which colors in the heatmap in ~8 minutes. All-grey is honest, not broken.
- **[MCQ diagnostic weakness report may be noisy if only 15 MCQs sample the deck]** → Mitigation: report requires at least 2 wrong answers in a tag to include it in the top-drill list; single-question misses don't trigger a full drill.
- **[Removing freeform MCQ practice removes a mode users may miss]** → Mitigation: the diagnostic session *is* MCQ practice — same view, same interaction — with a productive completion screen instead of just "session over."
- **[New tables + migrations may fail on existing databases if run out of order]** → Mitigation: migrations are numbered (004, 005) and idempotent; the `_migrations` table tracks applied migrations; failures roll back.

## Migration Plan

**Migrations required (numbered files in `src/migrations/`):**

- **004-interview-date-setting.ts**: Adds `interview_date` column to settings table (nullable TEXT). Idempotent.
- **005-sprints-and-diagnostics.ts**: Creates `sprints` and `mcq_diagnostics` tables. Idempotent.

**Rollout order:**

1. Ship migrations first (backward-compatible; existing UI ignores new columns/tables).
2. Ship new API endpoints (server-side; no UI changes visible).
3. Ship new dashboard UI behind a feature flag `NEXT_PUBLIC_DASHBOARD_V2=true`, initially off.
4. Enable dashboard v2 by default in a follow-up commit once tested manually.
5. Remove the legacy home view after one week of stable operation.

**Rollback:**

- Migrations 004 and 005 do not drop or modify existing columns. Rolling back the app code and leaving the migrations in place is safe.
- If a bad clamp calculation ships, users can clear the Interview Date to disable clamping without app rollback.

## Open Questions

- Should the "% green tiles" in the Countdown weight tiles by card count (a big tag counts more than a small one), or treat every tag equally? **Provisional answer:** treat every tag equally for v2. Simpler to explain. Revisit if users have wildly-uneven tag sizes.
- What happens to sprint state if the user closes the browser mid-sprint? **Provisional answer:** sprint session is abandoned; no partial credit. Cards that received ratings during the abandoned sprint still have their FSRS updates applied. Post-v2 improvement: resumable sprints.
- When drilling from the Weakness Report, how many tags should we include by default? **Provisional answer:** include all tags with at least 2 wrong answers, capped at 3 tags.
