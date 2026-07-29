import { syncNotionDatabase } from '@/lib/notion';
import { withDb } from '@/lib/with-db';

export const POST = withDb(async (db, request: Request) => {
  const body = await request.json().catch(() => ({}));
  const existingByPageId = new Map(
    db.listNotes().map((note) => [note.notionPageId, { content: note.content, notionLastEditedTime: note.notionLastEditedTime }])
  );
  const result = await syncNotionDatabase({ ...(db.getSetting('notion') || {}), ...(body || {}) }, {
    getExistingNote: (notionPageId) => existingByPageId.get(notionPageId),
  });
  const notes = result.notes.map((note) => db.upsertNote(note));
  return { imported: notes.length, notes };
});
