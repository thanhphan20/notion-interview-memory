import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeHeatmap } from '@/lib/heatmap';
import { computeLapses } from '@/lib/lapses';
import { computeCountdown } from '@/lib/countdown';

export async function GET(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const url = new URL(request.url);
    const now = url.searchParams.get('now') ? new Date(url.searchParams.get('now')!) : new Date();
    const cards = db.listCards();
    const reviews = db.listReviews();

    return NextResponse.json({
      countdown: computeCountdown(db, now),
      heatmap: computeHeatmap(cards, reviews),
      lapses: computeLapses(cards, reviews, 7, now),
      dueQueue: db.listDueCards(now),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
