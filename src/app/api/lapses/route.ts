import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeLapses } from '@/lib/lapses';

export async function GET(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const url = new URL(request.url);
    const windowDays = Math.max(1, Number(url.searchParams.get('windowDays') ?? 7));
    const now = url.searchParams.get('now') ? new Date(url.searchParams.get('now')!) : new Date();
    const lapses = computeLapses(db.listCards(), db.listReviews(), windowDays, now);
    return NextResponse.json({ windowDays, lapses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
