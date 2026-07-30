import { NextResponse } from 'next/server';
import { createAiProvider } from '@/lib/ai';
import { withDb, type IdContext } from '@/lib/with-db';

export const POST = withDb(async (db, _request: Request, { params }: IdContext) => {
  const note = db.getNote(Number((await params).id));
  if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
  const ai = createAiProvider(db.getSetting('ai') || {});
  const [drafts, mcqs] = await Promise.all([ai.generateCards(note), ai.generateMCQs(note)]);
  return { drafts: db.createDrafts(note.id, drafts), mcqs: db.createMCQs(note.id, mcqs) };
});
