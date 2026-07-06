import { test, expect, mock } from 'bun:test';
import { createAiProvider, listProviderModels, pingProvider, parseCardDrafts, parseAnswerCritique, parseMCQs, type NoteInput } from '../src/lib/ai';
import { AI_PROVIDERS, getProviderInfo } from '../src/lib/ai-models';

const sampleNote: NoteInput = {
  title: 'CAP theorem',
  content: 'Consistency, availability, and partition tolerance are tradeoffs.',
  tags: ['system-design'],
};

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

test('generateMCQs from offline provider returns multiple deterministic MCQs', async () => {
  const provider = createAiProvider({ provider: 'offline' });
  const note: NoteInput = {
    title: 'B+Tree Indexing',
    content: 'B+Tree is a balanced tree data structure that enables O(log n) search, insert, and delete operations. It is commonly used in database indexing because of its efficient range queries and predictable performance.',
    tags: ['Databases'],
  };
  const mcqs = await provider.generateMCQs(note);
  expect(mcqs.length).toBeGreaterThanOrEqual(1);
  for (const mcq of mcqs) {
    expect(mcq).toHaveProperty('question');
    expect(mcq).toHaveProperty('options');
    expect(mcq.options).toHaveLength(4);
    expect(typeof mcq.correctIndex).toBe('number');
    expect(mcq.correctIndex).toBeGreaterThanOrEqual(0);
    expect(mcq.correctIndex).toBeLessThan(4);
    expect(mcq).toHaveProperty('explanation');
    expect(mcq.tags).toEqual(['Databases']);
  }
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

test('AI_PROVIDERS registry includes openrouter and gemini with defaults', () => {
  for (const id of ['groq', 'openrouter', 'gemini']) {
    const info = getProviderInfo(id);
    expect(info).toBeDefined();
    expect(info!.defaultBaseUrl).toMatch(/^https:\/\//);
    expect(info!.defaultModel.length).toBeGreaterThan(0);
    expect(info!.requiresApiKey).toBe(true);
  }
  expect(AI_PROVIDERS.some((p) => p.id === 'offline')).toBe(true);
});

test('createAiProvider builds openrouter and gemini providers with a supplied key', () => {
  // Should not throw when an API key is provided; provider defaults fill in base URL/model.
  expect(() => createAiProvider({ provider: 'openrouter', apiKey: 'test-key' })).not.toThrow();
  expect(() => createAiProvider({ provider: 'gemini', apiKey: 'test-key' })).not.toThrow();
});

test('createAiProvider rejects key-requiring providers without an API key', () => {
  const prev = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    expect(() => createAiProvider({ provider: 'openrouter' })).toThrow(/API_KEY/);
    expect(() => createAiProvider({ provider: 'gemini' })).toThrow(/API_KEY/);
  } finally {
    if (prev !== undefined) process.env.AI_API_KEY = prev;
  }
});

test('createAiProvider rejects unknown providers', () => {
  expect(() => createAiProvider({ provider: 'nonexistent' })).toThrow(/Unsupported AI provider/);
});

test('createAiProvider falls back to the next config when the primary call fails', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async (url: string) => {
      if (String(url).includes('primary.example')) {
        return new Response('server error', { status: 500 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ cards: [{
          question: 'Q?', expectedAnswer: 'A', rubric: ['r'], tags: [],
        }] }) } }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = createAiProvider({
      provider: 'openai-compatible',
      apiKey: 'primary-key',
      baseUrl: 'https://primary.example/v1',
      fallbacks: [
        { provider: 'openai-compatible', apiKey: 'fallback-key', baseUrl: 'https://fallback.example/v1' },
      ],
    });

    const drafts = await provider.generateCards(sampleNote);
    expect(drafts[0].question).toBe('Q?');
  } finally {
    global.fetch = originalFetch;
  }
});

test('createAiProvider falls back past a misconfigured fallback (missing API key)', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ cards: [{
          question: 'Q?', expectedAnswer: 'A', rubric: ['r'], tags: [],
        }] }) } }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = createAiProvider({
      provider: 'openai-compatible',
      apiKey: 'bad-key',
      baseUrl: 'https://primary.example/v1',
      fallbacks: [
        { provider: 'openrouter' }, // no apiKey -> fails to even construct
        { provider: 'offline' },
      ],
    });
    global.fetch = mock(async () => new Response('unauthorized', { status: 401 })) as unknown as typeof fetch;

    const drafts = await provider.generateCards(sampleNote);
    expect(drafts.length).toBeGreaterThan(0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('createAiProvider throws the last error when every provider in the chain fails', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;

    const provider = createAiProvider({
      provider: 'openai-compatible',
      apiKey: 'key-a',
      baseUrl: 'https://primary.example/v1',
      fallbacks: [
        { provider: 'openai-compatible', apiKey: 'key-b', baseUrl: 'https://fallback.example/v1' },
      ],
    });

    await expect(provider.generateCards(sampleNote)).rejects.toThrow(/request failed/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('pingProvider succeeds immediately for the offline provider without any network call', async () => {
  const originalFetch = global.fetch;
  global.fetch = mock(async () => { throw new Error('should not be called'); }) as unknown as typeof fetch;
  try {
    const result = await pingProvider({ provider: 'offline' });
    expect(result.ok).toBe(true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('pingProvider reports failure without throwing when the API key is missing', async () => {
  const result = await pingProvider({ provider: 'openrouter' });
  expect(result.ok).toBe(false);
  expect(result.message).toMatch(/API key/);
});

test('pingProvider reports success when the provider responds', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'pong' } }],
    }), { status: 200 })) as unknown as typeof fetch;

    const result = await pingProvider({ provider: 'groq', apiKey: 'test-key' });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/pong/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('pingProvider reports failure with the HTTP status when the provider rejects the request', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async () => new Response('unauthorized', { status: 401 })) as unknown as typeof fetch;
    const result = await pingProvider({ provider: 'groq', apiKey: 'bad-key' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/401/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('listProviderModels returns an empty list for the offline provider', async () => {
  const models = await listProviderModels({ provider: 'offline' });
  expect(models).toEqual([]);
});

test('listProviderModels rejects when no API key is available', async () => {
  await expect(listProviderModels({ provider: 'groq' })).rejects.toThrow(/API key/);
});

test('listProviderModels fetches and sorts models from the provider models endpoint', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async (url: string) => {
      expect(String(url)).toMatch(/\/models$/);
      return new Response(JSON.stringify({
        data: [{ id: 'zeta-model' }, { id: 'alpha-model' }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const models = await listProviderModels({ provider: 'groq', apiKey: 'test-key' });
    expect(models).toEqual([
      { id: 'alpha-model', label: 'alpha-model' },
      { id: 'zeta-model', label: 'zeta-model' },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('listProviderModels throws a descriptive error when the request fails', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock(async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch;
    await expect(listProviderModels({ provider: 'groq', apiKey: 'bad-key' })).rejects.toThrow(/403/);
  } finally {
    global.fetch = originalFetch;
  }
});
