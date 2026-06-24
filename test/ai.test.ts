import { test, expect } from 'bun:test';
import { createAiProvider, parseCardDrafts, parseAnswerCritique } from '../src/lib/ai';

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

  expect(drafts).toEqual([
    {
      question: 'Explain database indexing tradeoffs.',
      expectedAnswer: 'Indexes speed reads and slow writes.',
      rubric: ['mentions read speed', 'mentions write cost'],
      tags: ['database']
    }
  ]);
});

test('parseCardDrafts rejects malformed provider output', () => {
  expect(() => parseCardDrafts('{"cards":[{"question":""}]}')).toThrow(/valid card draft/);
});

test('parseAnswerCritique returns structured feedback with missing key points', () => {
  const critique = parseAnswerCritique(JSON.stringify({
    summary: 'Good high-level answer.',
    missingKeyPoints: ['write amplification'],
    suggestedRating: 'hard'
  }));

  expect(critique).toEqual({
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

  expect(drafts.length).toBe(1);
  expect(drafts[0].question).toMatch(/CAP theorem/);
  expect(drafts[0].tags[0]).toBe('system-design');
});
