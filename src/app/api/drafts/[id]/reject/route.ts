import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const draft = db.rejectDraft(Number(params.id));
    return NextResponse.json({ draft });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
