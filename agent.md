# Agent Instructions

These instructions apply to AI agents and human maintainers working inside `notion-interview-memory`.

## Mission

Maintain a private local app that helps the user memorize interview knowledge from Notion through open-recall practice, AI-assisted draft generation, optional AI critique, and spaced review scheduling.

The canonical product specification is [spec.md](./spec.md). Follow it when adding or changing behavior.

## Required Workflow

- Read [spec.md](./spec.md) before making product, API, data model, or scheduling changes.
- Read [README.md](./README.md) before changing setup, configuration, or user-facing instructions.
- Keep changes scoped to this app unless the user explicitly asks otherwise.
- Use test-driven development for behavior changes.
- Run `bun test` and `bun run lint` before claiming work is complete.
- If a dev server is needed, use `bun run dev` and verify `http://localhost:3000`.
- Do not commit secrets, real tokens, or `data/app.sqlite`.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | SPA container — thin wiring layer, component map for view routing. |
| `src/app/api/` | Next.js API route handlers (state, settings, notion, notes, drafts, cards, dashboard, interview-date, lapses, sprints, mcq-diagnostics). |
| `src/app/globals.css` | Design tokens, typography, layout, component styles. |
| `src/components/ui/` | Reusable primitives: Button, Card, Tag, Toast, MetricCard. |
| `src/components/Sidebar.tsx` | Navigation sidebar: Dashboard, Practice, Diagnostic, Sprint, Drafts, Notes, History, Settings. |
| `src/components/TopBar.tsx` | Stats bar (Due, Drafts, Reviews) + Refresh. |
| `src/components/DashboardView.tsx` | Home dashboard — Countdown + Heatmap grid + Lapses + Due Queue. |
| `src/components/Countdown.tsx` | Countdown widget (days-to-interview + sprint avg + % green). |
| `src/components/HeatmapTile.tsx` | Individual heatmap tile (retention %, trend arrow, status dot, cold state). |
| `src/components/LapsesTile.tsx` | Recent-lapses list + one-click drill button. |
| `src/components/OpenRecallView.tsx` | Open-recall practice — question, answer, critique, self-grade. |
| `src/components/MCQPracticeView.tsx` | MCQ Diagnostic — fixed 15-question session ending with Weakness Report + Drill-tags CTA. |
| `src/components/SprintView.tsx` | Fixed 20-item timed sprint (~50/50 MCQ + open-recall) with score + tag breakdown summary. |
| `src/components/DraftsView.tsx` | Draft approval queue with Approve/Reject + "Generate More MCQs" button. |
| `src/components/NotesView.tsx` | Synced notes with Generate Drafts / Open Notion. |
| `src/components/HistoryView.tsx` | Merged timeline of open-recall reviews and MCQ reviews with type badges + tag filter. |
| `src/components/MultipleChoiceView.tsx` | Legacy freeform MCQ view — no longer entered from the app (Diagnostic replaces it). Kept for shared MCQ nav primitives. |
| `src/components/SettingsView.tsx` | Settings form for Notion and AI configuration. |
| `src/lib/database.ts` | SQLite schema, persistence methods, mapping. Interview Date CRUD (`getInterviewDate` / `setInterviewDate` / `clearInterviewDate`) uses the settings key/value table. `recordReview` applies `applyInterviewDateClamp` after `gradeReview`. |
| `src/lib/migrate.ts` | Migration runner — applies numbered SQL migrations from `src/migrations/`. |
| `src/lib/notion.ts` | Notion API sync, database filters, and block mapping. |
| `src/lib/ai.ts` | AI provider interface (`generateCards`, `generateMCQs`, `critiqueAnswer`), output parsing, offline provider, and OpenAI-compatible provider. |
| `src/lib/scheduler.ts` | Pure FSRS scheduling + `applyInterviewDateClamp(schedule, interviewDate, now)` helper. `gradeReview` signature is unchanged; clamp is a separate composition step. |
| `src/lib/heatmap.ts` | Pure `computeHeatmap(cards, reviews)` — retention rate over last 3 reviews per card, cold-tag detection, thresholds. |
| `src/lib/lapses.ts` | Pure `computeLapses(cards, reviews, windowDays, now)` — most-recent-review-per-card that was `again`/`hard` within window. |
| `src/lib/countdown.ts` | Pure `computeCountdown(db, now)` — assembles the dashboard countdown payload. |
| `src/lib/sprint.ts` | Pure `pickSprintItems` + `computeSprintScore` — 20-item selection with 70/30 red-yellow weighting, score + tag breakdown. |
| `src/lib/mcq-diagnostic.ts` | Pure `pickDiagnosticMCQs` + `computeWeaknessReport` — 15-MCQ cold-weighted selection, weakness ranking + drill-tag targets. |
| `src/lib/api-client.ts` | API facade — typed client with real and mock implementations, `USE_MOCK` branching isolated here. |
| `src/lib/mock-data.ts` | Mock data for offline UI preview (`USE_MOCK` flag). |
| `src/hooks/useAppState.ts` | Shared state and event handlers for the SPA — all `useState`, handlers, API calls. |
| `src/migrations/` | Numbered SQL migration files: 001-initial, 002-mcq-questions, 003-mcq-reviews, 004-sprints-and-diagnostics. |
| `test/` | Automated tests (route tests use `mkdtempSync` + `DATA_DIR` for isolation). |
| `data/` | Ignored local SQLite runtime data. |
| `openspec/changes/` | OpenSpec change proposals — canonical source for design decisions (proposal, design, specs, tasks). |

