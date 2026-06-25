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
    const generated = await aiProvider.generateCards(note);
    const drafts = db.createDrafts(note.id, generated);
    return NextResponse.json({ drafts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
