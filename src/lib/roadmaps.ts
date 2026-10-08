import type { Note } from './database';

/** Tag applied by `scripts/seed-roadmaps.ts` to every seeded roadmap note. */
export const ROADMAP_TAG = 'Roadmap';

export function isRoadmapNote(note: Pick<Note, 'tags'>): boolean {
  return note.tags.includes(ROADMAP_TAG);
}

/**
 * Roadmap-tagged notes in ascending R-key order (R1, R2, … R10 — numeric, not
 * lexicographic). Non-roadmap notes are dropped.
 */
export function selectRoadmapNotes<T extends Pick<Note, 'tags'>>(notes: T[]): T[] {
  return notes
    .filter(isRoadmapNote)
    .map((note) => ({ note, key: roadmapSortKey(note.tags) }))
    .sort((a, b) => a.key - b.key)
    .map(({ note }) => note);
}

/** R key → number; notes without an R<n> tag sort last (0 when absent). */
function roadmapSortKey(tags: string[]): number {
  for (const tag of tags) {
    const match = /^R(\d+)$/.exec(tag);
    if (match) return Number(match[1]);
  }
  return 0;
}
