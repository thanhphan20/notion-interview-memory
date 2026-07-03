import type { Card, MCQQuestion } from './database';
import type { HeatmapTile } from './heatmap';

export interface SprintSelection {
  cardIds: number[];
  mcqIds: number[];
}

export interface SprintRating {
  cardId: number;
  rating: 'again' | 'hard' | 'good' | 'easy';
}

export interface SprintMCQAnswer {
  mcqId: number;
  correct: boolean;
}

export interface SprintTagBreakdown {
  tag: string;
  score: number;
  total: number;
}

export interface SprintScoreResult {
  score: number;
  tagBreakdown: SprintTagBreakdown[];
}

const DEFAULT_SIZE = 20;

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function classifyTags(heatmap: HeatmapTile[]): { weighted: Set<string>; green: Set<string> } {
  const weighted = new Set<string>();
  const green = new Set<string>();
  for (const tile of heatmap) {
    if (tile.status === 'red' || tile.status === 'yellow') {
      weighted.add(tile.tag);
    } else {
      // green + grey (cold) fall into the "green" fallback bucket
      green.add(tile.tag);
    }
  }
  return { weighted, green };
}

function hasAnyTagIn(tags: string[], set: Set<string>): boolean {
  for (const t of tags) if (set.has(t)) return true;
  return false;
}

function drawN<T>(pool: T[], n: number, rng: () => number): { picked: T[]; remaining: T[] } {
  const shuffled = shuffle(pool, rng);
  const picked = shuffled.slice(0, n);
  const remaining = shuffled.slice(n);
  return { picked, remaining };
}

export function pickSprintItems(
  cards: Card[],
  mcqs: MCQQuestion[],
  heatmap: HeatmapTile[],
  size: number = DEFAULT_SIZE,
  rng: () => number = Math.random,
): SprintSelection {
  const halfSize = Math.floor(size / 2);
  if (cards.length < halfSize) {
    throw new Error(`INSUFFICIENT_DECK: need at least ${halfSize} cards, have ${cards.length}`);
  }
  if (mcqs.length < halfSize) {
    throw new Error(`INSUFFICIENT_DECK: need at least ${halfSize} MCQs, have ${mcqs.length}`);
  }

  const { weighted, green } = classifyTags(heatmap);
  const hasWeighted = weighted.size > 0;

  // Target counts. When weighted tags exist: 70% weighted, 30% fallback, each split 50/50.
  // With size=20 → 7 weighted-card, 7 weighted-mcq, 3 green-card, 3 green-mcq.
  // Without weighted: even split → halfSize cards + halfSize mcqs, all "green".
  const weightedTotal = hasWeighted ? Math.round(size * 0.7) : 0;
  const greenTotal = size - weightedTotal;

  const weightedCardTarget = Math.floor(weightedTotal / 2);
  const weightedMcqTarget = weightedTotal - weightedCardTarget;
  const greenCardTarget = Math.floor(greenTotal / 2);
  const greenMcqTarget = greenTotal - greenCardTarget;

  // Partition pools.
  const weightedCards = hasWeighted ? cards.filter((c) => hasAnyTagIn(c.tags, weighted)) : [];
  const nonWeightedCards = hasWeighted ? cards.filter((c) => !hasAnyTagIn(c.tags, weighted)) : cards.slice();
  const weightedMcqs = hasWeighted ? mcqs.filter((m) => hasAnyTagIn(m.tags, weighted)) : [];
  const nonWeightedMcqs = hasWeighted ? mcqs.filter((m) => !hasAnyTagIn(m.tags, weighted)) : mcqs.slice();

  // Draw weighted first; overflow into non-weighted (green fallback).
  const pickedCardIds = new Set<number>();
  const pickedMcqIds = new Set<number>();

  const drawUnique = <T extends { id: number }>(
    pool: T[],
    n: number,
    seen: Set<number>,
  ): { ids: number[]; leftover: T[] } => {
    const filtered = pool.filter((x) => !seen.has(x.id));
    const { picked } = drawN(filtered, n, rng);
    for (const p of picked) seen.add(p.id);
    const leftover = filtered.filter((x) => !seen.has(x.id));
    return { ids: picked.map((p) => p.id), leftover };
  };

  const wCards = drawUnique(weightedCards, weightedCardTarget, pickedCardIds);
  const wMcqs = drawUnique(weightedMcqs, weightedMcqTarget, pickedMcqIds);

  // Green draw uses only non-weighted (green + grey) pools to preserve the 70/30 ratio.
  const cardShortfall = weightedCardTarget - wCards.ids.length;
  const mcqShortfall = weightedMcqTarget - wMcqs.ids.length;

  const gCards = drawUnique(nonWeightedCards, greenCardTarget + cardShortfall, pickedCardIds);
  const gMcqs = drawUnique(nonWeightedMcqs, greenMcqTarget + mcqShortfall, pickedMcqIds);

  // If green pool also short, backfill from weighted leftovers.
  const cardsSelected = wCards.ids.concat(gCards.ids);
  const mcqsSelected = wMcqs.ids.concat(gMcqs.ids);

  const cardCap = Math.min(halfSize, cards.length);
  const mcqCap = Math.min(halfSize, mcqs.length);

  if (cardsSelected.length < cardCap) {
    const remaining = cards.filter((c) => !pickedCardIds.has(c.id));
    const { picked } = drawN(remaining, cardCap - cardsSelected.length, rng);
    for (const p of picked) {
      pickedCardIds.add(p.id);
      cardsSelected.push(p.id);
    }
  }
  if (mcqsSelected.length < mcqCap) {
    const remaining = mcqs.filter((m) => !pickedMcqIds.has(m.id));
    const { picked } = drawN(remaining, mcqCap - mcqsSelected.length, rng);
    for (const p of picked) {
      pickedMcqIds.add(p.id);
      mcqsSelected.push(p.id);
    }
  }

  // Shuffle to interleave, but return ids grouped in SprintSelection (order within each list is shuffled).
  const shuffledCardIds = shuffle(cardsSelected, rng);
  const shuffledMcqIds = shuffle(mcqsSelected, rng);

  return {
    cardIds: shuffledCardIds,
    mcqIds: shuffledMcqIds,
  };
}

