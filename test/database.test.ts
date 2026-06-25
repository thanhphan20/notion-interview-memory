import { test, expect } from 'bun:test';
import { createAppDatabase } from '../src/lib/database';

test('upsertNote keeps one row per Notion page and updates changed content', () => {
  const db = createAppDatabase(':memory:');

  const first = db.upsertNote({
    notionPageId: 'notion-1',
    title: 'Caching',
    content: 'Cache aside',
    sourceUrl: 'https://notion.so/notion-1',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const second = db.upsertNote({
    notionPageId: 'notion-1',
    title: 'Caching',
    content: 'Cache aside and write through',
    sourceUrl: 'https://notion.so/notion-1',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T09:00:00.000Z'
  });

  expect(first.id).toBe(second.id);
  expect(db.listNotes()[0].content).toBe('Cache aside and write through');
  db.close();
});

test('draft approval creates a scheduled card and prevents double approval', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'notion-2',
    title: 'Indexes',
    content: 'Indexes speed reads.',
    sourceUrl: 'https://notion.so/notion-2',
    tags: ['database'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const [draft] = db.createDrafts(note.id, [
    {
      question: 'What is the tradeoff of an index?',
      expectedAnswer: 'Faster reads, slower writes.',
      rubric: ['reads', 'writes'],
      tags: ['database']
    }
  ]);

  const card = db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'));

  expect(card.question).toBe('What is the tradeoff of an index?');
  expect(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length).toBe(1);
  expect(() => db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'))).toThrow(/already handled/);
  db.close();
});

test('recordReview stores optional AI feedback and advances schedule', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'notion-3',
    title: 'Queues',
    content: 'Queues decouple producers and consumers.',
    sourceUrl: 'https://notion.so/notion-3',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const [draft] = db.createDrafts(note.id, [{
    question: 'Why use a queue?',
    expectedAnswer: 'To decouple producers and consumers.',
    rubric: ['decouple'],
    tags: ['system-design']
  }]);
  const card = db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'));

  const review = db.recordReview({
    cardId: card.id,
    userAnswer: 'It buffers work between services.',
    aiFeedback: { summary: 'Mention decoupling explicitly.', missingKeyPoints: ['decoupling'], suggestedRating: 'hard' },
    rating: 'hard',
    elapsedSeconds: 42,
    reviewedAt: new Date('2026-06-24T08:00:00.000Z')
  });

  expect(review.rating).toBe('hard');
  expect(db.listReviews()[0].aiFeedback.summary).toBe('Mention decoupling explicitly.');
  expect(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length).toBe(0);
  db.close();
});

test('createMCQs stores questions and listMCQs returns them', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'mcq-test-1',
    title: 'MCQ Test',
    content: 'Test content for MCQ storage.',
    tags: ['Test'],
  });
  const mcqs = db.createMCQs(note.id, [
    {
      question: 'What is test?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Because A is correct.',
      tags: ['Test'],
    },
  ]);
  expect(mcqs).toHaveLength(1);
  expect(mcqs[0].question).toBe('What is test?');
  expect(mcqs[0].correctIndex).toBe(0);

  const all = db.listMCQs();
  expect(all.length).toBeGreaterThanOrEqual(1);
  const found = all.find((m: any) => m.id === mcqs[0].id);
  expect(found).toBeDefined();
  expect(found!.options).toEqual(['A', 'B', 'C', 'D']);

  db.close();
});

test('createMCQs deletes old MCQs for the same note_id', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'mcq-test-2',
    title: 'MCQ Replace',
    content: 'Test content for replacement.',
  });
  db.createMCQs(note.id, [
    { question: 'Old?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Old.', tags: [] },
  ]);
  db.createMCQs(note.id, [
    { question: 'New?', options: ['W', 'X', 'Y', 'Z'], correctIndex: 3, explanation: 'New.', tags: [] },
  ]);
  const all = db.listMCQs();
  const noteMcqs = all.filter((m: any) => m.noteId === note.id);
  expect(noteMcqs).toHaveLength(1);
  expect(noteMcqs[0].question).toBe('New?');

  db.close();
});
