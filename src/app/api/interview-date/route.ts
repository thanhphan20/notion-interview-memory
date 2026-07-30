import { NextResponse } from 'next/server';
import { computeCountdown } from '@/lib/countdown';
import { withDb } from '@/lib/with-db';

export const GET = withDb((db) => ({
  interviewDate: db.getInterviewDate(),
  countdown: computeCountdown(db, new Date()),
}));

export const POST = withDb(async (db, request: Request) => {
  const { date } = (await request.json()) ?? {};
  if (date === null || date === undefined || date === '') {
    db.clearInterviewDate();
  } else if (typeof date === 'string') {
    db.setInterviewDate(date);
  } else {
    return NextResponse.json({ error: 'date must be a YYYY-MM-DD string or null' }, { status: 400 });
  }
  return { interviewDate: db.getInterviewDate(), countdown: computeCountdown(db, new Date()) };
});
