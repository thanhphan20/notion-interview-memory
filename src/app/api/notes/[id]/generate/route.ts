import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAppDatabase();
  try {
    const note = db.getNote(Number(id));
    if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const [drafts, mcqs] = await Promise.all([
      aiProvider.generateCards(note),
      aiProvider.generateMCQs(note),
    ]);
    const savedDrafts = db.createDrafts(note.id, drafts);
    const savedMCQs = db.createMCQs(note.id, mcqs);
    return NextResponse.json({ drafts: savedDrafts, mcqs: savedMCQs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
