/**
 * Seed the study roadmaps in `docs/roadmaps.md` as notes.
 *
 * The app's normal note source is the Notion sync, which is read-only. Study
 * roadmaps are not Notion pages, so this script registers them as local notes
 * under the `local:roadmap-*` id namespace. Once seeded they behave like any
 * other note: generate drafts, approve them into cards, and let MCQ generation
 * use them for the diagnostic.
 *
 * Run:  bun scripts/seed-roadmaps.ts [path-to-markdown]
 *
 * Idempotent — `upsertNote` keys on `notion_page_id`, so re-running updates the
 * existing notes in place instead of duplicating them. Notion sync only upserts
 * the pages it fetches, so it never removes these.
 *
 * To remove them again:
 *   DELETE FROM notes WHERE notion_page_id LIKE 'local:roadmap-%';
 */
import fs from 'node:fs';
import path from 'node:path';
import { createAppDatabase, type Note } from '../src/lib/database';
import { ROADMAP_TAG } from '../src/lib/roadmaps';

export { ROADMAP_TAG };
export const ROADMAP_PAGE_PREFIX = 'local:roadmap-';

export const DEFAULT_ROADMAP_FILE = path.join(process.cwd(), 'docs', 'roadmaps.md');

/** One `# R<n> — Title` section of the roadmap markdown. */
export interface RoadmapSection {
  key: string;
  title: string;
  content: string;
}

const SECTION_HEADING = /^# (R\d+)\s*(?:—|-|:)\s*(.+?)\s*$/gm;

/**
 * Split the roadmap markdown into sections, one per `# R<n> — ...` heading.
 * Anything before the first such heading (the document title and its preamble)
 * is not a section.
 */
export function parseRoadmaps(markdown: string): RoadmapSection[] {
  const headings: { key: string; title: string; start: number; bodyStart: number }[] = [];

  for (const match of markdown.matchAll(SECTION_HEADING)) {
    const start = match.index ?? 0;
    headings.push({
      key: match[1],
      title: `${match[1]} — ${match[2]}`,
      start,
      bodyStart: start + match[0].length,
    });
  }

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    return {
      key: heading.key,
      title: heading.title,
      content: markdown.slice(heading.bodyStart, next ? next.start : markdown.length).trim(),
    };
  });
}

/** Stable note id for a roadmap section, e.g. `R1` → `local:roadmap-r1`. */
export function roadmapPageId(key: string): string {
  return `${ROADMAP_PAGE_PREFIX}${key.toLowerCase()}`;
}

/** Parse and upsert every roadmap section. Returns the stored notes. */
export function seedRoadmaps(db: ReturnType<typeof createAppDatabase>, markdown: string): Note[] {
  const editedAt = new Date().toISOString();
  return parseRoadmaps(markdown).map((section) =>
    db.upsertNote({
      notionPageId: roadmapPageId(section.key),
      title: section.title,
      content: section.content,
      tags: [ROADMAP_TAG, section.key],
      notionLastEditedTime: editedAt,
    })
  );
}

if (import.meta.main) {
  const file = process.argv[2] ?? DEFAULT_ROADMAP_FILE;
  if (!fs.existsSync(file)) {
    console.error(`Roadmap file not found: ${file}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(file, 'utf8');
  const sections = parseRoadmaps(markdown);
  if (sections.length === 0) {
    console.error(`No "# R<n> — ..." sections found in ${file}`);
    process.exit(1);
  }

  const db = createAppDatabase();
  try {
    const notes = seedRoadmaps(db, markdown);
    for (const note of notes) {
      console.log(`${note.notionPageId}  ${note.title}`);
    }
    console.log(`\nSeeded ${notes.length} roadmap notes from ${path.relative(process.cwd(), file)}`);
  } finally {
    db.close();
  }
}
