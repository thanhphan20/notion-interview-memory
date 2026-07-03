import type { Card, Review } from './database';

export interface Lapse {
  cardId: number;
  question: string;
  lastRating: string;
  reviewedAt: string;
  tags: string[];
}

const LAPSE_RATINGS = new Set(['again', 'hard']);

export function computeLapses(cards: Card[], reviews: Review[], windowDays: number = 7, now: Date = new Date()): Lapse[] {
  const cutoff = now.getTime() - windowDays * 86400000;
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  const latestReviewByCard = new Map<number, Review>();
  for (const review of reviews) {
    const prev = latestReviewByCard.get(review.cardId);
    if (!prev || new Date(review.reviewedAt).getTime() > new Date(prev.reviewedAt).getTime()) {
      latestReviewByCard.set(review.cardId, review);
    }
  }

  const lapses: Lapse[] = [];
  for (const review of latestReviewByCard.values()) {
    if (!LAPSE_RATINGS.has(review.rating)) continue;
    if (new Date(review.reviewedAt).getTime() < cutoff) continue;
    const card = cardsById.get(review.cardId);
    if (!card) continue;
    lapses.push({
      cardId: card.id,
      question: card.question,
      lastRating: review.rating,
      reviewedAt: review.reviewedAt,
      tags: card.tags,
    });
  }

  lapses.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
  return lapses;
}
