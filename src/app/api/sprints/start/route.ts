import { NextResponse } from 'next/server';
import { computeHeatmap } from '@/lib/heatmap';
import { pickSprintItems } from '@/lib/sprint';
import { withDb } from '@/lib/with-db';

export const POST = withDb((db) => {
  const cards = db.listCards();
  const mcqs = db.listMCQs();
  try {
    const selection = pickSprintItems(cards, mcqs, computeHeatmap(cards, db.listReviews()));
    return {
      sprint: db.createSprint(selection.cardIds, selection.mcqIds),
      cards: selection.cardIds.map((id) => cards.find((c) => c.id === id)).filter(Boolean),
      mcqs: selection.mcqIds.map((id) => mcqs.find((m) => m.id === id)).filter(Boolean),
    };
  } catch (error: any) {
    const insufficient = error.message?.includes('INSUFFICIENT_DECK');
    return NextResponse.json(
      { error: error.message, code: insufficient ? 'INSUFFICIENT_DECK' : 'INTERNAL' },
      { status: insufficient ? 400 : 500 },
    );
  }
});
