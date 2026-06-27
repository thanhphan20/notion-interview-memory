import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const notes = db.listNotes();
    if (notes.length === 0) {
      return NextResponse.json({ error: 'No notes synced yet.' }, { status: 400 });
    }
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const allMCQs: any[] = [];
    for (const note of notes) {
      const mcqs = await aiProvider.generateMCQs(note);
      allMCQs.push(...db.createMCQs(note.id, mcqs));
    }
    return NextResponse.json({ mcqs: allMCQs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
