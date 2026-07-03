import type { Migration } from '../lib/migrate';

const migration: Migration = {
  id: 4,
  description: 'Create sprints and mcq_diagnostics tables for cramming-workflow-v2 sessions',
  up(): string {
    return `
      CREATE TABLE IF NOT EXISTS sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        card_ids_json TEXT NOT NULL,
        mcq_ids_json TEXT NOT NULL,
        score INTEGER,
        tag_breakdown_json TEXT
      );

      CREATE TABLE IF NOT EXISTS mcq_diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        mcq_ids_json TEXT NOT NULL,
        score INTEGER,
        weakness_report_json TEXT
      );
    `;
  },
};

export default migration;
