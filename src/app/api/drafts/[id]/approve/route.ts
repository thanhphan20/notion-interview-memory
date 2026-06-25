import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const now = body.now ? new Date(body.now) : new Date();
    const card = db.approveDraft(Number(id), now);
    return NextResponse.json({ card });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
