import { test, expect, mock, beforeAll } from 'bun:test';
import { NextRequest } from 'next/server';
import { mkdtempSync } from 'node:fs';

let origDataDir: string | undefined;

beforeAll(() => {
  const tmpDir = mkdtempSync('opencode-test-');
  origDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmpDir;
});

const originalFetch = global.fetch;

test('state route returns valid JSON', async () => {
  const mod = await import('../src/app/api/state/route');
  const res = await mod.GET(new NextRequest('http://localhost/api/state'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('stats');
  expect(body).toHaveProperty('notes');
  expect(body).toHaveProperty('drafts');
  expect(body).toHaveProperty('cards');
  expect(body).toHaveProperty('dueCards');
  expect(body).toHaveProperty('reviews');
  expect(body).toHaveProperty('mcqs');
  expect(Array.isArray(body.mcqs)).toBe(true);
  expect(body).toHaveProperty('mcqReviews');
  expect(Array.isArray(body.mcqReviews)).toBe(true);
});

test('sync route handles valid request', async () => {
  global.fetch = mock(async (url: string) => {
    if (url.includes('databases')) {
      return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 });
    }
    if (url.includes('blocks')) {
      return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as any;

  const mod = await import('../src/app/api/notion/sync/route');
  const req = new NextRequest('http://localhost/api/notion/sync', {
    method: 'POST',
    body: JSON.stringify({ token: 'fake', databaseId: 'fake' })
  });
  const res = await mod.POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('imported');

  global.fetch = originalFetch;
});

test('generate-all route creates drafts from all notes', async () => {
  const { createAppDatabase } = await import('../src/lib/database');
  const testDb = createAppDatabase();
  testDb.setSetting('ai', { provider: 'offline' });
  testDb.upsertNote({
    notionPageId: 'gen-test-page-1',
    title: 'Batch Generate Test',
    content: 'This is test content used to verify batch draft generation works correctly.',
    tags: ['Test'],
    sourceUrl: '',
    notionLastEditedTime: new Date().toISOString(),
  });
  testDb.close();

  const mod = await import('../src/app/api/notes/generate-all/route');
  const req = new NextRequest('http://localhost/api/notes/generate-all', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const res = await mod.POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('drafts');
  expect(Array.isArray(body.drafts)).toBe(true);
  expect(body.drafts.length).toBeGreaterThanOrEqual(1);
  expect(body.drafts[0]).toHaveProperty('question');
  expect(body.drafts[0]).toHaveProperty('expectedAnswer');
});

test('generate-all route creates MCQs alongside drafts', async () => {
  const { createAppDatabase } = await import('../src/lib/database');
  const testDb = createAppDatabase();
  testDb.setSetting('ai', { provider: 'offline' });
  testDb.upsertNote({
    notionPageId: 'mcq-gen-page-1',
    title: 'MCQ Generation Test',
    content: 'This content verifies that calling generate-all produces both drafts and MCQ questions.',
    tags: ['Test'],
  });
  testDb.close();

  const mod = await import('../src/app/api/notes/generate-all/route');
  const req = new NextRequest('http://localhost/api/notes/generate-all', {
    method: 'POST', body: JSON.stringify({}),
  });
  const res = await mod.POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('mcqs');
  expect(Array.isArray(body.mcqs)).toBe(true);
  expect(body.mcqs.length).toBeGreaterThanOrEqual(1);
  expect(body.mcqs[0]).toHaveProperty('question');
  expect(body.mcqs[0]).toHaveProperty('options');
});
