const assert = require('node:assert/strict');
const test = require('node:test');

const { createInitialSchedule, gradeReview, getDueCards } = require('../src/scheduler');

test('new approved cards are due immediately', () => {
  const now = new Date('2026-06-24T08:00:00.000Z');
  const schedules = [
    createInitialSchedule({ cardId: 1, now }),
    { ...createInitialSchedule({ cardId: 2, now }), dueAt: '2026-06-25T08:00:00.000Z' }
  ];

  const due = getDueCards(schedules, now);

  assert.deepEqual(due.map((item) => item.cardId), [1]);
});

test('again rating keeps a card due soon and records a lapse', () => {
  const now = new Date('2026-06-24T08:00:00.000Z');
  const schedule = createInitialSchedule({ cardId: 7, now });

  const next = gradeReview(schedule, 'again', now);

  assert.equal(next.cardId, 7);
  assert.equal(next.reps, 1);
  assert.equal(next.lapses, 1);
  assert.equal(next.state, 'review');
  assert.equal(next.scheduledDays, 0);
  assert.equal(next.dueAt, '2026-06-24T08:05:00.000Z');
});

test('good rating increases review interval after repeated successful reviews', () => {
  const firstReviewAt = new Date('2026-06-24T08:00:00.000Z');
  const first = gradeReview(createInitialSchedule({ cardId: 3, now: firstReviewAt }), 'good', firstReviewAt);

  const secondReviewAt = new Date('2026-06-25T08:00:00.000Z');
  const second = gradeReview(first, 'good', secondReviewAt);

  assert.equal(first.scheduledDays, 1);
  assert.equal(first.dueAt, '2026-06-25T08:00:00.000Z');
  assert.ok(second.scheduledDays > first.scheduledDays);
  assert.equal(second.reps, 2);
  assert.equal(second.lapses, 0);
});
