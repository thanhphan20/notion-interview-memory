import { withDb, nowFrom } from '@/lib/with-db';

export const GET = withDb((db, request: Request) => {
  const now = nowFrom(request);
  return {
    stats: db.stats(now),
    notes: db.listNotes(),
    drafts: db.listDrafts('draft'),
    cards: db.listCards(),
    dueCards: db.listDueCards(now),
    reviews: db.listReviews(),
    mcqs: db.listMCQs(),
    mcqReviews: db.listMCQReviews(),
  };
});
