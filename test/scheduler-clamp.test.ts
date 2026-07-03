import { test, expect } from 'bun:test';
import {
  applyInterviewDateClamp,
  createInitialSchedule,
  gradeReview,
  type Schedule,
} from '../src/lib/scheduler';

function buildReviewed(overrides: Partial<Schedule> = {}): Schedule {
  const base: Schedule = {
    cardId: 1,
    dueAt: '2026-07-15T00:00:00.000Z',
    stability: 5,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 14,
    reps: 3,
    lapses: 0,
    state: 'review',
    lastReviewedAt: '2026-07-01T00:00:00.000Z',
  };
  return { ...base, ...overrides };
}

test('clamps scheduledDays when FSRS proposes 14 but 8 days remain', () => {
  const now = new Date('2026-07-01T00:00:00.000Z'); // interview 2026-07-09 => 8 days
  const schedule = buildReviewed({ scheduledDays: 14, lastReviewedAt: now.toISOString() });

  const clamped = applyInterviewDateClamp(schedule, '2026-07-09', now);

  expect(clamped.scheduledDays).toBe(7);
  // dueAt = lastReviewedAt (2026-07-01) + 7 days = 2026-07-08 (interview - 1 day)
  expect(clamped.dueAt).toBe('2026-07-08T00:00:00.000Z');
  // untouched fields
  expect(clamped.stability).toBe(schedule.stability);
  expect(clamped.difficulty).toBe(schedule.difficulty);
  expect(clamped.reps).toBe(schedule.reps);
  expect(clamped.state).toBe('review');
  expect(clamped.lastReviewedAt).toBe(schedule.lastReviewedAt);
});

test('does not clamp when scheduledDays already fits before interview', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const schedule = buildReviewed({ scheduledDays: 3, dueAt: '2026-07-04T00:00:00.000Z' });

  const result = applyInterviewDateClamp(schedule, '2026-07-09', now);

  expect(result).toEqual(schedule);
});

test('returns unchanged when interviewDate is null', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const schedule = buildReviewed();

  expect(applyInterviewDateClamp(schedule, null, now)).toEqual(schedule);
  expect(applyInterviewDateClamp(schedule, '', now)).toEqual(schedule);
});

test('returns unchanged when interviewDate is in the past', () => {
  const now = new Date('2026-07-10T00:00:00.000Z');
  const schedule = buildReviewed();

  const result = applyInterviewDateClamp(schedule, '2026-07-01', now);

  expect(result).toEqual(schedule);
});

test('returns unchanged for new (never reviewed) schedules', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const schedule = createInitialSchedule({ cardId: 42, now });

  const result = applyInterviewDateClamp(schedule, '2026-07-09', now);

  expect(result).toEqual(schedule);
});

test('never produces negative scheduledDays when only 1 day remains', () => {
  const now = new Date('2026-07-08T00:00:00.000Z'); // interview 2026-07-09 => 1 day
  const schedule = buildReviewed({
    scheduledDays: 5,
    lastReviewedAt: now.toISOString(),
  });

  const result = applyInterviewDateClamp(schedule, '2026-07-09', now);

  expect(result.scheduledDays).toBe(0);
  expect(result.scheduledDays).toBeGreaterThanOrEqual(0);
  expect(result.dueAt).toBe(now.toISOString());
});

test('integrates with gradeReview output', () => {
  const start = new Date('2026-07-01T00:00:00.000Z');
  let s = createInitialSchedule({ cardId: 9, now: start });
  s = gradeReview(s, 'good', start);
  s = gradeReview(s, 'easy', new Date('2026-07-02T00:00:00.000Z'));

  const now = new Date('2026-07-02T00:00:00.000Z');
  const clamped = applyInterviewDateClamp(s, '2026-07-05', now);

  // 2026-07-05 - 2026-07-02 = 3 days => max scheduledDays = 2
  if (s.scheduledDays > 2) {
    expect(clamped.scheduledDays).toBe(2);
  } else {
    expect(clamped).toEqual(s);
  }
});
