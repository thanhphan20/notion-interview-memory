import { computeSprintScore } from '@/lib/sprint';
import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, request: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  if (Number.isNaN(id)) throw new Error('Invalid sprint id');

  const body = await request.json();
  const ratings = body.ratings ?? [];
  const mcqAnswers = (body.mcqAnswers ?? []).map((a: any) => ({ mcqId: a.mcqId, correct: Boolean(a.correct) }));

  // Record each open-recall review (applies FSRS + clamp via recordReview).
  for (const r of ratings) {
    db.recordReview({
      cardId: r.cardId,
      userAnswer: r.answer ?? '',
      rating: r.rating,
      elapsedSeconds: r.elapsedSeconds ?? 0,
    });
  }
  for (const a of body.mcqAnswers ?? []) {
    db.recordMCQReview(a.mcqId, a.selectedIndex);
  }

  const { score, tagBreakdown } = computeSprintScore(ratings, mcqAnswers, db.listCards(), db.listMCQs());
  return { sprint: db.completeSprint(id, score, tagBreakdown), score, tagBreakdown };
});
