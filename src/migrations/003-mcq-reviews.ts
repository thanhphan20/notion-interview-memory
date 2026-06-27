import type { Migration } from '../lib/migrate';

const migration: Migration = {
  id: 3,
  description: 'Create mcq_reviews table to track user answers to MCQs for history',
  up(): string {
    return `
      CREATE TABLE IF NOT EXISTS mcq_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mcq_id INTEGER NOT NULL REFERENCES mcq_questions(id) ON DELETE CASCADE,
        selected_index INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        reviewed_at TEXT NOT NULL
      );
    `;
  },
};

export default migration;
