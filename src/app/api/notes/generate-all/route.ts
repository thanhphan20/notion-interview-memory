import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const notes = db.listNotes();
    if (notes.length === 0) {
      return NextResponse.json({ error: 'No notes synced yet.' }, { status: 400 });
    }
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const allDrafts: any[] = [];
    for (const note of notes) {
      const generated = await aiProvider.generateCards(note);
      const saved = db.createDrafts(note.id, generated);
      allDrafts.push(...saved);
    }
    return NextResponse.json({ drafts: allDrafts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
