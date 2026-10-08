# Revision Checklist UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the career-ops interview revision syllabus into this local app, provide a searchable checklist with persistent completion and personal takeaways, and make existing R1–R10 roadmaps compact and scannable.

**Architecture:** A pure markdown parser feeds an idempotent importer that writes a local SQLite snapshot through the app database layer. Dedicated checklist API routes and a lazily loaded Checklist view keep this data out of `/api/state`; the existing Roadmaps view remains note-backed and is redesigned independently.

**Tech Stack:** Bun, TypeScript, `bun:sqlite`, Next.js App Router, React, Bun test, existing CSS tokens/components.

**Spec:** `openspec/changes/revision-checklist-ui/design.md` and `openspec/changes/revision-checklist-ui/specs/revision-checklist/spec.md`

## Global Constraints

- The app is single-user, local-first, and stores durable checklist state in SQLite.
- Do not add runtime dependencies.
- Do not copy the personal career-ops source markdown into tracked app files.
- The running app must not depend on the external source file after import.
- Do not auto-check an item based on an authored status mark.
- Never hard-delete an imported checklist item during re-import; preserve user state through soft archival.
- Keep checklist rows out of `/api/state`.
- Use numbered SQL migrations; never modify an applied migration.
- Tests use Bun's native runner and in-memory SQLite; do not read the real sibling personal source file in tests.
- Keep R1–R10 roadmap notes and Generate Drafts behavior intact.

## Review Focus

- **Windows CRLF/BOM and Unicode marks** — parser fixture verifies CRLF/BOM and `✅`, `🟡`, `🔴`, `⚠️` survive classification without corrupting item text.
- **Part 3 table delimiters** — fixture includes bold text and an escaped or embedded pipe case; parser must not split a row incorrectly.
- **Status inheritance vs user completion** — parser/import tests verify parent status marks become source metadata while every new `done` value remains false.
- **Re-import after edits/removal** — tests verify status-only edits preserve key/state, missing rows soft-archive, reappearing rows reactivate, and invalid import leaves the database untouched.
- **Large and filtered lists** — UI verification confirms progress counts remain based on all active rows when a text filter is active and only selected/collapsed content is rendered accessibly.

---

## File Map

- Create `src/lib/checklist.ts`: source types, pure markdown parser, stable item key, source marker/claim parsing.
- Create `scripts/import-checklist.ts`: CLI path selection, source read/validation, database import, count summary.
- Create `src/migrations/005-revision-checklist.ts`; update `src/lib/migrate.ts` to register it.
- Modify `src/lib/database.ts`: checklist row mapping, list/import/update methods, transactional reconciliation.
- Create `src/app/api/checklist/route.ts` and `src/app/api/checklist/[id]/route.ts`: dedicated GET and PATCH handlers.
- Modify `src/lib/api-client.ts`: typed checklist contract and methods.
- Create `src/components/ChecklistView.tsx`: lazy load, Part/category navigation, filtering, progress, completion and takeaway editing.
- Modify `src/components/RoadmapsView.tsx`: compact collapsed R1–R10 layout; preserve content rendering and draft generation.
- Modify `src/components/Sidebar.tsx`, `src/hooks/useAppState.ts`, and `src/app/page.tsx`: navigation and view routing.
- Modify `src/app/globals.css`: checklist and compact-roadmap responsive styles.
- Create parser/import/API tests under `test/`; update `README.md` and relevant OpenWiki/spec docs with import and usage instructions.

## Task 1: Parse the revision checklist as ordered structured items

**Files:**
- Create: `src/lib/checklist.ts`
- Test: `test/checklist-parse.test.ts`

**Interfaces:**
- Produces `ChecklistImportItem` with `itemKey`, `partKey`, `partTitle`, `sectionTitle`, nullable `category`, `ordinal`, `sourceText`, nullable `sourceStatus`, and `claimFlags: string[]`.
- Produces `parseChecklist(markdown: string): ChecklistImportItem[]`.
- Produces `createChecklistItemKey(partKey: string, sectionTitle: string, category: string | null, sourceText: string): string` using a deterministic content hash. Normalize whitespace and strip trailing source-status and recognized claim markers for identity; include hierarchy so identical lines in distinct sections do not collide.

