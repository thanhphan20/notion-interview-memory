# Notion Interview Memory

A private local web app that turns a Notion knowledge database into interview-style
spaced review practice.

## What It Does

- Syncs selected pages from one Notion database into local notes.
- Converts synced notes into open-recall interview question drafts via AI.
- Keeps drafts out of review until you approve them (quality gate).
- Runs interview practice from due FSRS-style schedules.
- Supports optional AI answer critique while keeping the final grade user-controlled.
- Stores all learning state locally in SQLite under `data/app.sqlite`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun `>=1.1.0` |
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript (ESM) |
| Database | `bun:sqlite` |
| Test Runner | `bun test` |
| Design System | Orange/Geist High-Contrast Modern (via Google Stitch MCP) |

## Quick Start

```sh
# Ensure Bun is installed (https://bun.sh) or use the local binary:
# /Users/golden-owl/.bun/bin/bun

bun install
bun test
bun run dev
```

Open `http://localhost:3000`.

## Mock Data Mode

The UI can run fully offline with realistic mock data — no Notion setup or API keys needed.

Set `USE_MOCK = true` in `src/lib/mock-data.ts` (default). All interactions
(answer, critique, approve, reject, review) work locally. Flip to `false` to
connect the real API.

## Project Structure

```
src/
├── app/
│   ├── api/              Next.js API route handlers
│   ├── globals.css       Global styles (Orange/Geist tokens, typography)
│   ├── layout.tsx        Root layout
│   └── page.tsx          SPA container (state + API logic)
├── components/
│   ├── ui/               Primitives: Button, Card, Tag, Toast, MetricCard
│   ├── Sidebar.tsx       Navigation sidebar
│   ├── TopBar.tsx        Stats bar
│   ├── PracticeView.tsx  Answer → critique → self-grade workflow
│   ├── DraftsView.tsx    Draft approval queue
│   ├── NotesView.tsx     Synced note list
│   ├── HistoryView.tsx   Past reviews with rating badges
│   └── SettingsView.tsx  Notion & AI config form
└── lib/
    ├── ai.ts             AI provider interface & output parsing
    ├── database.ts       SQLite schema, migrations, CRUD
    ├── mock-data.ts      Mock data for offline preview
    ├── notion.ts         Notion API sync & block extraction
    └── scheduler.ts      FSRS-style spaced repetition
```

## Configuration

Configure the app in the **Settings** screen (recommended) or via environment
variables (see `.env.example`).

### Notion Setup

1. Create a Notion integration and copy its internal integration token.
2. Share your knowledge database with that integration.
3. Enter the database ID, title property, topic property, and topic filters.

### AI Setup

- `offline` — works without network or keys. Useful for testing the full flow.
- `openai-compatible` — calls a `/chat/completions` endpoint. Requires API key,
  base URL, and model name.

## Review Flow

1. Sync selected Notion topics.
2. Generate drafts from a synced note.
3. Approve useful drafts.
4. Practice due cards.
5. Optionally request AI critique.
6. Self-grade with `Again`, `Hard`, `Good`, or `Easy`.

The self-grade is the only input used for scheduling.

## Design System

The UI uses the **Orange/Geist High-Contrast Modern** design system generated via
Google Stitch MCP.

| Token | Value |
|-------|-------|
| Background | `#131313` |
| Panels | `#201f1f` |
| Primary accent | `#ff9800` |
| Body font | Geist |
| Label font | JetBrains Mono |
| Border radius | 4px |
| Spacing grid | 8px base |

Stitch project: `projects/6935587743182712761`

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run start` | Production server |
| `bun run lint` | Run ESLint |
| `bun test` | Run test suite |
