import { test, expect } from 'bun:test';
import { isRoadmapNote, selectRoadmapNotes } from '../src/lib/roadmaps';

const R10 = { id: 10, title: 'R10 — Ongoing habits', content: 'x', tags: ['Roadmap', 'R10'] };
const R2 = { id: 2, title: 'R2 — Java core', content: 'x', tags: ['Roadmap', 'R2'] };
const R1 = { id: 1, title: 'R1 — 7-day sprint', content: 'x', tags: ['Roadmap', 'R1'] };
const notionNote = { id: 3, title: 'A synced note', content: 'x', tags: ['Java'] };

test('selectRoadmapNotes keeps only Roadmap-tagged notes sorted by numeric R key', () => {
  const result = selectRoadmapNotes([R10, notionNote, R2, R1]);

  expect(result.map((note) => note.id)).toEqual([1, 2, 10]);
});

test('selectRoadmapNotes returns an empty list when no roadmap notes exist', () => {
  expect(selectRoadmapNotes([notionNote])).toEqual([]);
});

test('isRoadmapNote ignores non-Roadmap tags', () => {
  expect(isRoadmapNote(R1)).toBe(true);
  expect(isRoadmapNote(notionNote)).toBe(false);
});
