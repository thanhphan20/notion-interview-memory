import { test, expect } from 'bun:test';
import { createAppDatabase } from '../src/lib/database';

test('interview date roundtrip: set → get → clear', () => {
  const db = createAppDatabase(':memory:');

  expect(db.getInterviewDate()).toBeNull();

  db.setInterviewDate('2026-08-15');
  expect(db.getInterviewDate()).toBe('2026-08-15');

  db.setInterviewDate('2026-09-01');
  expect(db.getInterviewDate()).toBe('2026-09-01');

  db.clearInterviewDate();
  expect(db.getInterviewDate()).toBeNull();

  db.close();
});

test('setInterviewDate rejects malformed input', () => {
  const db = createAppDatabase(':memory:');
  expect(() => db.setInterviewDate('not-a-date')).toThrow(/Invalid interview date/);
  expect(() => db.setInterviewDate('2026-13-45')).not.toThrow();
  expect(() => db.setInterviewDate('2026/08/15')).toThrow(/Invalid interview date/);
  db.close();
});

test('sprint lifecycle: create → complete → aggregate score average', () => {
  const db = createAppDatabase(':memory:');

  const sprint1 = db.createSprint([1, 2, 3], [10, 11, 12]);
  expect(sprint1.id).toBeGreaterThan(0);
  expect(sprint1.cardIds).toEqual([1, 2, 3]);
  expect(sprint1.mcqIds).toEqual([10, 11, 12]);
  expect(sprint1.completedAt).toBeNull();
  expect(sprint1.score).toBeNull();

  const completed = db.completeSprint(sprint1.id, 14, [
    { tag: 'System Design', score: 3, total: 4 },
    { tag: 'Databases', score: 2, total: 3 },
  ]);
  expect(completed.score).toBe(14);
  expect(completed.completedAt).not.toBeNull();
  expect(completed.tagBreakdown).toEqual([
    { tag: 'System Design', score: 3, total: 4 },
    { tag: 'Databases', score: 2, total: 3 },
  ]);

  const sprint2 = db.createSprint([4, 5], [13, 14]);
  db.completeSprint(sprint2.id, 18, []);

  const avg = db.getSprintScoreAverage(10);
  expect(avg.count).toBe(2);
  expect(avg.average).toBe(16);

  db.close();
});

test('getSprintScoreAverage: no completed sprints → null average', () => {
  const db = createAppDatabase(':memory:');
  const s = db.createSprint([1], [10]);
  // Not completed yet.
  const avg = db.getSprintScoreAverage(10);
  expect(avg.count).toBe(0);
  expect(avg.average).toBeNull();
  void s;
  db.close();
});

test('listSprints returns only completed sprints, most recent first, capped at limit', () => {
  const db = createAppDatabase(':memory:');
  const a = db.createSprint([1], [10]);
  const b = db.createSprint([2], [11]);
  const c = db.createSprint([3], [12]);
  db.completeSprint(a.id, 10, []);
  db.completeSprint(b.id, 12, []);
  // c is not completed — should be excluded.

  const listed = db.listSprints(5);
  expect(listed.map((s) => s.id)).toEqual([b.id, a.id]);
  db.close();
});

test('mcq diagnostic lifecycle: create → complete → persist weakness report', () => {
  const db = createAppDatabase(':memory:');

  const diagnostic = db.createMCQDiagnostic([1, 2, 3, 4, 5]);
  expect(diagnostic.mcqIds).toEqual([1, 2, 3, 4, 5]);
  expect(diagnostic.completedAt).toBeNull();
  expect(diagnostic.weaknessReport).toBeNull();

  const report = [
    { tag: 'Databases', wrongCount: 3, total: 4 },
    { tag: 'Networking', wrongCount: 0, total: 3 },
  ];
  const completed = db.completeMCQDiagnostic(diagnostic.id, 2, report);
  expect(completed.score).toBe(2);
  expect(completed.weaknessReport).toEqual(report);
  expect(completed.completedAt).not.toBeNull();

  const listed = db.listMCQDiagnostics(5);
  expect(listed).toHaveLength(1);
  expect(listed[0].id).toBe(diagnostic.id);
  expect(listed[0].weaknessReport).toEqual(report);

  db.close();
});

test('listMCQDiagnostics excludes incomplete sessions', () => {
  const db = createAppDatabase(':memory:');
  const a = db.createMCQDiagnostic([1]);
  const b = db.createMCQDiagnostic([2]);
  db.completeMCQDiagnostic(a.id, 1, []);
  // b left incomplete.

  const listed = db.listMCQDiagnostics(5);
  expect(listed.map((d) => d.id)).toEqual([a.id]);
  void b;
  db.close();
});
