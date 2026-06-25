import { test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

// Mock global.fetch so route handlers don't make real network calls
const originalFetch = global.fetch;
let db: any;

test('state route returns valid JSON', async () => {
  // Redirect data to :memory: so tests don't touch real DB
  const origCwd = process.cwd;
  // import state route lazily to pick up possible env changes
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
  });

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
  // Ensure AI provider is offline (user may have saved Groq settings in DB)
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

  const cleanDb = createAppDatabase();
  cleanDb.db.prepare('DELETE FROM reviews').run();
  cleanDb.db.prepare('DELETE FROM schedules').run();
  cleanDb.db.prepare('DELETE FROM cards').run();
  cleanDb.db.prepare('DELETE FROM card_drafts').run();
  cleanDb.db.prepare('DELETE FROM notes').run();
  cleanDb.close();
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

  const cleanDb = createAppDatabase();
  cleanDb.db.prepare('DELETE FROM reviews').run();
  cleanDb.db.prepare('DELETE FROM schedules').run();
  cleanDb.db.prepare('DELETE FROM cards').run();
  cleanDb.db.prepare('DELETE FROM card_drafts').run();
  cleanDb.db.prepare('DELETE FROM mcq_questions').run();
  cleanDb.db.prepare('DELETE FROM notes').run();
  cleanDb.close();
});
