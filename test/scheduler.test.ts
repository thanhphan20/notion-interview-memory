import { test, expect } from 'bun:test';
import { createInitialSchedule, gradeReview, getDueCards } from '../src/lib/scheduler';

test('new approved cards are due immediately', () => {
  const now = new Date('2026-06-24T08:00:00.000Z');
  const schedules = [
    createInitialSchedule({ cardId: 1, now }),
    { ...createInitialSchedule({ cardId: 2, now }), dueAt: '2026-06-25T08:00:00.000Z' }
  ];

  const due = getDueCards(schedules, now);

  expect(due.map((item) => item.cardId)).toEqual([1]);
});

test('again rating keeps a card due soon and records a lapse', () => {
  const now = new Date('2026-06-24T08:00:00.000Z');
  const schedule = createInitialSchedule({ cardId: 7, now });

  const next = gradeReview(schedule, 'again', now);

  expect(next.cardId).toBe(7);
  expect(next.reps).toBe(1);
  expect(next.lapses).toBe(1);
  expect(next.state).toBe('review');
  expect(next.scheduledDays).toBe(0);
  expect(next.dueAt).toBe('2026-06-24T08:05:00.000Z');
});

test('good rating increases review interval after repeated successful reviews', () => {
  const firstReviewAt = new Date('2026-06-24T08:00:00.000Z');
  const first = gradeReview(createInitialSchedule({ cardId: 3, now: firstReviewAt }), 'good', firstReviewAt);

  const secondReviewAt = new Date('2026-06-25T08:00:00.000Z');
  const second = gradeReview(first, 'good', secondReviewAt);

  expect(first.scheduledDays).toBe(1);
  expect(first.dueAt).toBe('2026-06-25T08:00:00.000Z');
  expect(second.scheduledDays).toBeGreaterThan(first.scheduledDays);
  expect(second.reps).toBe(2);
  expect(second.lapses).toBe(0);
});