export function computeSprintScore(
  ratings: SprintRating[],
  mcqAnswers: SprintMCQAnswer[],
  cards: Card[],
  mcqs: MCQQuestion[],
): SprintScoreResult {
  const goodEasy = ratings.filter((r) => r.rating === 'good' || r.rating === 'easy').length;
  const correct = mcqAnswers.filter((m) => m.correct).length;
  const rawScore = goodEasy + correct;
  const score = Math.min(20, rawScore);

  const cardById = new Map<number, Card>();
  for (const c of cards) cardById.set(c.id, c);
  const mcqById = new Map<number, MCQQuestion>();
  for (const m of mcqs) mcqById.set(m.id, m);

  const tagTotals = new Map<string, { score: number; total: number }>();
  const bump = (tag: string, success: boolean): void => {
    const entry = tagTotals.get(tag) ?? { score: 0, total: 0 };
    entry.total += 1;
    if (success) entry.score += 1;
    tagTotals.set(tag, entry);
  };

  for (const r of ratings) {
    const card = cardById.get(r.cardId);
    if (!card) continue;
    const success = r.rating === 'good' || r.rating === 'easy';
    for (const tag of card.tags) bump(tag, success);
  }
  for (const a of mcqAnswers) {
    const mcq = mcqById.get(a.mcqId);
    if (!mcq) continue;
    for (const tag of mcq.tags) bump(tag, a.correct);
  }

  const tagBreakdown: SprintTagBreakdown[] = Array.from(tagTotals.entries()).map(([tag, v]) => ({
    tag,
    score: v.score,
    total: v.total,
  }));

  tagBreakdown.sort((a, b) => {
    const aRatio = a.total > 0 ? a.score / a.total : 0;
    const bRatio = b.total > 0 ? b.score / b.total : 0;
    if (bRatio !== aRatio) return bRatio - aRatio;
    return a.tag.localeCompare(b.tag);
  });

  return { score, tagBreakdown };
}
