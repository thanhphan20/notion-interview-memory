import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeSprintScore } from '@/lib/sprint';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const db = createAppDatabase();
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid sprint id' }, { status: 400 });
    }

    const body = await request.json();
    const ratings = body.ratings ?? [];
    const mcqAnswers = (body.mcqAnswers ?? []).map((a: any) => ({
      mcqId: a.mcqId,
      correct: Boolean(a.correct),
    }));

    // Record each open-recall review (applies FSRS + clamp via recordReview).
    for (const r of ratings) {
      db.recordReview({
        cardId: r.cardId,
        userAnswer: r.answer ?? '',
        rating: r.rating,
        elapsedSeconds: r.elapsedSeconds ?? 0,
      });
    }
    // Record each MCQ answer.
    for (const a of body.mcqAnswers ?? []) {
      db.recordMCQReview(a.mcqId, a.selectedIndex);
    }

    const cards = db.listCards();
    const mcqs = db.listMCQs();
    const { score, tagBreakdown } = computeSprintScore(ratings, mcqAnswers, cards, mcqs);
    const sprint = db.completeSprint(id, score, tagBreakdown);

    return NextResponse.json({ sprint, score, tagBreakdown });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
