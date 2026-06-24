const assert = require('node:assert/strict');
const test = require('node:test');

const { createAppDatabase } = require('../src/database');

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

  assert.equal(first.id, second.id);
  assert.equal(db.listNotes()[0].content, 'Cache aside and write through');
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

  assert.equal(card.question, 'What is the tradeoff of an index?');
  assert.equal(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length, 1);
  assert.throws(() => db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z')), /already handled/);
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

  assert.equal(review.rating, 'hard');
  assert.equal(db.listReviews()[0].aiFeedback.summary, 'Mention decoupling explicitly.');
  assert.equal(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length, 0);
});
