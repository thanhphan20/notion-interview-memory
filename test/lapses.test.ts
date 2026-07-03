import { test, expect } from 'bun:test';
import { computeLapses } from '../src/lib/lapses';
import type { Card, Review } from '../src/lib/database';

const NOW = new Date('2026-07-10T12:00:00.000Z');

function card(id: number, tags: string[] = ['Databases']): Card {
  return {
    id,
    noteId: 1,
    sourceDraftId: null,
    question: `Question ${id}`,
    expectedAnswer: 'ans',
    rubric: [],
    tags,
    createdAt: '2026-07-01T00:00:00.000Z',
  };
}

function review(id: number, cardId: number, rating: string, reviewedAt: string): Review {
  return {
    id,
    cardId,
    userAnswer: '',
    aiFeedback: null,
    rating,
    elapsedSeconds: 0,
    reviewedAt,
  };
}

test('empty inputs return empty list', () => {
  expect(computeLapses([], [], 7, NOW)).toEqual([]);
});

test('most-recent review that is again within window is a lapse', () => {
  const cards = [card(1)];
  const reviews = [review(1, 1, 'again', '2026-07-09T12:00:00.000Z')];
  const lapses = computeLapses(cards, reviews, 7, NOW);
  expect(lapses).toHaveLength(1);
  expect(lapses[0].cardId).toBe(1);
  expect(lapses[0].lastRating).toBe('again');
});

test('a newer good review after an again clears the lapse', () => {
  const cards = [card(1)];
  const reviews = [
    review(1, 1, 'again', '2026-07-05T12:00:00.000Z'),
    review(2, 1, 'good', '2026-07-08T12:00:00.000Z'),
  ];
  expect(computeLapses(cards, reviews, 7, NOW)).toEqual([]);
});

test('again outside the 7-day window is not a lapse', () => {
  const cards = [card(1)];
  const reviews = [review(1, 1, 'again', '2026-06-30T12:00:00.000Z')];
  expect(computeLapses(cards, reviews, 7, NOW)).toEqual([]);
});

test('hard rating counts as a lapse', () => {
  const cards = [card(1)];
  const reviews = [review(1, 1, 'hard', '2026-07-09T12:00:00.000Z')];
  expect(computeLapses(cards, reviews, 7, NOW)).toHaveLength(1);
});

test('sorted most-recent lapse first', () => {
  const cards = [card(1), card(2), card(3)];
  const reviews = [
    review(1, 1, 'again', '2026-07-07T00:00:00.000Z'),
    review(2, 2, 'hard', '2026-07-09T00:00:00.000Z'),
    review(3, 3, 'again', '2026-07-08T00:00:00.000Z'),
  ];
  const lapses = computeLapses(cards, reviews, 7, NOW);
  expect(lapses.map((l) => l.cardId)).toEqual([2, 3, 1]);
});

test('configurable window includes older lapses', () => {
  const cards = [card(1)];
  const reviews = [review(1, 1, 'again', '2026-07-01T00:00:00.000Z')];
  expect(computeLapses(cards, reviews, 7, NOW)).toEqual([]);
  expect(computeLapses(cards, reviews, 14, NOW)).toHaveLength(1);
});
