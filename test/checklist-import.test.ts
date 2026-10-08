import { expect, test } from 'bun:test';
import { createAppDatabase } from '../src/lib/database';
import { parseChecklist } from '../src/lib/checklist';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importChecklistFile, resolveChecklistPath } from '../scripts/import-checklist';

function source(items: string): string {
  return `# PART 1 — Fundamentals\n## Java Core\n${items}\n`;
}

test('migration creates checklist storage and active-order index', () => {
  const db = createAppDatabase(':memory:');
  try {
    const table = db.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'checklist_items'").get();
    const index = db.db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_checklist_items_active_order'").get();

    expect(table).toBeDefined();
    expect(index).toBeDefined();
  } finally {
    db.close();
  }
});

test('import is idempotent and new checklist rows start unchecked', () => {
  const db = createAppDatabase(':memory:');
  try {
    const items = parseChecklist(source('- HashMap internals\n- Generics'));
    const first = db.importChecklistItems(items);
    const second = db.importChecklistItems(items);

    expect(first.countsByPart).toEqual({ 'part-1': 2 });
    expect(second.countsByPart).toEqual({ 'part-1': 2 });
    expect(db.listChecklistItems()).toHaveLength(2);
    expect(db.listChecklistItems().map(({ done, takeaway }) => [done, takeaway])).toEqual([
      [false, ''],
      [false, ''],
    ]);
  } finally {
    db.close();
  }
});

test('re-import updates source metadata while preserving completion and takeaway', () => {
  const db = createAppDatabase(':memory:');
  try {
    const original = parseChecklist(source('- HashMap internals'))[0];
    db.importChecklistItems([original]);
    const [stored] = db.listChecklistItems();
    db.updateChecklistItem(stored.id, { done: true, takeaway: 'Hashing chooses a bucket.' });

    const updated = parseChecklist(source('- HashMap internals 🔴'))[0];
    expect(updated.itemKey).toBe(original.itemKey);
    db.importChecklistItems([updated]);

    expect(db.listChecklistItems()[0]).toMatchObject({
      sourceStatus: '🔴',
      done: true,
      takeaway: 'Hashing chooses a bucket.',
    });
  } finally {
    db.close();
  }
});

test('removed checklist rows archive and reappearing rows recover user state', () => {
  const db = createAppDatabase(':memory:');
  try {
    const [first, second] = parseChecklist(source('- HashMap internals\n- Generics'));
    const imported = db.importChecklistItems([first, second]);
    const firstId = db.listChecklistItems()[0].id;
    db.updateChecklistItem(firstId, { done: true, takeaway: 'HashMap stores key/value pairs.' });

    db.importChecklistItems([second]);
    expect(db.listChecklistItems().map((item) => item.itemKey)).toEqual([second.itemKey]);
    const archived = db.db.prepare('SELECT archived_at FROM checklist_items WHERE item_key = ?').get(first.itemKey) as { archived_at: string | null };
    expect(archived.archived_at).not.toBeNull();

    db.importChecklistItems([first, second]);
    const restored = db.listChecklistItems().find((item) => item.itemKey === first.itemKey);
    expect(restored).toMatchObject({ id: firstId, done: true, takeaway: 'HashMap stores key/value pairs.', archivedAt: null });
    expect(imported.countsByPart).toEqual({ 'part-1': 2 });
  } finally {
    db.close();
  }
});

test('invalid and empty imports leave the active checklist unchanged', () => {
  const db = createAppDatabase(':memory:');
  try {
    const [existing] = parseChecklist(source('- Existing item'));
    db.importChecklistItems([existing]);

    const [valid, malformed] = parseChecklist(source('- New item\n- Malformed item'));
    Reflect.set(malformed, 'partKey', null);
    expect(() => db.importChecklistItems([valid, malformed])).toThrow();
    expect(() => db.importChecklistItems([])).toThrow();

    expect(db.listChecklistItems().map((item) => item.itemKey)).toEqual([existing.itemKey]);
  } finally {
    db.close();
  }
});

test('resolveChecklistPath prefers argument, then env value, then sibling default', () => {
  expect(resolveChecklistPath('explicit.md', 'env.md')).toBe(path.resolve('explicit.md'));
  expect(resolveChecklistPath(undefined, 'env.md')).toBe(path.resolve('env.md'));
  expect(resolveChecklistPath(undefined, undefined)).toBe(
    path.resolve(process.cwd(), '../career-ops/interview-prep/revision-checklist.md')
  );
});

test('importChecklistFile reads an explicit markdown file into the supplied database', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'revision-checklist-'));
  const file = path.join(directory, 'checklist.md');
  const db = createAppDatabase(':memory:');
  try {
    writeFileSync(file, source('- HashMap internals'), 'utf8');

    const result = importChecklistFile(file, db);

    expect(result.countsByPart).toEqual({ 'part-1': 1 });
    expect(db.listChecklistItems()[0].sourceText).toBe('HashMap internals');
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('importChecklistFile rejects missing or empty sources before changing database state', () => {
  const db = createAppDatabase(':memory:');
  const directory = mkdtempSync(path.join(tmpdir(), 'revision-checklist-'));
  const emptyFile = path.join(directory, 'empty.md');
  try {
    const [existing] = parseChecklist(source('- Existing item'));
    db.importChecklistItems([existing]);
    writeFileSync(emptyFile, '# Not a checklist', 'utf8');

    expect(() => importChecklistFile(path.join(directory, 'missing.md'), db)).toThrow(/not found/i);
    expect(() => importChecklistFile(emptyFile, db)).toThrow(/no checklist items/i);
    expect(db.listChecklistItems().map((item) => item.itemKey)).toEqual([existing.itemKey]);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
