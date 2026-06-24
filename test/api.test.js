const assert = require('node:assert/strict');
const test = require('node:test');

const { createApi } = require('../src/api');
const { createAppDatabase } = require('../src/database');

test('sync endpoint imports Notion notes and exposes state', async () => {
  const db = createAppDatabase(':memory:');
  const api = createApi({
    db,
    notionSync: async () => ({
      imported: 1,
      notes: [{
        notionPageId: 'page-api-1',
        title: 'Rate Limiting',
        content: 'Token bucket limits bursty traffic.',
        sourceUrl: 'https://notion.so/page-api-1',
        tags: ['system-design'],
        notionLastEditedTime: '2026-06-24T08:00:00.000Z'
      }]
    }),
    aiProvider: fakeAiProvider()
  });

  const sync = await api.dispatch('POST', '/api/notion/sync', {});
  const state = await api.dispatch('GET', '/api/state');

  assert.equal(sync.status, 200);
  assert.equal(sync.body.imported, 1);
  assert.equal(state.body.notes[0].title, 'Rate Limiting');
  assert.equal(state.body.stats.totalNotes, 1);
});

test('draft generation and approval make a due interview card', async () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'page-api-2',
    title: 'Backpressure',
    content: 'Backpressure prevents producers from overwhelming consumers.',
    sourceUrl: 'https://notion.so/page-api-2',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const api = createApi({ db, aiProvider: fakeAiProvider() });

  const generated = await api.dispatch('POST', `/api/notes/${note.id}/generate`, {});
  const approved = await api.dispatch('POST', `/api/drafts/${generated.body.drafts[0].id}/approve`, {
    now: '2026-06-24T08:00:00.000Z'
  });
  const state = await api.dispatch('GET', '/api/state?now=2026-06-24T08:00:00.000Z');

  assert.equal(approved.status, 200);
  assert.equal(state.body.dueCards.length, 1);
  assert.equal(state.body.dueCards[0].question, 'Explain Backpressure.');
});

test('critique and review endpoints keep final grade user-controlled', async () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'page-api-3',
    title: 'Idempotency',
    content: 'Retry-safe APIs need idempotency keys.',
    sourceUrl: 'https://notion.so/page-api-3',
    tags: ['backend'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const [draft] = db.createDrafts(note.id, [{
    question: 'Explain Idempotency.',
    expectedAnswer: 'Retry-safe APIs need idempotency keys.',
    rubric: ['idempotency keys'],
    tags: ['backend']
  }]);
  const card = db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'));
  const api = createApi({ db, aiProvider: fakeAiProvider() });

  const critique = await api.dispatch('POST', `/api/cards/${card.id}/critique`, {
    answer: 'It makes retries safe.'
  });
  const review = await api.dispatch('POST', `/api/cards/${card.id}/review`, {
    answer: 'It makes retries safe.',
    aiFeedback: critique.body.critique,
    rating: 'good',
    elapsedSeconds: 18,
    reviewedAt: '2026-06-24T08:00:00.000Z'
  });

  assert.equal(critique.body.critique.suggestedRating, 'hard');
  assert.equal(review.body.review.rating, 'good');
  assert.equal(db.listReviews()[0].aiFeedback.suggestedRating, 'hard');
});

function fakeAiProvider() {
  return {
    async generateCards(note) {
      return [{
        question: `Explain ${note.title}.`,
        expectedAnswer: note.content,
        rubric: ['clear definition'],
        tags: note.tags
      }];
    },
    async critiqueAnswer() {
      return {
        summary: 'Good start, add one concrete keyword.',
        missingKeyPoints: ['idempotency keys'],
        suggestedRating: 'hard'
      };
    }
  };
}
