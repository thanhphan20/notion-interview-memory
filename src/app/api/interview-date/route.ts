import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { computeCountdown } from '@/lib/countdown';

export async function GET() {
  const db = createAppDatabase();
  try {
    const interviewDate = db.getInterviewDate();
    return NextResponse.json({ interviewDate, countdown: computeCountdown(db, new Date()) });
  } finally {
    db.close();
  }
}

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json();
    const { date } = body ?? {};
    if (date === null || date === undefined || date === '') {
      db.clearInterviewDate();
    } else if (typeof date === 'string') {
      db.setInterviewDate(date);
    } else {
      return NextResponse.json({ error: 'date must be a YYYY-MM-DD string or null' }, { status: 400 });
    }
    return NextResponse.json({ interviewDate: db.getInterviewDate(), countdown: computeCountdown(db, new Date()) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
