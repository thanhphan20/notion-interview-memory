import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAppDatabase();
  try {
    const body = await request.json();
    const cardId = Number(id);
    const review = db.recordReview({
      cardId,
      userAnswer: body.answer || '',
      aiFeedback: body.aiFeedback || null,
      rating: body.rating,
      elapsedSeconds: Number(body.elapsedSeconds || 0),
      reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : new Date()
    });
    return NextResponse.json({ review, schedule: db.getSchedule(cardId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
