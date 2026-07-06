import { describe, expect, test } from 'bun:test';
import type { Card, MCQQuestion } from '../src/lib/database';
import type { HeatmapTile } from '../src/lib/heatmap';
import { computeSprintScore, pickSprintItems } from '../src/lib/sprint';

// Simple seeded LCG for deterministic tests.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeCard(id: number, tags: string[]): Card {
  return {
    id,
    noteId: 1,
    sourceDraftId: null,
    question: `Q${id}`,
    expectedAnswer: 'a',
    rubric: [],
    tags,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeMCQ(id: number, tags: string[]): MCQQuestion {
  return {
    id,
    noteId: 1,
    question: `MCQ${id}`,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: 0,
    explanation: '',
    tags,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeTile(tag: string, status: HeatmapTile['status']): HeatmapTile {
  return {
    tag,
    retentionRate: status === 'green' ? 0.9 : status === 'yellow' ? 0.6 : status === 'red' ? 0.3 : null,
    ratingAverageTrend: null,
    cardCount: 5,
    measuredCardCount: 3,
    totalReviews: status === 'grey' ? 1 : 15,
    status,
    isColdTag: status === 'grey',
  };
}

describe('pickSprintItems', () => {
  test('returns exactly 20 items when pool is sufficient', () => {
    const cards = Array.from({ length: 30 }, (_, i) => makeCard(i + 1, ['green']));
    const mcqs = Array.from({ length: 30 }, (_, i) => makeMCQ(i + 1, ['green']));
    const heatmap = [makeTile('green', 'green')];
    const sel = pickSprintItems(cards, mcqs, heatmap, 20, seededRng(1));
    expect(sel.cardIds.length + sel.mcqIds.length).toBe(20);
  });

  test('respects 10/10 MCQ/open-recall split', () => {
    const cards = Array.from({ length: 30 }, (_, i) => makeCard(i + 1, ['green']));
    const mcqs = Array.from({ length: 30 }, (_, i) => makeMCQ(i + 1, ['green']));
    const heatmap = [makeTile('green', 'green')];
    const sel = pickSprintItems(cards, mcqs, heatmap, 20, seededRng(2));
    expect(sel.cardIds.length).toBe(10);
    expect(sel.mcqIds.length).toBe(10);
  });

  test('70/30 weighting: 14 of 20 items come from red/yellow tags', () => {
    const cards = [
      ...Array.from({ length: 20 }, (_, i) => makeCard(i + 1, ['red'])),
      ...Array.from({ length: 20 }, (_, i) => makeCard(i + 100, ['green'])),
    ];
    const mcqs = [
      ...Array.from({ length: 20 }, (_, i) => makeMCQ(i + 1, ['yellow'])),
      ...Array.from({ length: 20 }, (_, i) => makeMCQ(i + 100, ['green'])),
    ];
    const heatmap = [
      makeTile('red', 'red'),
      makeTile('yellow', 'yellow'),
      makeTile('green', 'green'),
    ];
    const sel = pickSprintItems(cards, mcqs, heatmap, 20, seededRng(3));
    const weightedCards = sel.cardIds.filter((id) => id < 100).length;
    const weightedMcqs = sel.mcqIds.filter((id) => id < 100).length;
    expect(weightedCards + weightedMcqs).toBe(14);
    expect(weightedCards).toBe(7);
    expect(weightedMcqs).toBe(7);
  });

  test('all-green heatmap → 10+10 even split', () => {
    const cards = Array.from({ length: 20 }, (_, i) => makeCard(i + 1, ['g1']));
    const mcqs = Array.from({ length: 20 }, (_, i) => makeMCQ(i + 1, ['g1']));
    const heatmap = [makeTile('g1', 'green')];
    const sel = pickSprintItems(cards, mcqs, heatmap, 20, seededRng(4));
    expect(sel.cardIds.length).toBe(10);
    expect(sel.mcqIds.length).toBe(10);
  });

  test('empty heatmap → treats all as green, returns 20 items', () => {
    const cards = Array.from({ length: 15 }, (_, i) => makeCard(i + 1, ['x']));
    const mcqs = Array.from({ length: 15 }, (_, i) => makeMCQ(i + 1, ['x']));
    const sel = pickSprintItems(cards, mcqs, [], 20, seededRng(5));
    expect(sel.cardIds.length).toBe(10);
    expect(sel.mcqIds.length).toBe(10);
  });

  test('insufficient cards throws INSUFFICIENT_DECK', () => {
    const cards = Array.from({ length: 5 }, (_, i) => makeCard(i + 1, ['x']));
    const mcqs = Array.from({ length: 20 }, (_, i) => makeMCQ(i + 1, ['x']));
    expect(() => pickSprintItems(cards, mcqs, [], 20, seededRng(6))).toThrow(/INSUFFICIENT_DECK/);
  });

  test('insufficient MCQs throws INSUFFICIENT_DECK', () => {
    const cards = Array.from({ length: 20 }, (_, i) => makeCard(i + 1, ['x']));
    const mcqs = Array.from({ length: 3 }, (_, i) => makeMCQ(i + 1, ['x']));
    expect(() => pickSprintItems(cards, mcqs, [], 20, seededRng(7))).toThrow(/INSUFFICIENT_DECK/);
  });

  test('determinism: seeded RNG yields identical output across calls', () => {
    const cards = Array.from({ length: 25 }, (_, i) => makeCard(i + 1, ['x']));
    const mcqs = Array.from({ length: 25 }, (_, i) => makeMCQ(i + 1, ['x']));
    const heatmap: HeatmapTile[] = [];
    const a = pickSprintItems(cards, mcqs, heatmap, 20, seededRng(42));
    const b = pickSprintItems(cards, mcqs, heatmap, 20, seededRng(42));
    expect(a.cardIds).toEqual(b.cardIds);
    expect(a.mcqIds).toEqual(b.mcqIds);
  });
});

describe('computeSprintScore', () => {
  test('returns 15 for 8 good/easy + 7 correct MCQs', () => {
    const ratings = [
      ...Array.from({ length: 8 }, (_, i) => ({ cardId: i + 1, rating: 'good' as const })),
      { cardId: 9, rating: 'again' as const },
      { cardId: 10, rating: 'hard' as const },
    ];
    const mcqAnswers = [
      ...Array.from({ length: 7 }, (_, i) => ({ mcqId: i + 1, correct: true })),
      ...Array.from({ length: 3 }, (_, i) => ({ mcqId: i + 8, correct: false })),
    ];
    const cards = ratings.map((r) => makeCard(r.cardId, ['t']));
    const mcqs = mcqAnswers.map((m) => makeMCQ(m.mcqId, ['t']));
    const result = computeSprintScore(ratings, mcqAnswers, cards, mcqs);
    expect(result.score).toBe(15);
  });

  test('tagBreakdown groups multi-tag card into both tag buckets', () => {
    const cards = [makeCard(1, ['System Design', 'Databases'])];
    const mcqs: MCQQuestion[] = [];
    const ratings: import('../src/lib/sprint').SprintRating[] = [{ cardId: 1, rating: 'good' }];
    const result = computeSprintScore(ratings, [], cards, mcqs);
    const tags = result.tagBreakdown.map((t) => t.tag).sort();
    expect(tags).toEqual(['Databases', 'System Design']);
    for (const t of result.tagBreakdown) {
      expect(t.total).toBe(1);
      expect(t.score).toBe(1);
    }
  });
});
