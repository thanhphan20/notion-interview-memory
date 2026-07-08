# Notion Interview Memory — Quickstart

**Notion Interview Memory** is a private local web app that converts a Notion knowledge database into spaced-repetition interview practice using open-recall cards, AI-generated multiple-choice questions (MCQs), and interview-date-aware scheduling.

## What It Does

- **Syncs Notion pages** to local notes with configurable topic filtering
- **Generates study materials** via AI: open-recall card drafts and MCQs
- **Approval workflow** for card drafts before they enter practice; MCQs auto-approve
- **Interview-centric scheduler** using FSRS with a countdown to a target interview date
- **Multiple practice modes**: open-recall practice, diagnostic MCQ scanning, weekly sprints, and freeform MCQ drilling
- **Unified history** merging open-recall and MCQ reviews into a single timeline
- **Local-first** with SQLite persistence; no cloud dependency

## Quick Start

```bash
# Ensure Bun is installed (https://bun.sh)
bun install
bun test          # optional but recommended
bun run dev       # starts localhost:3000
```

Then open `http://localhost:3000` in your browser. The UI runs in **Mock Data Mode** by default — all interactions work locally without Notion or AI credentials. Set `USE_MOCK = false` in `src/lib/mock-data.ts` to connect the real API.

## Key Concepts

### Interview Date & Scheduler

