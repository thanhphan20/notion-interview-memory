import type { Migration } from '../lib/migrate';

const migration: Migration = {
  id: 2,
  description: 'Create mcq_questions table for AI-generated multiple choice questions',
  up(): string {
    return `
      CREATE TABLE IF NOT EXISTS mcq_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `;
  },
};

export default migration;
