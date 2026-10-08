## ADDED Requirements

### Requirement: Import the external revision checklist

The system SHALL provide an explicit local import command that parses the four Parts of the career-ops revision checklist and stores a local snapshot in SQLite. The source path SHALL be overridable by command-line argument or `CHECKLIST_FILE`; the app SHALL NOT require access to the source file after import. The source markdown SHALL NOT be copied into tracked files in this repository.

#### Scenario: Import a valid checklist

- **WHEN** the user runs the import command with a valid checklist markdown file
- **THEN** the system stores its actionable bullet, ordered-list, and Part 3 table entries in source order with their Part, section/category, authored status, and claim labels
- **AND** the command reports imported item counts by Part

#### Scenario: Source file is unavailable or malformed

- **WHEN** the selected source file cannot be read or contains an unsupported actionable row
- **THEN** the command exits with a non-zero status and a clear actionable error
- **AND** the existing imported checklist and user progress remain unchanged

### Requirement: Preserve user state when re-importing

The system SHALL identify items by a deterministic normalized key derived from Part, hierarchy, and item text, excluding volatile source status marks. Re-import SHALL preserve matching items' user completion and takeaway, soft-archive removed items, and reactivate reappearing items without deleting their state.

#### Scenario: Re-import unchanged or status-updated item

- **WHEN** an imported item's text and hierarchy are unchanged but its source status mark changes
- **THEN** the source badge is updated while user completion and takeaway remain unchanged

#### Scenario: Re-import with a removed item

- **WHEN** an item is absent from a valid subsequent import
- **THEN** it is hidden from the active checklist but remains archived in SQLite with its user state intact

### Requirement: Browse a large checklist by Part and category

The Checklist screen SHALL show progress by Part and overall, let the user navigate the four Parts and their sections/categories, and display checklist entries in source order without expanding the entire syllabus at once. The screen SHALL support text filtering across imported items.

#### Scenario: User opens Checklist

- **WHEN** the Checklist view is opened after a successful import
- **THEN** the system loads active checklist data through its dedicated API and displays Part progress and navigable sections/categories
- **AND** each checklist entry displays source text and applicable authored status/claim badges

#### Scenario: User filters the syllabus

- **WHEN** the user enters a search term
- **THEN** only matching active checklist entries are displayed with their Part/category context
- **AND** completion counts continue to reflect all active items, not only filtered results

### Requirement: Track checklist completion and key takeaways locally

The system SHALL provide an independent unchecked-by-default completion checkbox and an editable per-item key takeaway. User state SHALL be persisted in SQLite independently of authored source status marks.

#### Scenario: User checks an item

- **WHEN** the user toggles an item's completion checkbox
- **THEN** the user completion state is persisted and overall, Part, and category progress are updated
- **AND** a source `✅` mark alone does not set the completion checkbox

#### Scenario: User writes a takeaway

- **WHEN** the user enters or edits an item's takeaway and leaves the field
- **THEN** the takeaway is saved locally and appears again when the user revisits or reloads the Checklist view

#### Scenario: A checklist update fails

- **WHEN** a completion or takeaway update cannot be persisted
- **THEN** the UI communicates the failure and does not silently present unsaved state as saved

### Requirement: Keep Checklist APIs isolated from general app state

The checklist data SHALL be loaded from a dedicated `GET /api/checklist` endpoint and updated through a dedicated `PATCH /api/checklist/[id]` endpoint. Checklist rows SHALL NOT be added to the general `/api/state` payload.

#### Scenario: User updates one checklist item

- **WHEN** the client submits a valid update containing `done`, `takeaway`, or both
- **THEN** only the addressed active checklist row is updated
- **AND** other application state is not refetched

#### Scenario: User submits an invalid update

- **WHEN** an update contains no supported field or invalid field types
- **THEN** the API returns a client error and leaves the row unchanged

### Requirement: Keep existing roadmaps while improving scanability

The existing R1–R10 local roadmap notes SHALL remain available and retain their per-roadmap draft-generation action. The Roadmaps screen SHALL show compact collapsed entries that can be expanded to view their complete existing content.

#### Scenario: User browses existing Roadmaps

- **WHEN** the user opens Roadmaps
- **THEN** R1–R10 are shown in numeric order in a compact collapsed layout
- **AND** expanding an entry reveals its full content and Generate Drafts action
