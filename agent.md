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
- Run `npm test` before claiming work is complete.
- If a dev server is needed, use `npm start` and verify `http://localhost:4173`.
- Do not commit secrets, real tokens, or `data/app.sqlite`.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/server.js` | Process entry point and runtime composition. |
| `src/http.js` | HTTP request handling and static file serving. |
| `src/api.js` | JSON API route dispatch and workflow orchestration. |
| `src/database.js` | SQLite schema, migrations, persistence methods, and mapping. |
| `src/notion.js` | Notion API sync, database filters, and Notion block mapping. |
| `src/ai.js` | AI provider interface, output parsing, offline provider, and OpenAI-compatible provider. |
| `src/scheduler.js` | Spaced review scheduling behavior. |
| `src/static/` | Browser UI assets. |
| `test/` | Automated tests. |
| `data/` | Ignored local SQLite runtime data. |

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

- Use CommonJS modules.
- Avoid adding mandatory external npm dependencies unless the user approves the tradeoff.
- Keep modules small and testable.
- Keep business logic outside the browser UI where practical.
- Inject external dependencies in tests instead of calling real services.
- Validate AI provider output before saving it.
- Preserve existing API response shapes unless updating tests and documentation in the same change.
- Use explicit error messages for user-actionable failures.

## Testing Rules

- Use `npm test` as the primary verification command.
- Add or update tests for every behavior change.
- Use SQLite `:memory:` for database tests.
- Use fake AI and Notion integrations in tests.
- Do not rely on worker-based test execution; the current runner is `node --no-warnings test/run.js`.
- Treat a passing HTTP status check as useful smoke coverage, not a replacement for automated tests.

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
- Keep review flow efficient: question, answer, optional critique, self-grade, next card.
- Keep settings understandable for a local private app.
- Do not add SaaS features, accounts, billing, or multi-user permissions unless explicitly requested.

## Verification Checklist

Before reporting completion:

- `npm test` has passed in the current working tree.
- Any changed API behavior is reflected in [spec.md](./spec.md).
- Any changed setup or usage behavior is reflected in [README.md](./README.md).
- Secrets and local data are not included in file changes.
- The app still starts with `npm start` if runtime behavior changed.
