import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { syncNotionDatabase } from '@/lib/notion';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const config = {
      ...(db.getSetting('notion') || {}),
      ...(body || {})
    };
    const existingByPageId = new Map(
      db.listNotes().map((note) => [note.notionPageId, { content: note.content, notionLastEditedTime: note.notionLastEditedTime }])
    );
    const result = await syncNotionDatabase(config, {
      getExistingNote: (notionPageId) => existingByPageId.get(notionPageId),
    });
    const notes = result.notes.map((note) => db.upsertNote(note));
    return NextResponse.json({ imported: notes.length, notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
