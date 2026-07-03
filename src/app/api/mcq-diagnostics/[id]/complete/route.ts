import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeWeaknessReport } from '@/lib/mcq-diagnostic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const db = createAppDatabase();
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid diagnostic id' }, { status: 400 });
    }

    const body = await request.json();
    const answers: Array<{ mcqId: number; selectedIndex: number }> = body.answers ?? [];

    const mcqs = db.listMCQs();
    const scoredAnswers = answers.map((a) => {
      const mcq = mcqs.find((m) => m.id === a.mcqId);
      const correct = mcq ? a.selectedIndex === mcq.correctIndex : false;
      return { mcqId: a.mcqId, selectedIndex: a.selectedIndex, correct };
    });

    // Record each answer in mcq_reviews.
    for (const a of answers) {
      db.recordMCQReview(a.mcqId, a.selectedIndex);
    }

    const report = computeWeaknessReport(mcqs, scoredAnswers);
    const score = scoredAnswers.filter((a) => a.correct).length;
    const diagnostic = db.completeMCQDiagnostic(id, score, report.entries);

    return NextResponse.json({ diagnostic, score, weaknessReport: report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
