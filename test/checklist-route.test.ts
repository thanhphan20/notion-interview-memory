import { afterAll, beforeAll, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseChecklist } from '../src/lib/checklist';

const originalDataDir = process.env.DATA_DIR;
const dataDir = mkdtempSync(path.join(tmpdir(), 'checklist-api-'));
const markdown = '# PART 1 — Fundamentals\n## Java Core\n- HashMap internals\n- Generics\n';

beforeAll(() => {
  process.env.DATA_DIR = dataDir;
});

afterAll(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

async function seedChecklist() {
  const { createAppDatabase } = await import('../src/lib/database');
  const db = createAppDatabase();
  const items = parseChecklist(markdown);
  db.importChecklistItems(items);
  for (const item of db.listChecklistItems()) {
    db.updateChecklistItem(item.id, { done: false, takeaway: '' });
  }
  db.close();
  return items;
}

function patchRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/checklist/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('GET checklist returns active rows in order and hides archived rows', async () => {
  const items = await seedChecklist();
  const { createAppDatabase } = await import('../src/lib/database');
  const db = createAppDatabase();
  db.importChecklistItems([items[0]]);
  db.close();

  const route = await import('../src/app/api/checklist/route');
  const response = await route.GET();
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.items.map((item: { itemKey: string }) => item.itemKey)).toEqual([items[0].itemKey]);
});

test('PATCH persists done and takeaway on only the addressed item', async () => {
  const items = await seedChecklist();
  const route = await import('../src/app/api/checklist/[id]/route');

  const response = await route.PATCH(patchRequest('1', { done: true, takeaway: 'A HashMap hashes keys into buckets.' }), {
    params: Promise.resolve({ id: '1' }),
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.item).toMatchObject({ id: 1, done: true, takeaway: 'A HashMap hashes keys into buckets.' });
  expect(body.item.itemKey).toBe(items[0].itemKey);

  const { createAppDatabase } = await import('../src/lib/database');
  const db = createAppDatabase();
  expect(db.listChecklistItems()[1].done).toBe(false);
  db.close();
});

test('PATCH rejects invalid IDs, unsupported fields, and incorrect field types without mutation', async () => {
  await seedChecklist();
  const route = await import('../src/app/api/checklist/[id]/route');

  const badId = await route.PATCH(patchRequest('not-a-number', { done: true }), {
    params: Promise.resolve({ id: 'not-a-number' }),
  });
  const unsupported = await route.PATCH(patchRequest('1', { done: true, extra: 'ignored' }), {
    params: Promise.resolve({ id: '1' }),
  });
  const badType = await route.PATCH(patchRequest('1', { done: 'true' }), {
    params: Promise.resolve({ id: '1' }),
  });
  const empty = await route.PATCH(patchRequest('1', {}), {
    params: Promise.resolve({ id: '1' }),
  });

  expect([badId.status, unsupported.status, badType.status, empty.status]).toEqual([400, 400, 400, 400]);
  const { createAppDatabase } = await import('../src/lib/database');
  const db = createAppDatabase();
  expect(db.listChecklistItems()[0].done).toBe(false);
  db.close();
});

test('checklist state stays out of the general app-state response', async () => {
  const route = await import('../src/app/api/state/route');
  const response = await route.GET(new NextRequest('http://localhost/api/state'));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).not.toHaveProperty('checklist');
});