- [ ] **Step 1: Write failing parser tests**

  Add an inline fixture covering the four parts, H1/H2 hierarchy, bold subsection labels, bullet items, ordered items, a Part 3 table row, source marks on a parent heading and item, `[CV]`/`[JD]`/`[fund]`, preamble/legend exclusion, and duplicate text in separate categories. Assert item order, text, metadata, stable keys, and no empty items.

- [ ] **Step 2: Run parser tests and confirm they fail**

  Run: `bun test test/checklist-parse.test.ts`
  Expected: FAIL because `src/lib/checklist.ts` does not yet exist.

- [ ] **Step 3: Implement the pure parser and types**

  Parse source sections in order, supporting the exact markdown structures in the spec. Preserve meaningful inline markdown in `sourceText`. Derive status from an item first, then the nearest marked subsection/section; parse only recognized claim markers. Strip BOM and support CRLF. Reject unsupported actionable rows or produce an explicit parser error instead of silently omitting them.

- [ ] **Step 4: Verify parser edge cases**

  Add and run tests for CRLF/BOM, status emoji inside prose not mistaken for a trailing status, table cells with an escaped pipe, and a malformed actionable row. Run: `bun test test/checklist-parse.test.ts`
  Expected: all parser tests pass; errors identify the malformed source line.

## Task 2: Persist and import checklist items without losing user state

**Files:**
- Create: `src/migrations/005-revision-checklist.ts`
- Create: `scripts/import-checklist.ts`
- Modify: `src/lib/migrate.ts`
- Modify: `src/lib/database.ts`
- Test: `test/checklist-import.test.ts`

**Interfaces:**
- Consumes `ChecklistImportItem` from Task 1.
- Database methods: `importChecklistItems(items: ChecklistImportItem[]): { countsByPart: Record<string, number> }`, `listChecklistItems(): ChecklistItem[]`, and `updateChecklistItem(id: number, patch: { done?: boolean; takeaway?: string }): ChecklistItem`.
- `ChecklistItem` adds numeric `id`, `done: boolean`, `takeaway: string`, and `archivedAt: string | null` to source fields.

- [ ] **Step 1: Write failing migration/import tests**

  Using `createAppDatabase(':memory:')`, assert migration creates the item table and active-order index; first import inserts rows with `done=false`/empty takeaway; duplicate import is idempotent; edits to `done` and `takeaway` survive source-status changes and re-import; disappeared rows archive and reappearing rows reactivate; parse/import failure leaves prior rows unchanged.

- [ ] **Step 2: Run tests and confirm failure**

  Run: `bun test test/checklist-import.test.ts`
  Expected: FAIL because migration and persistence APIs do not exist.

- [ ] **Step 3: Implement migration and database methods**

  Create `checklist_items` with integer ID, unique stable key, Part/section/category/order, source text/status/claim flags, `done` default 0, `takeaway` default empty, import/update timestamps, and nullable `archived_at`. Add an index for active items ordered by Part and ordinal. Register migration ID 5. Use one database transaction to upsert active rows, preserve `done`/`takeaway`, update source metadata, and soft-archive keys absent from this valid import.

- [ ] **Step 4: Implement the import CLI**

  Add `bun scripts/import-checklist.ts [path]`, selecting path in this order: CLI argument, `CHECKLIST_FILE`, sibling default `../career-ops/interview-prep/revision-checklist.md`. Parse fully before modifying the database; report a clear non-zero error for missing/invalid source; print total and per-Part counts on success; always close the database.

- [ ] **Step 5: Verify persistence and import behavior**

  Run: `bun test test/checklist-parse.test.ts test/checklist-import.test.ts test/seed-roadmaps.test.ts`
  Expected: parser, import, and existing R1–R10 seed tests pass; repeat import reports stable counts and preserves user state.

## Task 3: Add isolated checklist API and typed client methods

**Files:**
- Create: `src/app/api/checklist/route.ts`
- Create: `src/app/api/checklist/[id]/route.ts`
- Modify: `src/lib/api-client.ts`
- Test: `test/checklist-route.test.ts`

**Interfaces:**
- Consumes Task 2 database methods.
- `GET /api/checklist` returns `{ items: ChecklistItem[] }` containing active rows in source order.
- `PATCH /api/checklist/[id]` accepts `{ done?: boolean; takeaway?: string }` and returns `{ item: ChecklistItem }`.
- Client methods: `api.getChecklist(): Promise<{items: ChecklistItem[]}>` and `api.updateChecklistItem(id: number, patch: ChecklistItemPatch): Promise<{item: ChecklistItem}>`.

