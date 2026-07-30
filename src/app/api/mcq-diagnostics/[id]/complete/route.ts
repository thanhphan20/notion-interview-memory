import { computeWeaknessReport } from '@/lib/mcq-diagnostic';
import { withDb, type IdContext } from '@/lib/with-db';

export const POST = withDb(async (db, request: Request, { params }: IdContext) => {
  const id = Number((await params).id);
  if (Number.isNaN(id)) throw new Error('Invalid diagnostic id');

  const body = await request.json();
  const answers: Array<{ mcqId: number; selectedIndex: number }> = body.answers ?? [];
  const mcqs = db.listMCQs();
  const scoredAnswers = answers.map((a) => ({
    ...a,
    correct: mcqs.find((m) => m.id === a.mcqId)?.correctIndex === a.selectedIndex,
  }));

  for (const a of answers) {
    db.recordMCQReview(a.mcqId, a.selectedIndex);
  }

  const report = computeWeaknessReport(mcqs, scoredAnswers);
  const score = scoredAnswers.filter((a) => a.correct).length;
  return { diagnostic: db.completeMCQDiagnostic(id, score, report.entries), score, weaknessReport: report };
});
