import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const body = await request.json();
    const card = db.getCard(Number(params.id));
    if (!card) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const critique = await aiProvider.critiqueAnswer({
      card,
      answer: body.answer || ''
    });
    return NextResponse.json({ critique });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
