import { NextResponse } from 'next/server';
import { createAiProvider } from '@/lib/ai';
import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, _request: Request, { params }: Ctx) => {
  const note = db.getNote(Number((await params).id));
  if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
  const ai = createAiProvider(db.getSetting('ai') || {});
  const [drafts, mcqs] = await Promise.all([ai.generateCards(note), ai.generateMCQs(note)]);
  return { drafts: db.createDrafts(note.id, drafts), mcqs: db.createMCQs(note.id, mcqs) };
});
