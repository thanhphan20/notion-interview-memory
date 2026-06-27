import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAppDatabase();
  try {
    const body = await request.json();
    const selectedIndex = body.selectedIndex;
    if (typeof selectedIndex !== 'number') {
      return NextResponse.json({ error: 'selectedIndex is required.' }, { status: 400 });
    }
    const review = db.recordMCQReview(Number(id), selectedIndex);
    return NextResponse.json({ review });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
