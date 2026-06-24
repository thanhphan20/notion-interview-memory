# Notion Interview Memory

A private localhost app for turning a Notion knowledge database into interview-style spaced review.

## What It Does

- Syncs selected pages from one Notion database.
- Converts synced notes into open-recall interview question drafts.
- Keeps drafts out of review until you approve them.
- Runs interview practice from due FSRS-style schedules.
- Supports optional AI answer critique while keeping the final grade user-controlled.
- Stores all learning state locally in SQLite under `data/app.sqlite`.

## Quick Start

```powershell
cd E:\Repository\notion-interview-memory
bun test
bun run dev
```

Open `http://localhost:3000`.

## Configuration

The app can be configured in the Settings screen or with environment variables copied from `.env.example`.

Notion setup:

- Create a Notion integration and copy its internal integration token.
- Share your knowledge database with that integration.
- Set the database ID, title property, topic property, and selected topic filters.

AI setup:

- `offline` works without network or keys and is useful for testing the full flow.
- `openai-compatible` calls a `/chat/completions` endpoint using `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`.

## Review Flow

1. Sync selected Notion topics.
2. Generate drafts from a synced note.
3. Approve useful drafts.
4. Practice due cards.
5. Optionally request AI critique.
6. Self-grade with `Again`, `Hard`, `Good`, or `Easy`.

The self-grade is the only input used for scheduling.
