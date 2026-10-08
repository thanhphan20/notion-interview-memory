## Context

The app already has R1–R10 local roadmap notes seeded through `scripts/seed-roadmaps.ts`. `RoadmapsView` currently prints every section and every content line at once, which is the visual issue the user reported. Separately, `E:\Repository\career-ops\interview-prep\revision-checklist.md` is the current full syllabus source: Part 1 contains the large fundamentals checklist organized by numbered headings and bold subcategories; Part 2 contains known weak spots; Part 3 contains pipeline-specific table rows and decisions; Part 4 gives a numbered revision order.

This source includes personal career context and is outside the app repository. The app is local-first and already stores durable user state in SQLite. The imported checklist must not be folded into the Notion notes feed or fetched on every application-state refresh.

## Goals / Non-Goals

**Goals:**

- Make existing R1–R10 roadmaps scannable and expandable, without removing them or changing their generate-drafts behavior.
- Provide a separate checklist screen for all four parts of the revision source, including the large Part 1, without showing hundreds of items as one wall of text.
- Preserve authored source text and its status / `[CV]` / `[JD]` / `[fund]` signals.
- Track the user's current checklist completion and their own key takeaway independently for every item.
- Make importing repeatable while preserving user-entered progress and avoiding silent loss of takeaways.
- Keep runtime behavior local and avoid adding a dependency.

**Non-Goals:**

- Replacing or deleting the existing R1–R10 roadmap content.
- Syncing checklist state back to career-ops, Notion, or any remote service.
- Generating or fabricating key takeaways for the user.
- Automatically treating an authored `✅` source mark as a newly completed checklist item.
- Fuzzy matching reworded checklist items across imports.

## Decisions

### D1: Import the sibling markdown file into SQLite; do not copy it into this repo

Add an explicit importer CLI that reads a path argument, then `CHECKLIST_FILE`, then a documented sibling-repository default (`../career-ops/interview-prep/revision-checklist.md`). A missing or malformed source produces a clear non-zero error. The parser is pure and tested with an inline fixture; tests never depend on the personal sibling repository.

On successful import, the database contains the source snapshot fields required to render each item. The running web app no longer depends on the sibling repository being present. The source markdown itself is not copied into tracked app files; the runtime SQLite file remains under ignored `data/`.

**Alternatives considered:**
- Copy the markdown into this repository: easier to distribute, but duplicates private career material and creates two sources of truth.
- Hand-convert the checklist to a structured data file: explicit, but requires maintaining a second large representation manually.

### D2: Parse all four parts into an ordered checklist hierarchy

Represent each actionable bullet, numbered entry, or Part 3 data row as one checklist item. H1 part, H2 section, and standalone bold subsection labels establish its hierarchy. Part 4's recap steps remain independent checklist items even when they restate a topic from Parts 1–3. Keep the original document order.

Parse the existing document's markdown shapes explicitly: bullets, ordered lists, standalone bold subcategory headings, and the Part 3 table. Keep explanatory prose as section context where useful, not as a checkbox. Status marks and labels are parsed into separate fields instead of being conflated with item text or user progress. An unknown actionable structure must be surfaced by the importer rather than silently discarded.

### D3: Source marks are read-only metadata; user completion begins unchecked

An imported source mark (`✅`, `🟡`, `🔴`, `⚠️`) is shown as an authored status badge. `[CV]`, `[JD]`, and `[fund]` remain distinct badges. A user's completion checkbox is a separate SQLite field and starts unchecked regardless of the source mark, since the source describes historical drilling and the app checkbox represents this pass through the checklist. A decision-marked item remains trackable as a decision step.

### D4: Use stable text-derived keys and non-destructive re-imports

Create a deterministic `item_key` from the part key, section/category path, and normalized item text. Exclude volatile status marks from the normalized key. Re-import updates the source text, source marks, hierarchy, and order while preserving existing `done` and `takeaway` values for matching keys.

Items absent from a later source import are soft-archived, never hard-deleted. If they reappear with the same key, reactivate them with their saved user state. A reworded item receives a new key; its old record remains archived so its takeaway is not destroyed. Supporting identity across rewording by adding IDs to the external source is deferred.

### D5: Checklist uses a dedicated API and only loads when needed

Add `GET /api/checklist` for the active imported items and `PATCH /api/checklist/[id]` for validated updates to `done` and/or `takeaway`. The Checklist view fetches its data when opened and updates only the edited item. Do not extend `/api/state`, which refreshes notes, cards, drafts, and review data on many unrelated actions.

Completion toggles update optimistically and revert with a visible error if persistence fails. Takeaway text is saved on blur (with a saving/saved/error indication) rather than issuing a request for every keystroke.

### D6: Make the Checklist progressive and the Roadmaps view compact

The Checklist screen shows all four Parts with completion counts and overall progress. The user selects a Part, then expands one section/category at a time; each row shows a checkbox, source text, source-status/claim badges, and a collapsed takeaway editor. Provide a text filter across the imported items so the large syllabus remains searchable. Progress is derived from the user's checkbox state, not source marks.

Redesign the existing Roadmaps view as compact R1–R10 rows/cards that show the key/title and expand to reveal the full content and existing Generate Drafts action. Keep sections collapsed initially to avoid the current long, fully expanded page.

### D7: Checklist item table is additive and safe to roll back

Add a numbered migration after the current highest migration. Store stable key, hierarchy, ordering, source content and marks, user `done`/`takeaway`, import/update timestamps, and nullable archive timestamp in a dedicated table. Index active items by part and order. Rollback of application code leaves this additive table in place; no existing notes or roadmap rows are altered.

## Data Flow

1. The user runs the importer CLI against the current revision-checklist markdown.
2. A pure parser converts the four document parts to ordered records; a database transaction upserts those records and soft-archives records missing from this import.
3. Opening Checklist calls its dedicated GET route and renders the active snapshot plus saved state.
4. Checkbox and takeaway changes PATCH only the selected row and update SQLite.
5. Roadmaps continues to use the existing seeded `Roadmap` notes and draft-generation handler.

## Risks / Trade-offs

- **Source format changes can break parsing.** Cover the current markdown constructs with inline fixtures, fail on unsupported actionable rows, and print imported item counts by Part.
- **Text-derived identity changes when an item is reworded.** Preserve the old record by soft-archiving it; explicit IDs in the source are a future option if this becomes a real problem.
- **A large list can still feel overwhelming.** Show one selected Part and collapsed categories, with per-Part/category progress and text search.
- **The source path varies by checkout.** Support CLI and environment overrides, provide a clear missing-file error, and keep the imported snapshot independent of the path after import.

## Verification

- Parser tests cover all four Parts, headings/categories, bullets, ordered rows, table rows, CRLF/BOM, source-mark inheritance, claim labels, and unsupported actionable input.
- Import tests use an in-memory database and verify idempotency, preservation of `done`/`takeaway`, archive/reactivate behavior, and transaction safety.
- Route tests verify reads, accepted/invalid patch fields, and persistence without touching the real database.
- UI is checked at desktop and mobile sizes; verify collapsed Roadmaps behavior and the Checklist search, progress, checkbox, and takeaway flow.
- Run `bun test`, `bun run lint`, and `bun run build`.
