import { NextResponse } from 'next/server';
import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, request: Request, { params }: Ctx) => {
  const { selectedIndex } = await request.json();
  if (typeof selectedIndex !== 'number') {
    return NextResponse.json({ error: 'selectedIndex is required.' }, { status: 400 });
  }
  return { review: db.recordMCQReview(Number((await params).id), selectedIndex) };
});
