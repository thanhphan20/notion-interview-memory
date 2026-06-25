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
    const allMCQs: any[] = [];
    for (const note of notes) {
      const [drafts, mcqs] = await Promise.all([
        aiProvider.generateCards(note),
        aiProvider.generateMCQs(note),
      ]);
      allDrafts.push(...db.createDrafts(note.id, drafts));
      allMCQs.push(...db.createMCQs(note.id, mcqs));
    }
    return NextResponse.json({ drafts: allDrafts, mcqs: allMCQs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
