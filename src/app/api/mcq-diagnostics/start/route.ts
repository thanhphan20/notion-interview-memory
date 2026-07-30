import { NextResponse } from 'next/server';
import { computeHeatmap } from '@/lib/heatmap';
import { pickDiagnosticMCQs } from '@/lib/mcq-diagnostic';
import { withDb } from '@/lib/with-db';

export const POST = withDb(async (db, request: Request) => {
  const body = await request.json().catch(() => ({}));
  const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim() : undefined;
  const mcqs = db.listMCQs();
  try {
    const heatmap = computeHeatmap(db.listCards(), db.listReviews());
    const mcqIds = pickDiagnosticMCQs(mcqs, db.listMCQReviews(), heatmap, undefined, undefined, tag);
    return {
      diagnostic: db.createMCQDiagnostic(mcqIds),
      mcqs: mcqIds.map((id) => mcqs.find((m) => m.id === id)).filter(Boolean),
      tag: tag ?? null,
    };
  } catch (error: any) {
    const insufficient = error.message?.includes('INSUFFICIENT_MCQS');
    return NextResponse.json(
      { error: error.message, code: insufficient ? 'INSUFFICIENT_MCQS' : 'INTERNAL' },
      { status: insufficient ? 400 : 500 },
    );
  }
});
