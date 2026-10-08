import { test, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { createAppDatabase } from '../src/lib/database';
import {
  ROADMAP_TAG,
  parseRoadmaps,
  roadmapPageId,
  seedRoadmaps,
} from '../scripts/seed-roadmaps';

const ROADMAP_FILE = path.join(import.meta.dir, '..', 'docs', 'roadmaps.md');

const SAMPLE = `# Document Title

Preamble prose that is not a section.

# R1 — First roadmap

- alpha
- beta

# R2 — Second roadmap

- gamma
`;

test('parseRoadmaps returns one section per R<n> heading and skips the preamble', () => {
  const sections = parseRoadmaps(SAMPLE);

  expect(sections.map((section) => section.key)).toEqual(['R1', 'R2']);
  expect(sections[0].title).toBe('R1 — First roadmap');
  expect(sections[0].content).toBe('- alpha\n- beta');
  expect(sections[0].content).not.toContain('Preamble');
  expect(sections[0].content).not.toContain('# R2');
  expect(sections[1].content).toBe('- gamma');
});

test('roadmapPageId uses the local namespace so Notion sync cannot collide', () => {
  expect(roadmapPageId('R1')).toBe('local:roadmap-r1');
  expect(roadmapPageId('R10')).toBe('local:roadmap-r10');
});

test('seedRoadmaps is idempotent and updates content in place', () => {
  const db = createAppDatabase(':memory:');

  const first = seedRoadmaps(db, SAMPLE);
  expect(first).toHaveLength(2);
  expect(first[0].tags).toEqual([ROADMAP_TAG, 'R1']);
  expect(first[0].sourceUrl).toBe('');

  const updated = SAMPLE.replace('- beta', '- beta and delta');
  const second = seedRoadmaps(db, updated);

  expect(second).toHaveLength(2);
  expect(second[0].id).toBe(first[0].id);
  expect(db.listNotes()).toHaveLength(2);
  expect(db.getNoteByNotionPageId('local:roadmap-r1')!.content).toContain('delta');

  db.close();
});

test('seeded roadmap notes stay out of the due queue until a draft is approved', () => {
  const db = createAppDatabase(':memory:');
  seedRoadmaps(db, SAMPLE);

  expect(db.listDueCards()).toHaveLength(0);

  db.close();
});

test('docs/roadmaps.md parses into the expected R1..R10 sections', () => {
  const sections = parseRoadmaps(fs.readFileSync(ROADMAP_FILE, 'utf8'));

  expect(sections.map((section) => section.key)).toEqual([
    'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10',
  ]);
  for (const section of sections) {
    expect(section.content.length).toBeGreaterThan(50);
  }
});
