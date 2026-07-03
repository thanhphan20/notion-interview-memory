import { NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeHeatmap } from '@/lib/heatmap';
import { pickSprintItems } from '@/lib/sprint';

export async function POST() {
  const db = createAppDatabase();
  try {
    const cards = db.listCards();
    const mcqs = db.listMCQs();
    const heatmap = computeHeatmap(cards, db.listReviews());

    const selection = pickSprintItems(cards, mcqs, heatmap);
    const sprint = db.createSprint(selection.cardIds, selection.mcqIds);

    const selectedCards = selection.cardIds
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean);
    const selectedMCQs = selection.mcqIds
      .map((id) => mcqs.find((m) => m.id === id))
      .filter(Boolean);

    return NextResponse.json({ sprint, cards: selectedCards, mcqs: selectedMCQs });
  } catch (error: any) {
    const status = error.message?.includes('INSUFFICIENT_DECK') ? 400 : 500;
    return NextResponse.json({ error: error.message, code: status === 400 ? 'INSUFFICIENT_DECK' : 'INTERNAL' }, { status });
  } finally {
    db.close();
  }
}
