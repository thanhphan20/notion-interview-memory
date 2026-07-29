import { createAiProvider } from '@/lib/ai';
import { withDb } from '@/lib/with-db';

export const POST = withDb(async (db, request: Request) => {
  const body = await request.json().catch(() => ({}));
  const topics: string[] = Array.isArray(body.topics) ? body.topics.filter((t: any) => typeof t === 'string' && t) : [];

  if (db.listNotes().length === 0) throw new Error('No notes synced yet.');
  const notes = topics.length > 0 ? db.listNotesByTopics(topics) : db.listNotes();
  if (notes.length === 0) throw new Error('No notes match the selected topics.');

  const ai = createAiProvider(db.getSetting('ai') || {});
  const allMCQs: any[] = [];
  for (const note of notes) {
    const existingQuestions = db.listMCQsForNote(note.id).map((mcq) => mcq.question);
    allMCQs.push(...db.appendMCQs(note.id, await ai.generateMCQs(note, existingQuestions)));
  }
  return { mcqs: allMCQs };
});
