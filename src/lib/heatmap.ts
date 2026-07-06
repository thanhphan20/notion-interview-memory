import type { Card, Review } from './database';

export interface HeatmapTile {
  tag: string;
  retentionRate: number | null;
  ratingAverageTrend: number | null;
  cardCount: number;
  measuredCardCount: number;
  totalReviews: number;
  status: 'green' | 'yellow' | 'red' | 'grey';
  isColdTag: boolean;
}

const RATING_VALUES: Record<string, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

function ratingToNumber(rating: string): number {
  return RATING_VALUES[rating] ?? 0;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

export function computeHeatmap(cards: Card[], reviews: Review[]): HeatmapTile[] {
  // Group reviews by cardId, sorted ascending by reviewedAt.
  const reviewsByCard = new Map<number, Review[]>();
  for (const r of reviews) {
    if (!reviewsByCard.has(r.cardId)) reviewsByCard.set(r.cardId, []);
    reviewsByCard.get(r.cardId)!.push(r);
  }
  for (const list of reviewsByCard.values()) {
    list.sort((a, b) => {
      const at = new Date(a.reviewedAt).getTime();
      const bt = new Date(b.reviewedAt).getTime();
      return at - bt;
    });
  }

  // Group cards by tag.
  const cardsByTag = new Map<string, Card[]>();
  for (const card of cards) {
    for (const tag of card.tags) {
      if (!cardsByTag.has(tag)) cardsByTag.set(tag, []);
      cardsByTag.get(tag)!.push(card);
    }
  }

  const tiles: HeatmapTile[] = [];
  for (const [tag, tagCards] of cardsByTag) {
    const cardCount = tagCards.length;
    let totalReviews = 0;
    let measuredCardCount = 0;
    let retentionHits = 0;
    const perCardDeltas: number[] = [];

    for (const card of tagCards) {
      const cardReviews = reviewsByCard.get(card.id) ?? [];
      totalReviews += cardReviews.length;

      if (cardReviews.length >= 3) {
        measuredCardCount += 1;
        const lastThree = cardReviews.slice(-3);
        const mostRecent = lastThree[lastThree.length - 1];
        if (mostRecent.rating === 'good' || mostRecent.rating === 'easy') {
          retentionHits += 1;
        }
      }

      if (cardReviews.length >= 6) {
        const lastThree = cardReviews.slice(-3).map((r) => ratingToNumber(r.rating));
        const priorThree = cardReviews.slice(-6, -3).map((r) => ratingToNumber(r.rating));
        perCardDeltas.push(mean(lastThree) - mean(priorThree));
      }
    }

    const averageReviewsPerCard = cardCount > 0 ? totalReviews / cardCount : 0;
    const isColdTag = averageReviewsPerCard < 3 || measuredCardCount === 0;

    let retentionRate: number | null = null;
    let status: HeatmapTile['status'] = 'grey';
    if (!isColdTag) {
      retentionRate = retentionHits / measuredCardCount;
      if (retentionRate >= 0.8) status = 'green';
      else if (retentionRate >= 0.5) status = 'yellow';
      else status = 'red';
    }

    const ratingAverageTrend =
      !isColdTag && perCardDeltas.length > 0 ? mean(perCardDeltas) : null;

    tiles.push({
      tag,
      retentionRate,
      ratingAverageTrend,
      cardCount,
      measuredCardCount,
      totalReviews,
      status,
      isColdTag,
    });
  }

  return tiles;
}
