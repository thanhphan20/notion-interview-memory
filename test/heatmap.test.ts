import { describe, expect, it } from 'bun:test';
import { computeHeatmap } from '../src/lib/heatmap';
import type { Card, Review } from '../src/lib/database';

let cardIdSeq = 0;
let reviewIdSeq = 0;

function makeCard(tags: string[]): Card {
  cardIdSeq += 1;
  return {
    id: cardIdSeq,
    noteId: 1,
    sourceDraftId: null,
    question: 'q',
    expectedAnswer: 'a',
    rubric: [],
    tags,
    createdAt: new Date(0).toISOString(),
  };
}

function makeReviews(cardId: number, ratings: string[], startMs = 1_000_000): Review[] {
  return ratings.map((rating, i) => {
    reviewIdSeq += 1;
    return {
      id: reviewIdSeq,
      cardId,
      userAnswer: '',
      aiFeedback: null,
      rating,
      elapsedSeconds: 0,
      reviewedAt: new Date(startMs + i * 60_000).toISOString(),
    };
  });
}

describe('computeHeatmap', () => {
  it('returns empty array for empty inputs', () => {
    expect(computeHeatmap([], [])).toEqual([]);
  });

  it('marks all tiles grey for a fresh deck with no reviews', () => {
    const cards = [makeCard(['A']), makeCard(['B'])];
    const tiles = computeHeatmap(cards, []);
    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      expect(tile.status).toBe('grey');
      expect(tile.isColdTag).toBe(true);
      expect(tile.retentionRate).toBeNull();
      expect(tile.ratingAverageTrend).toBeNull();
      expect(tile.totalReviews).toBe(0);
    }
  });

  it('reports totalReviews for a cold tag with some review activity, distinguishing it from a never-touched tag', () => {
    const untouched = makeCard(['Untouched']);
    const inProgress = makeCard(['InProgress']);
    const reviews = makeReviews(inProgress.id, ['good']);

    const tiles = computeHeatmap([untouched, inProgress], reviews);
    const untouchedTile = tiles.find((t) => t.tag === 'Untouched')!;
    const inProgressTile = tiles.find((t) => t.tag === 'InProgress')!;

    expect(untouchedTile.isColdTag).toBe(true);
    expect(untouchedTile.totalReviews).toBe(0);

    expect(inProgressTile.isColdTag).toBe(true);
    expect(inProgressTile.totalReviews).toBe(1);
  });

  it('renders green when retention is 4/5 = 0.80', () => {
    const cards = [1, 2, 3, 4, 5].map(() => makeCard(['T']));
    const reviews: Review[] = [];
    // 4 cards end on 'good', 1 ends on 'again'
    for (let i = 0; i < 4; i++) {
      reviews.push(...makeReviews(cards[i].id, ['again', 'hard', 'good']));
    }
    reviews.push(...makeReviews(cards[4].id, ['good', 'good', 'again']));

    const [tile] = computeHeatmap(cards, reviews);
    expect(tile.measuredCardCount).toBe(5);
    expect(tile.retentionRate).toBeCloseTo(0.8);
    expect(tile.status).toBe('green');
  });

  it('renders yellow when retention is 3/5 = 0.60', () => {
    const cards = [1, 2, 3, 4, 5].map(() => makeCard(['T']));
    const reviews: Review[] = [];
    for (let i = 0; i < 3; i++) {
      reviews.push(...makeReviews(cards[i].id, ['again', 'hard', 'good']));
    }
    for (let i = 3; i < 5; i++) {
      reviews.push(...makeReviews(cards[i].id, ['good', 'good', 'again']));
    }

    const [tile] = computeHeatmap(cards, reviews);
    expect(tile.retentionRate).toBeCloseTo(0.6);
    expect(tile.status).toBe('yellow');
  });

  it('renders red when retention is 2/5 = 0.40', () => {
    const cards = [1, 2, 3, 4, 5].map(() => makeCard(['T']));
    const reviews: Review[] = [];
    for (let i = 0; i < 2; i++) {
      reviews.push(...makeReviews(cards[i].id, ['again', 'hard', 'good']));
    }
    for (let i = 2; i < 5; i++) {
      reviews.push(...makeReviews(cards[i].id, ['good', 'good', 'again']));
    }

    const [tile] = computeHeatmap(cards, reviews);
    expect(tile.retentionRate).toBeCloseTo(0.4);
    expect(tile.status).toBe('red');
  });

  it('does not count a card with only 1 review as measured', () => {
    const cards = [makeCard(['T']), makeCard(['T']), makeCard(['T'])];
    const reviews: Review[] = [
      ...makeReviews(cards[0].id, ['good', 'good', 'good']),
      ...makeReviews(cards[1].id, ['good', 'good', 'good']),
      ...makeReviews(cards[2].id, ['good', 'good', 'good']),
      // A 4th card would be needed to break avg-per-card; keep only 3 cards but
      // add one with a single review — total reviews 10, avg = 10/4 = 2.5 → cold.
    ];
    const extra = makeCard(['T']);
    reviews.push(...makeReviews(extra.id, ['good']));
    const allCards = [...cards, extra];

    const [tile] = computeHeatmap(allCards, reviews);
    // Card with 1 review is not measured.
    expect(tile.measuredCardCount).toBe(3);
    // Average reviews per card = 10/4 = 2.5, below 3 → cold.
    expect(tile.isColdTag).toBe(true);
    expect(tile.status).toBe('grey');
    expect(tile.retentionRate).toBeNull();
  });

  it('computes positive trend when ratings improve from hard to good', () => {
    // 5 cards, all with 6 reviews: first 3 = 'hard' (1), last 3 = 'good' (2).
    // Also need avg reviews per card >= 3 (it is: 6).
    const cards = [1, 2, 3, 4, 5].map(() => makeCard(['T']));
    const reviews: Review[] = [];
    for (const card of cards) {
      reviews.push(
        ...makeReviews(card.id, ['hard', 'hard', 'hard', 'good', 'good', 'good'])
      );
    }
    const [tile] = computeHeatmap(cards, reviews);
    expect(tile.ratingAverageTrend).not.toBeNull();
    expect(tile.ratingAverageTrend!).toBeCloseTo(1); // 2 - 1 = 1
    expect(tile.status).toBe('green'); // most recent = good
  });

  it('shuffled reviews still sort correctly by reviewedAt', () => {
    const card = makeCard(['T']);
    // Create reviews in reverse-time order; heatmap must sort ascending.
    const reviewsInOrder = makeReviews(card.id, ['again', 'again', 'good']);
    const shuffled = [reviewsInOrder[2], reviewsInOrder[0], reviewsInOrder[1]];
    // Duplicate cards so avg per card >= 3.
    const [tile] = computeHeatmap([card], shuffled);
    // With only 1 card and 3 reviews, avg = 3, not cold.
    expect(tile.isColdTag).toBe(false);
    // Most recent is 'good' → hit.
    expect(tile.retentionRate).toBe(1);
  });

  it('a multi-tag card contributes to both tag tiles', () => {
    const card = makeCard(['A', 'B']);
    const reviews = makeReviews(card.id, ['good', 'good', 'good']);
    const tiles = computeHeatmap([card], reviews);
    expect(tiles).toHaveLength(2);
    const tagA = tiles.find((t) => t.tag === 'A')!;
    const tagB = tiles.find((t) => t.tag === 'B')!;
    expect(tagA.cardCount).toBe(1);
    expect(tagA.measuredCardCount).toBe(1);
    expect(tagA.retentionRate).toBe(1);
    expect(tagA.status).toBe('green');
    expect(tagB.cardCount).toBe(1);
    expect(tagB.measuredCardCount).toBe(1);
    expect(tagB.retentionRate).toBe(1);
    expect(tagB.status).toBe('green');
  });
});
