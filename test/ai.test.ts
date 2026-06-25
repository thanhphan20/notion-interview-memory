import { test, expect } from 'bun:test';
import { createAiProvider, parseCardDrafts, parseAnswerCritique, parseMCQs, type NoteInput } from '../src/lib/ai';

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

test('generateMCQs from offline provider returns a deterministic MCQ', async () => {
  const provider = createAiProvider({ provider: 'offline' });
  const note: NoteInput = {
    title: 'B+Tree Indexing',
    content: 'B+Tree is a balanced tree data structure that enables O(log n) search, insert, and delete operations. It is commonly used in database indexing because of its efficient range queries and predictable performance.',
    tags: ['Databases'],
  };
  const mcqs = await provider.generateMCQs(note);
  expect(mcqs).toHaveLength(1);
  expect(mcqs[0]).toHaveProperty('question');
  expect(mcqs[0]).toHaveProperty('options');
  expect(mcqs[0].options).toHaveLength(4);
  expect(typeof mcqs[0].correctIndex).toBe('number');
  expect(mcqs[0].correctIndex).toBeGreaterThanOrEqual(0);
  expect(mcqs[0].correctIndex).toBeLessThan(4);
  expect(mcqs[0]).toHaveProperty('explanation');
  expect(mcqs[0].tags).toEqual(['Databases']);
});

test('parseMCQs validates correctIndex bounds and rejects invalid index', () => {
  expect(() => parseMCQs(JSON.stringify({
    mcqs: [{ question: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 99, explanation: 'X', tags: [] }],
  }))).toThrow(/correctIndex/);

  expect(() => parseMCQs(JSON.stringify({
    mcqs: [{ question: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: -1, explanation: 'X', tags: [] }],
  }))).toThrow(/correctIndex/);
});

test('parseMCQs rejects empty question', () => {
  expect(() => parseMCQs(JSON.stringify({
    mcqs: [{ question: '', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'X', tags: [] }],
  }))).toThrow(/non-empty question/);
});

test('generateMCQs from offline provider handles empty content gracefully', async () => {
  const provider = createAiProvider({ provider: 'offline' });
  const mcqs = await provider.generateMCQs({ title: 'Empty', content: '' });
  expect(mcqs).toHaveLength(1);
  expect(mcqs[0].options.length).toBeGreaterThanOrEqual(2);
});
