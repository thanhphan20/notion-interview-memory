import { createAiProvider } from '@/lib/ai';
import { withDb } from '@/lib/with-db';

export const POST = withDb(async (db, _request: Request) => {
  const notes = db.listNotes();
  if (notes.length === 0) throw new Error('No notes synced yet.');

  const ai = createAiProvider(db.getSetting('ai') || {});
  const allDrafts: any[] = [];
  const allMCQs: any[] = [];
  for (const note of notes) {
    const [drafts, mcqs] = await Promise.all([ai.generateCards(note), ai.generateMCQs(note)]);
    allDrafts.push(...db.createDrafts(note.id, drafts));
    allMCQs.push(...db.createMCQs(note.id, mcqs));
  }
  return { drafts: allDrafts, mcqs: allMCQs };
});
