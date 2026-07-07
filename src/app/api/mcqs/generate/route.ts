import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const topics: string[] = Array.isArray(body.topics) ? body.topics.filter((t: any) => typeof t === 'string' && t) : [];

    if (db.listNotes().length === 0) {
      return NextResponse.json({ error: 'No notes synced yet.' }, { status: 400 });
    }

    const notes = topics.length > 0 ? db.listNotesByTopics(topics) : db.listNotes();
    if (notes.length === 0) {
      return NextResponse.json({ error: 'No notes match the selected topics.' }, { status: 400 });
    }

    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const allMCQs: any[] = [];
    for (const note of notes) {
      const existingQuestions = db.listMCQsForNote(note.id).map((mcq) => mcq.question);
      const mcqs = await aiProvider.generateMCQs(note, existingQuestions);
      allMCQs.push(...db.appendMCQs(note.id, mcqs));
    }
    return NextResponse.json({ mcqs: allMCQs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
