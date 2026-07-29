import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, request: Request, { params }: Ctx) => {
  const cardId = Number((await params).id);
  const body = await request.json();
  const review = db.recordReview({
    cardId,
    userAnswer: body.answer || '',
    aiFeedback: body.aiFeedback || null,
    rating: body.rating,
    elapsedSeconds: Number(body.elapsedSeconds || 0),
    reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : new Date()
  });
  return { review, schedule: db.getSchedule(cardId) };
});
