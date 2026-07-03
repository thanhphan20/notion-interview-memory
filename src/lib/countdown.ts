import type { AppDatabase } from './database';
import { computeHeatmap } from './heatmap';

export type CountdownStatus = 'active' | 'elapsed' | 'unset';

export interface Countdown {
  interviewDate: string | null;
  daysUntil: number | null;
  sprintScoreAverage: number | null;
  sprintCount: number;
  heatmapGreenPercent: number | null;
  status: CountdownStatus;
}

export function computeCountdown(db: AppDatabase, now: Date = new Date()): Countdown {
  const interviewDate = db.getInterviewDate();
  const daysUntil = interviewDate ? daysUntilDate(interviewDate, now) : null;
  const status: CountdownStatus = !interviewDate ? 'unset' : (daysUntil! < 0 ? 'elapsed' : 'active');

  const tiles = computeHeatmap(db.listCards(), db.listReviews());
  const nonCold = tiles.filter((t) => !t.isColdTag);
  const greenPercent = nonCold.length === 0 ? null : nonCold.filter((t) => t.status === 'green').length / nonCold.length;

  return {
    interviewDate,
    daysUntil,
    sprintScoreAverage: null,
    sprintCount: 0,
    heatmapGreenPercent: greenPercent,
    status,
  };
}

function daysUntilDate(dateStr: string, now: Date): number {
  const target = new Date(`${dateStr}T00:00:00.000Z`);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}
