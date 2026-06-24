export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type ScheduleState = 'new' | 'review';

export interface Schedule {
  cardId: number;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: ScheduleState;
  lastReviewedAt: string | null;
}

const VALID_RATINGS = new Set<string>(['again', 'hard', 'good', 'easy']);

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function createInitialSchedule({ cardId, now = new Date() }: { cardId: number; now?: Date }): Schedule {
  return {
    cardId,
    dueAt: toIso(now),
    stability: 0.4,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReviewedAt: null,
  };
}

export function getDueCards<T extends { dueAt: string }>(schedules: T[], now: Date = new Date()): T[] {
  const cutoff = now.getTime();
  return schedules
    .filter((schedule) => new Date(schedule.dueAt).getTime() <= cutoff)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function gradeReview(schedule: Schedule, rating: string, reviewedAt: Date | string = new Date()): Schedule {
  if (!VALID_RATINGS.has(rating)) {
    throw new Error(`Unknown review rating: ${rating}`);
  }

  const reviewDate = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  const previousReview = schedule.lastReviewedAt ? new Date(schedule.lastReviewedAt) : reviewDate;
  const elapsedDays = Math.max(0, Math.floor((reviewDate.getTime() - previousReview.getTime()) / 86400000));
  const reps = schedule.reps + 1;
  let lapses = schedule.lapses;
  let stability = Number(schedule.stability) || 0.4;
  let difficulty = Number(schedule.difficulty) || 5;
  let scheduledDays = 0;
  let dueAt: Date;

  if (rating === 'again') {
    lapses += 1;
    difficulty = Math.min(10, difficulty + 0.8);
    stability = Math.max(0.2, stability * 0.45);
    scheduledDays = 0;
    dueAt = addMinutes(reviewDate, 5);
  } else {
    const growth = rating === 'hard' ? 1.4 : rating === 'good' ? 2.5 : 3.6;
    const firstInterval = rating === 'hard' ? 1 : rating === 'good' ? 1 : 3;
    difficulty = Math.max(1, difficulty + (rating === 'hard' ? 0.25 : rating === 'good' ? -0.15 : -0.35));
    stability = Math.max(firstInterval, stability * growth + elapsedDays * 0.15);
    scheduledDays = reps === 1 ? firstInterval : Math.max(firstInterval, Math.round(stability));
    dueAt = addDays(reviewDate, scheduledDays);
  }

  return {
    ...schedule,
    dueAt: dueAt.toISOString(),
    stability: round(stability),
    difficulty: round(difficulty),
    elapsedDays,
    scheduledDays,
    reps,
    lapses,
    state: 'review',
    lastReviewedAt: reviewDate.toISOString(),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
