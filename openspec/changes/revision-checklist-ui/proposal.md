## Why

The existing Roadmaps view renders each long R1–R10 note fully expanded, making the learning path feel like an undifferentiated wall of text. The user also has a much larger interview revision syllabus in the sibling `career-ops/interview-prep/revision-checklist.md` file, but no way in this app to track progress through its parts and topics or save a personal takeaway for each step.

## What Changes

- Redesign the existing Roadmaps view as a compact, expandable ordered list while keeping its current R1–R10 notes and per-roadmap draft-generation action.
- Add a separate Checklist view that imports all four parts of the career-ops revision checklist, keeps source status/CV/JD/fundamental markers visible, and tracks user completion independently.
- Let the user write and locally persist a key takeaway for each checklist item.
- Add a dedicated SQLite model, migration, API routes, and an explicit import command. Keep the source file outside this repository and store the imported snapshot only in ignored local database data.

## Capabilities

### New Capabilities

- `revision-checklist`: Import, browse, complete, and annotate the user's interview revision syllabus.

### Modified Capabilities

- `roadmaps`: Present existing R1–R10 roadmaps in a compact, expandable layout without changing their content or generation behavior.

## Impact

- SQLite migration and persistence methods for imported checklist items, completion state, takeaways, and archive state.
- Import CLI, parser tests, and an inline fixture covering the source document's headings, bullets, ordered list, status markers, labels, and Part 3 table.
- Dedicated checklist API and UI state loading/mutation; checklist data stays out of the general `/api/state` payload.
- Sidebar/page view wiring and focused CSS updates for the redesigned Roadmaps view and new Checklist view.
- No new runtime dependencies and no copy of the personal source markdown in this repository.
