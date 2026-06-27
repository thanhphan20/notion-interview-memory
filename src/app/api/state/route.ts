import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const url = new URL(request.url);
    const now = url.searchParams.get('now') ? new Date(url.searchParams.get('now')!) : new Date();
    const stats = db.stats(now);
    const notes = db.listNotes();
    const drafts = db.listDrafts('draft');
    const cards = db.listCards();
    const dueCards = db.listDueCards(now);
    const reviews = db.listReviews();
    const mcqs = db.listMCQs();
    const mcqReviews = db.listMCQReviews();

    return NextResponse.json({ stats, notes, drafts, cards, dueCards, reviews, mcqs, mcqReviews });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
