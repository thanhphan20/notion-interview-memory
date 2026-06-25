import type { Migration } from '../lib/migrate';

const migration: Migration = {
  id: 1,
  description: 'Create initial schema: settings, notes, card_drafts, cards, schedules, reviews',
  up(): string {
    return `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notion_page_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_url TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        notion_last_edited_time TEXT NOT NULL,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS card_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        rubric_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        source_draft_id INTEGER UNIQUE REFERENCES card_drafts(id),
        question TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        rubric_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schedules (
        card_id INTEGER PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
        due_at TEXT NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        elapsed_days INTEGER NOT NULL,
        scheduled_days INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        state TEXT NOT NULL,
        last_reviewed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        user_answer TEXT NOT NULL,
        ai_feedback_json TEXT,
        rating TEXT NOT NULL,
        elapsed_seconds INTEGER NOT NULL,
        reviewed_at TEXT NOT NULL
      );
    `;
  },
};

export default migration;
