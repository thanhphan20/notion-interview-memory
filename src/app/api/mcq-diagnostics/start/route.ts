import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeHeatmap } from '@/lib/heatmap';
import { pickDiagnosticMCQs } from '@/lib/mcq-diagnostic';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim() : undefined;

    const mcqs = db.listMCQs();
    const heatmap = computeHeatmap(db.listCards(), db.listReviews());
    const mcqReviews = db.listMCQReviews();

    const mcqIds = pickDiagnosticMCQs(mcqs, mcqReviews, heatmap, undefined, undefined, tag);
    const diagnostic = db.createMCQDiagnostic(mcqIds);
    const selectedMCQs = mcqIds.map((id) => mcqs.find((m) => m.id === id)).filter(Boolean);

    return NextResponse.json({ diagnostic, mcqs: selectedMCQs, tag: tag ?? null });
  } catch (error: any) {
    const status = error.message?.includes('INSUFFICIENT_MCQS') ? 400 : 500;
    return NextResponse.json({ error: error.message, code: status === 400 ? 'INSUFFICIENT_MCQS' : 'INTERNAL' }, { status });
  } finally {
    db.close();
  }
}