## MCQ Rules

- MCQs are auto-approved — no draft queue, available for diagnostic immediately after generation.
- MCQ answers are recorded to `mcq_reviews` on every selection, building review history.
- MCQ prompt asks AI for 5-8 questions per note; offline provider generates up to 3.
- A "Generate More MCQs" button exists in `DraftsView` to batch-generate from all notes.
- **MCQs are diagnostic, not memory-forming.** The user enters MCQs via the "Diagnostic" sidebar entry, which runs `pickDiagnosticMCQs` (15 MCQs weighted toward stale/cold tags) and ends with a Weakness Report + one-click drill handoff to open-recall.
- MCQs do NOT have per-question FSRS scheduling; only aggregate history in `mcq_reviews`.

## Cramming-Workflow-v2 Rules

- **Interview Date is the single source of urgency.** Set via `POST /api/interview-date` (`{date: "YYYY-MM-DD"}`) or cleared with `{date: null}`. Stored in settings key/value under `interview_date`.
- **Scheduler clamp:** When an Interview Date is set, `AppDatabase.recordReview` applies `applyInterviewDateClamp` after `gradeReview` so `scheduledDays ≤ daysUntil - 1`. Never modify `gradeReview` directly — the clamp is a composition step.
- **Heatmap:** retention rate over the LAST 3 reviews per card (never lifetime); tags with `averageReviewsPerCard < 3` render grey/cold. Thresholds: green ≥ 0.80, yellow 0.50–0.80, red < 0.50.
- **Sprint** is a fixed 20-item session: exactly 10 open-recall + 10 MCQ (INSUFFICIENT_DECK otherwise); 70% weighted to red/yellow tags when they exist. Full FSRS updates apply.
- **MCQ Diagnostic** is a fixed 15-question session weighted ≥60% to cold tags (or stalest tags if none cold). Ends with Weakness Report ranked by wrong-answer rate; drill-target list = tags with ≥2 wrong, capped at 3.
- **Lapses** = cards whose most-recent review within the last 7 days (default; configurable via `?windowDays=`) was rated `again` or `hard`. A newer `good`/`easy` review clears the lapse.
- **Dashboard = single-payload endpoint** at `GET /api/dashboard` returning countdown + heatmap + lapses + due queue together.

## Migration System

- New schema changes must be added as numbered files in `src/migrations/`.
- Each migration exports `{ id, description, up(): string }`.
- The `_migrations` table tracks which migrations have been applied.
- Never modify an existing migration after it has been applied — create a new one instead.

## Non-Negotiable Requirements

- The app is local-first and single-user.
- Notion is the source of raw notes.
- SQLite is the source of learning state.
- Draft cards must not enter review until approved.
- User self-grade must control scheduling.
- AI critique must never override the user's selected rating.
- Tests must not require real Notion or AI credentials.
- Runtime data and secrets must remain local and uncommitted.

## Coding Rules

- Use TypeScript ESM modules.
- Avoid adding mandatory external npm dependencies unless the user approves the tradeoff.
- Keep modules small and testable.
- Keep business logic outside the browser UI where practical.
- Inject external dependencies in tests instead of calling real services.
- Validate AI provider output before saving it.
- Preserve existing API response shapes unless updating tests and documentation in the same change.
- Use explicit error messages for user-actionable failures.
- When making UI changes, check `src/components/` for existing patterns before writing new code.
- Component props should use explicit TypeScript interfaces, not `any`.

## Testing Rules

- Use `bun test` as the primary verification command.
- Add or update tests for every behavior change.
- Use SQLite `:memory:` for database tests.
- Use fake AI and Notion integrations in tests.
- Do not rely on worker-based test execution; use Bun's native test runner.

## Security And Privacy Rules

- Never place real values in `.env.example`.
- Never commit `.env`, `data/`, API keys, Notion tokens, or real personal note content.
- Do not log full note content during normal operation.
- Do not send notes to a network AI provider unless the configured provider requires it and the user has chosen that provider.
- Keep Notion sync read-only for v1.

## Product Rules

- Optimize for interview practice and long-term recall.
- Prefer open-recall questions over multiple-choice questions.
- Preserve the draft approval quality gate.
- Keep open-recall review flow efficient: question, answer, optional critique, self-grade, next card.
- View components should have focused prop sets (<10 props). Split mixed concerns (open-recall vs MCQ) into separate components.
- Each component owns its own tag filter state — no shared filter state between views.
- Keep settings understandable for a local private app.
- Do not add SaaS features, accounts, billing, or multi-user permissions unless explicitly requested.

## Tag Filtering

- OpenRecallView filters due cards by tag via `cardFilterTag` state; MCQPracticeView has its own internal `filterTag` state.
- DraftsView has its own internal tag filter state.
- HistoryView filters both open-recall reviews and MCQ reviews by tag + type filter (All / Open Recall / Multiple Choice).
- Each tag filter dropdown lists all unique tags across the filtered item set.

## Verification Checklist

Before reporting completion:

- `bun test` has passed in the current working tree.
- `bun run lint` has passed with no new warnings.
- Any changed API behavior is reflected in [spec.md](./spec.md).
- Any changed setup or usage behavior is reflected in [README.md](./README.md).
- Secrets and local data are not included in file changes.
- The app still starts with `bun run dev` if runtime behavior changed.
