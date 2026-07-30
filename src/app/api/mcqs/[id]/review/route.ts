import { NextResponse } from 'next/server';
import { withDb, type IdContext } from '@/lib/with-db';

export const POST = withDb(async (db, request: Request, { params }: IdContext) => {
  const { selectedIndex } = await request.json();
  if (typeof selectedIndex !== 'number') {
    return NextResponse.json({ error: 'selectedIndex is required.' }, { status: 400 });
  }
  return { review: db.recordMCQReview(Number((await params).id), selectedIndex) };
});
