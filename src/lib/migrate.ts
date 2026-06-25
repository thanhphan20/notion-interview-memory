import type { Database } from 'bun:sqlite';
import m001 from '../migrations/001-initial';
import m002 from '../migrations/002-mcq-questions';

export interface Migration {
  id: number;
  description: string;
  up(): string;
}

const migrations: Migration[] = [m001, m002];

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: number }[]).map((r) => r.id)
  );

  for (const migration of migrations.sort((a, b) => a.id - b.id)) {
    if (applied.has(migration.id)) continue;

    const sql = migration.up();
    db.run(sql);

    db.prepare('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
      migration.id,
      migration.description,
      new Date().toISOString()
    );
  }
}
