import { computeHeatmap } from '@/lib/heatmap';
import { computeLapses } from '@/lib/lapses';
import { computeCountdown } from '@/lib/countdown';
import { withDb, nowFrom } from '@/lib/with-db';

export const GET = withDb((db, request: Request) => {
  const now = nowFrom(request);
  const cards = db.listCards();
  const reviews = db.listReviews();
  return {
    countdown: computeCountdown(db, now),
    heatmap: computeHeatmap(cards, reviews),
    lapses: computeLapses(cards, reviews, 7, now),
    dueQueue: db.listDueCards(now),
  };
});
