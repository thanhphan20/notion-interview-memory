import { NextResponse } from 'next/server';
import { createAiProvider } from '@/lib/ai';
import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, request: Request, { params }: Ctx) => {
  const body = await request.json();
  const card = db.getCard(Number((await params).id));
  if (!card) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
  const critique = await createAiProvider(db.getSetting('ai') || {}).critiqueAnswer({
    card,
    answer: body.answer || '',
  });
  return { critique };
});
