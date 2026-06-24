const assert = require('node:assert/strict');
const test = require('node:test');

const { createAiProvider, parseCardDrafts, parseAnswerCritique } = require('../src/ai');

test('parseCardDrafts accepts strict JSON card arrays and normalizes tags', () => {
  const raw = JSON.stringify({
    cards: [
      {
        question: 'Explain database indexing tradeoffs.',
        expectedAnswer: 'Indexes speed reads and slow writes.',
        rubric: ['mentions read speed', 'mentions write cost'],
        tags: 'database'
      }
    ]
  });

  const drafts = parseCardDrafts(raw);

  assert.deepEqual(drafts, [
    {
      question: 'Explain database indexing tradeoffs.',
      expectedAnswer: 'Indexes speed reads and slow writes.',
      rubric: ['mentions read speed', 'mentions write cost'],
      tags: ['database']
    }
  ]);
});

test('parseCardDrafts rejects malformed provider output', () => {
  assert.throws(() => parseCardDrafts('{"cards":[{"question":""}]}'), /valid card draft/);
});

test('parseAnswerCritique returns structured feedback with missing key points', () => {
  const critique = parseAnswerCritique(JSON.stringify({
    summary: 'Good high-level answer.',
    missingKeyPoints: ['write amplification'],
    suggestedRating: 'hard'
  }));

  assert.deepEqual(critique, {
    summary: 'Good high-level answer.',
    missingKeyPoints: ['write amplification'],
    suggestedRating: 'hard'
  });
});

test('createAiProvider supports deterministic offline mode', async () => {
  const provider = createAiProvider({ provider: 'offline' });

  const drafts = await provider.generateCards({
    title: 'CAP theorem',
    content: 'Consistency, availability, and partition tolerance are tradeoffs.',
    tags: ['system-design']
  });

  assert.equal(drafts.length, 1);
  assert.match(drafts[0].question, /CAP theorem/);
  assert.equal(drafts[0].tags[0], 'system-design');
});
