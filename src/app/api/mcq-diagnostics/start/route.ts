import { NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeHeatmap } from '@/lib/heatmap';
import { pickDiagnosticMCQs } from '@/lib/mcq-diagnostic';

export async function POST() {
  const db = createAppDatabase();
  try {
    const mcqs = db.listMCQs();
    const heatmap = computeHeatmap(db.listCards(), db.listReviews());
    const mcqReviews = db.listMCQReviews();

    const mcqIds = pickDiagnosticMCQs(mcqs, mcqReviews, heatmap);
    const diagnostic = db.createMCQDiagnostic(mcqIds);
    const selectedMCQs = mcqIds.map((id) => mcqs.find((m) => m.id === id)).filter(Boolean);

    return NextResponse.json({ diagnostic, mcqs: selectedMCQs });
  } catch (error: any) {
    const status = error.message?.includes('INSUFFICIENT_MCQS') ? 400 : 500;
    return NextResponse.json({ error: error.message, code: status === 400 ? 'INSUFFICIENT_MCQS' : 'INTERNAL' }, { status });
  } finally {
    db.close();
  }
}