- Set a single target interview date; the countdown timer becomes your north star.
- FSRS scheduling automatically clamps `scheduledDays` so every card gets one more review before the interview date.
- See [Workflows: Interview Date & Scheduler Clamp](./workflows.md#interview-date--scheduler-clamp).

### Card Types & Lifecycle

- **Draft**: AI-generated open-recall card candidate waiting for approval (pending manual review)
- **Card**: An approved open-recall study item with a FSRS schedule and review history
- **MCQ**: An AI-generated multiple-choice question that auto-enters practice (no draft queue)
- **Review**: A completed practice attempt with user answer, optional AI critique, self-grade, and elapsed time
- See [Data Models](./data-models.md).

### Practice Modes

| Mode | Purpose | Count | Details |
|------|---------|-------|---------|
| **Interview Practice** | Open-recall drilling with optional AI critique | Variable | Due cards; user self-grades; full FSRS updates |
| **MCQ Diagnostic** | Weakness scanner to identify knowledge gaps | 15 MCQs | Weighted toward cold/stale tags; ends with Weakness Report + drill handoff |
| **Sprint** | Time-pressured weekly benchmark | 20 items | Fixed 50/50 MCQ + open-recall, 70% weighted to red/yellow tags; score tracked |
| **MCQ Freeform** | Topic-filtered MCQ drilling | Variable | User selects tag(s) to drill |

See [Workflows: Practice Modes](./workflows.md#practice-modes).

### Dashboard

The home dashboard shows:
- **Countdown**: Days to interview + rolling sprint average + % of cards in green
- **Heatmap grid**: One tile per tag showing retention % (last 3 reviews), trend arrow, and status (green/yellow/red/cold)
- **Lapses tile**: Cards rated `again` or `hard` in the last 7 days; one-click drill button
- **Due Queue**: Count of cards ready to review now

See [Workflows: Dashboard & Home](./workflows.md#dashboard--home).

## Project Structure

```
src/
├── app/                    Next.js 14 app directory
│   ├── api/                REST API routes (dashboard, cards, drafts, MCQs, sprints, diagnostics, Notion sync)
│   ├── page.tsx            SPA shell (component routing + state wiring)
│   └── globals.css         Design tokens, typography, layout
├── components/             React components
│   ├── ui/                 Primitives (Button, Card, Tag, Toast, MetricCard)
│   ├── DashboardView.tsx   Home view
│   ├── OpenRecallView.tsx  Open-recall practice
│   ├── MCQPracticeView.tsx Diagnostic mode
│   ├── SprintView.tsx      Sprint mode
│   ├── DraftsView.tsx      Draft approval queue
│   ├── HistoryView.tsx     Merged review timeline
│   └── SettingsView.tsx    Configuration form
├── hooks/
│   └── useAppState.ts      Shared SPA state and event handlers
├── lib/                    Business logic, no React
│   ├── ai.ts               AI provider interface (OpenAI-compatible + offline)
│   ├── database.ts         SQLite schema and CRUD
│   ├── scheduler.ts        FSRS scheduling and interview-date clamping
│   ├── heatmap.ts          Tag retention calculation
│   ├── sprint.ts           20-item sprint selection logic
│   ├── mcq-diagnostic.ts   15-MCQ diagnostic selection and weakness scoring
│   ├── lapses.ts           Recent "again"/"hard" card detection
│   ├── countdown.ts        Dashboard payload assembly
│   ├── notion.ts           Notion database sync
│   └── mock-data.ts        Offline UI preview data (USE_MOCK toggle)
├── migrations/             Numbered SQL migrations (bun:sqlite)
└── test/                   Automated tests (bun test)
```

For detailed architecture, see [Architecture](./architecture.md).

## Key Workflows

### Beginner: Cramming for an Interview (3–6 weeks)

1. **Set Interview Date** → Dashboard countdown activates
2. **Run MCQ Diagnostic** → Get Weakness Report identifying 1–3 weak tags
3. **Drill weak tags** → Open-recall practice filtered to those tags
4. **Weekly Sprints** → Benchmark yourself (20 items, same format each time)
5. **Night-before ritual** → Review cards from Lapses tile (rated "again" or "hard" recently)

See [Workflows: Beginner Cram](./workflows.md#beginner-cram-for-interview-3-6-weeks).

### Setup: Configure Notion & AI

1. In Settings, add your Notion database URL and optional AI credentials (OpenAI-compatible or offline)
2. Sync Notion database (optionally filter by topic)
3. Synced pages appear in Notes view
4. Generate drafts from notes (AI creates open-recall + MCQ candidates)
5. Approve drafts; approved cards enter practice immediately

See [Workflows: Setup & Notion Sync](./workflows.md#setup--notion-sync).

## API Reference

The app exposes a REST API for the UI:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dashboard` | GET | Dashboard payload (countdown + heatmap + lapses + due queue) |
| `/api/cards` | GET | All cards; POST creates a card |
| `/api/drafts` | GET | All drafts; POST creates draft |
| `/api/drafts/:id/approve` | POST | Approve a draft → create card + schedule |
| `/api/drafts/:id/reject` | POST | Reject a draft |
| `/api/cards/:id/review` | POST | Submit open-recall review (answer + rating) |
| `/api/cards/:id/critique` | POST | Request AI critique for an answer |
| `/api/mcqs` | GET | All MCQs |
| `/api/mcqs/:id/review` | POST | Submit MCQ review (selected index) |
| `/api/sprints` | POST | Start sprint; `/api/sprints/:id/complete` to finish |
| `/api/mcq-diagnostics` | POST | Start diagnostic; `/api/mcq-diagnostics/:id/complete` to finish |
| `/api/interview-date` | GET/POST | Get or set interview date |
| `/api/notes` | GET | All synced notes |
| `/api/notion/sync` | POST | Sync Notion database |
| `/api/settings` | GET/POST | Get or set app configuration |

See [API Reference](./api-reference.md) for full details.

## Data Models

The app stores data in SQLite with these main tables:

- **notes**: Synced Notion pages
- **card_drafts**: AI-generated open-recall card candidates (pending approval)
- **cards**: Approved open-recall cards with tags
- **schedules**: FSRS scheduling state per card (due date, stability, difficulty, reps, lapses, state)
- **reviews**: Open-recall practice attempts (answer, rating, optional AI feedback, elapsed time)
- **mcq_questions**: AI-generated multiple-choice questions (auto-approved)
- **mcq_reviews**: MCQ practice attempts (selected index, correctness, timestamp)
- **sprints**: Fixed 20-item sprint sessions with score and tag breakdown
- **mcq_diagnostics**: Fixed 15-MCQ diagnostic sessions with weakness report
- **settings**: Key/value configuration (Notion URL, AI provider, interview date)

See [Data Models](./data-models.md) for full schema and relationships.

## Architecture

### Layered Design

- **UI Layer** (`src/components/`): React components for each view and interaction
- **State Layer** (`src/hooks/useAppState.ts`): Shared SPA state, event handlers, API calls
- **API Layer** (`src/app/api/`): REST endpoint handlers with no dependencies on React
- **Logic Layer** (`src/lib/`): Pure functions for business logic (FSRS scheduling, heatmap, diagnostics, etc.)
- **Data Layer** (`src/lib/database.ts`): SQLite CRUD and schema management via migrations

### Key Design Principles

- **Pure functions** for deterministic logic (scheduler, heatmap, sprint selection)
- **API routes isolated** from React to enable testing and possible CLI/headless use
- **Mock data mode** for UI development without backend or credentials
- **Interview-date awareness** baked into the scheduler for cramming-optimized behavior
- **Local-first**: SQLite persists all state; Notion is read-only for sync

See [Architecture](./architecture.md) for details.

## Testing

The project uses **bun test** with comprehensive coverage of:

- **Scheduler** (FSRS, interview-date clamping)
- **Heatmap** (retention calculation, cold-tag detection)
- **Sprint selection** (item weighting, tag breakdown)
- **MCQ Diagnostic** (cold-tag weighting, weakness scoring)
- **Lapses detection** (time-window filtering)
- **API routes** (dashboard, draft approval, review recording)
- **Database** (CRUD operations, migrations)

Run tests:
```bash
bun test
```

See [Testing Guide](./testing.md) for patterns and how to add tests.

## Configuration & Secrets

### Environment Variables

- `DATA_DIR`: Path to SQLite database directory (default: `./data`)
- `OPENAI_API_KEY` (if using OpenAI provider): Your API key (not committed)
- `OPENAI_API_BASE` (optional): Override API endpoint for OpenAI-compatible providers

### Mock Data Mode

Set `USE_MOCK = true` in `src/lib/mock-data.ts` for offline development. Set to `false` to use real Notion + AI.

### Notion Configuration

In Settings, configure:
- **Notion Database URL** (the page containing your database)
- **Topic filter** (optional; filter by property value during sync)

### AI Configuration

In Settings, configure:
- **Provider** (OpenAI-compatible or offline)
- **Model** (defaults to `gpt-4-mini` for OpenAI)
- **API Key** (OpenAI-compatible providers only)
- **API Base** (optional; for custom endpoints)

See [Workflows: Setup & Configuration](./workflows.md#setup--configuration).

## Common Tasks

### Add a New Card Manually

1. Create a note in Notion or sync an existing one
2. In Notes view, click "Generate Drafts"
3. Review generated draft in Drafts view
4. Click "Approve" to create a card and schedule

### Change Interview Date

1. Go to Dashboard
2. Click the Countdown tile
3. Enter a new date or clear it
4. Scheduler automatically recalculates clamps for all future reviews

### Drill Weak Tags (After Diagnostic)

1. Run MCQ Diagnostic from sidebar
2. At the end, see Weakness Report ranked by wrong rate
3. Click "Drill these tags" → Opens Interview Practice filtered to weak tags
4. Practice until you feel confident

### Start a Sprint

1. Go to Dashboard
2. Click "Start Sprint" or go to sidebar → Sprint
3. Answer 20 items (10 open-recall + 10 MCQ) under time pressure
4. At end, see score + tag breakdown
5. Can be repeated weekly to track progress

### View All Reviews

1. Go to History from sidebar
2. See merged timeline of open-recall reviews and MCQ reviews
3. Filter by tag or review type
4. Export or analyze patterns

## Troubleshooting

- **UI shows no cards**: Check that drafts have been approved. Rejected or pending drafts do not appear in practice.
- **Scheduler seems off**: Ensure Interview Date is set correctly. If unset, FSRS runs with unbounded scheduling.
- **MCQ Diagnostic is empty**: Generate MCQs from notes first. MCQs are auto-approved and populate the diagnostic pool immediately.
- **Settings not saving**: Check that your browser allows localStorage. The app persists UI state and API configuration in localStorage.
- **Notion sync fails**: Verify your Notion database URL, ensure the page is shared, and check that your AI provider is configured if auto-draft generation is enabled.

## Next Steps

- **Architecture**: Read [Architecture](./architecture.md) to understand layering, modules, and design decisions.
- **Workflows**: Read [Workflows](./workflows.md) for detailed step-by-step user and developer workflows.
- **Data Models**: Read [Data Models](./data-models.md) to understand the SQLite schema and how data flows.
- **API Reference**: Read [API Reference](./api-reference.md) for all endpoints and request/response contracts.
- **Testing**: Read [Testing Guide](./testing.md) to understand test patterns and add new tests.
- **Spec**: Read [spec.md](../spec.md) for the authoritative product specification and requirements.
- **Agent Instructions**: Read [agent.md](../agent.md) for project-specific agent guidelines.

## At a Glance

| Aspect | Tech/Approach |
|--------|---|
| Runtime | Bun ≥1.1.0 |
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript (ESM) |
| Database | Bun `bun:sqlite` |
| Tests | bun test |
| Design | Orange/Geist High-Contrast Modern |
| State | Client-side React + localStorage |
| Scheduling | FSRS with interview-date clamping |
| AI | OpenAI-compatible or offline provider |
| Local-first | All data in SQLite; no cloud |