- [ ] **Step 1: Write failing API route tests**

  Add isolated route tests proving GET hides archived rows, PATCH persists either/both allowed fields, invalid ID/body is rejected, and no unsupported field mutates data. Use temporary `DATA_DIR` like existing route tests.

- [ ] **Step 2: Run route tests and confirm failure**

  Run: `bun test test/checklist-route.test.ts`
  Expected: FAIL because checklist routes/client methods do not exist.

- [ ] **Step 3: Implement the dedicated routes and contracts**

  Wrap routes with `withDb`; validate a positive integer ID and require at least one supported patch field with exact boolean/string types. Return clear 400s for invalid requests and missing/archived IDs. Add corresponding exported client types and methods. Do not alter `/api/state`.

- [ ] **Step 4: Verify route tests**

  Run: `bun test test/checklist-route.test.ts test/route.test.ts`
  Expected: all checklist and existing route tests pass; checklist updates do not change general app-state response shape.

## Task 4: Build Checklist screen and make existing Roadmaps scannable

**Files:**
- Create: `src/components/ChecklistView.tsx`
- Modify: `src/components/RoadmapsView.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/hooks/useAppState.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes Task 3 `api.getChecklist` and `api.updateChecklistItem` methods.
- Checklist is loaded when `ChecklistView` mounts; it owns loading/error/data state so `/api/state` is not expanded.
- Add `'checklist'` to both view unions and a Checklist nav entry; keep `'roadmaps'` unchanged.

- [ ] **Step 1: Implement lazy checklist loading and hierarchy navigation**

  Render an overall progress summary, four selectable Parts with progress counts, and ordered categories with their own progress counts; keep one category expanded at a time. Render source text/status/claim badges and a text filter that searches active items while preserving Part/category context. Empty and load-error states include actionable copy; do not fabricate checklist content.

- [ ] **Step 2: Add checkbox and takeaway persistence**

  Each item checkbox starts from its `done` field, updates optimistically, calls the PATCH API, and reverts with a visible error on failure. Render an accessible collapsed takeaway editor per item; save on blur, restore server text after reload, and show saving/saved/error state. Recompute visible progress from all active items, not filtered results.

- [ ] **Step 3: Redesign R1–R10 as compact expandable entries**

  Render the existing roadmap notes in numeric order as collapsed-by-default compact entries. Expanding reveals full existing formatted content and the existing Generate Drafts action. Keep note selection and generation behavior unchanged.

- [ ] **Step 4: Wire navigation and responsive styling**

  Add Checklist to the sidebar and SPA view map. Style both views using existing tokens and accessible native controls; ensure narrow viewports can navigate Parts/categories and edit takeaways without horizontal overflow.

- [ ] **Step 5: Verify the live UI**

  Run the existing dev server if available (otherwise `bun run dev`) and verify `/` loads, Roadmaps initially shows compact R1–R10 in numeric order, expanding a roadmap retains Generate Drafts, Checklist shows four Parts, search keeps correct totals, and check/takeaway updates survive refresh. Check desktop and mobile layouts; do not terminate a server that was already running before this task.

## Task 5: Document and run full verification

**Files:**
- Modify: `README.md`
- Modify: relevant `openwiki/` usage, architecture, data-model, and testing pages
- Modify: `spec.md` only where new API/data requirements are not already covered

- [ ] **Step 1: Document checklist import and usage**

  Document the CLI argument, `CHECKLIST_FILE`, sibling default, local snapshot behavior, per-item completion/takeaways, and the fact that the external source is not committed into this repository.

- [ ] **Step 2: Run all tests and lint**

  Run: `bun test` and `bun run lint`
  Expected: all tests pass and ESLint exits with code 0.

- [ ] **Step 3: Run production build**

  Run: `bun run build`
  Expected: Next.js build exits with code 0.

- [ ] **Step 4: Review final diff and local-data safety**

  Confirm no career-ops markdown, SQLite data, secrets, or unrelated user changes were added to the diff. Confirm the change only adds the checklist capability and compact Roadmaps presentation.
