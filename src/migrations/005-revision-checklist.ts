import type { Migration } from '../lib/migrate';

const migration: Migration = {
  id: 5,
  description: 'Create local revision checklist storage',
  sql: `
      CREATE TABLE IF NOT EXISTS checklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_key TEXT NOT NULL UNIQUE,
        part_key TEXT NOT NULL,
        part_title TEXT NOT NULL,
        section_title TEXT NOT NULL,
        category TEXT,
        ordinal INTEGER NOT NULL,
        source_text TEXT NOT NULL,
        source_status TEXT,
        claim_flags_json TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
        takeaway TEXT NOT NULL DEFAULT '',
        imported_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_checklist_items_active_order
      ON checklist_items (archived_at, part_key, ordinal);
  `,
};

export default migration;
