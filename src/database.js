const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createInitialSchedule, getDueCards, gradeReview } = require('./scheduler');

function createAppDatabase(filename = defaultDatabasePath()) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys = ON');
  migrate(sqlite);
  return new AppDatabase(sqlite);
}

function defaultDatabasePath() {
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  return path.join(dataDir, 'app.sqlite');
}

function migrate(db) {
  db.exec(`
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
  `);
}

class AppDatabase {
  constructor(db) {
    this.db = db;
  }

  close() {
    this.db.close();
  }

  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : undefined;
  }

  setSetting(key, value) {
    this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  }

  upsertNote(note) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO notes (notion_page_id, title, content, source_url, tags_json, notion_last_edited_time, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(notion_page_id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        source_url = excluded.source_url,
        tags_json = excluded.tags_json,
        notion_last_edited_time = excluded.notion_last_edited_time,
        synced_at = excluded.synced_at
    `).run(
      note.notionPageId,
      note.title,
      note.content,
      note.sourceUrl || '',
      JSON.stringify(note.tags || []),
      note.notionLastEditedTime || now,
      now
    );
    return this.getNoteByNotionPageId(note.notionPageId);
  }

  getNoteByNotionPageId(notionPageId) {
    const row = this.db.prepare('SELECT * FROM notes WHERE notion_page_id = ?').get(notionPageId);
    return row ? mapNote(row) : undefined;
  }

  getNote(id) {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    return row ? mapNote(row) : undefined;
  }

  listNotes() {
    return this.db.prepare('SELECT * FROM notes ORDER BY synced_at DESC, id DESC').all().map(mapNote);
  }

  createDrafts(noteId, drafts) {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO card_drafts (note_id, question, expected_answer, rubric_json, tags_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?)
    `);
    const created = [];
    this.withTransaction(() => {
      for (const draft of drafts) {
        const result = insert.run(
          noteId,
          draft.question,
          draft.expectedAnswer,
          JSON.stringify(draft.rubric || []),
          JSON.stringify(draft.tags || []),
          now
        );
        created.push(this.getDraft(Number(result.lastInsertRowid)));
      }
    });
    return created;
  }

  getDraft(id) {
    const row = this.db.prepare('SELECT * FROM card_drafts WHERE id = ?').get(id);
    return row ? mapDraft(row) : undefined;
  }

  listDrafts(status = 'draft') {
    return this.db.prepare('SELECT * FROM card_drafts WHERE status = ? ORDER BY created_at DESC, id DESC')
      .all(status)
      .map(mapDraft);
  }

  approveDraft(draftId, now = new Date()) {
    const draft = this.getDraft(draftId);
    if (!draft) throw new Error(`Draft not found: ${draftId}`);
    if (draft.status !== 'draft') throw new Error('Draft is already handled.');

    let card;
    this.withTransaction(() => {
      const result = this.db.prepare(`
        INSERT INTO cards (note_id, source_draft_id, question, expected_answer, rubric_json, tags_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        draft.noteId,
        draft.id,
        draft.question,
        draft.expectedAnswer,
        JSON.stringify(draft.rubric),
        JSON.stringify(draft.tags),
        now.toISOString()
      );
      this.db.prepare('UPDATE card_drafts SET status = ? WHERE id = ?').run('approved', draft.id);
      card = this.getCard(Number(result.lastInsertRowid));
      this.saveSchedule(createInitialSchedule({ cardId: card.id, now }));
    });
    return card;
  }

  rejectDraft(draftId) {
    const draft = this.getDraft(draftId);
    if (!draft) throw new Error(`Draft not found: ${draftId}`);
    if (draft.status !== 'draft') throw new Error('Draft is already handled.');
    this.db.prepare('UPDATE card_drafts SET status = ? WHERE id = ?').run('rejected', draftId);
    return this.getDraft(draftId);
  }

  getCard(id) {
    const row = this.db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
    return row ? mapCard(row) : undefined;
  }

  listCards() {
    return this.db.prepare('SELECT * FROM cards ORDER BY created_at DESC, id DESC').all().map(mapCard);
  }

  getSchedule(cardId) {
    const row = this.db.prepare('SELECT * FROM schedules WHERE card_id = ?').get(cardId);
    return row ? mapSchedule(row) : undefined;
  }

  saveSchedule(schedule) {
    this.db.prepare(`
      INSERT INTO schedules (
        card_id, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_reviewed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        due_at = excluded.due_at,
        stability = excluded.stability,
        difficulty = excluded.difficulty,
        elapsed_days = excluded.elapsed_days,
        scheduled_days = excluded.scheduled_days,
        reps = excluded.reps,
        lapses = excluded.lapses,
        state = excluded.state,
        last_reviewed_at = excluded.last_reviewed_at
    `).run(
      schedule.cardId,
      schedule.dueAt,
      schedule.stability,
      schedule.difficulty,
      schedule.elapsedDays,
      schedule.scheduledDays,
      schedule.reps,
      schedule.lapses,
      schedule.state,
      schedule.lastReviewedAt
    );
  }

  listDueCards(now = new Date()) {
    const rows = this.db.prepare(`
      SELECT
        cards.*,
        notes.title AS note_title,
        notes.source_url AS source_url,
        schedules.due_at,
        schedules.stability,
        schedules.difficulty,
        schedules.elapsed_days,
        schedules.scheduled_days,
        schedules.reps,
        schedules.lapses,
        schedules.state,
        schedules.last_reviewed_at
      FROM schedules
      JOIN cards ON cards.id = schedules.card_id
      JOIN notes ON notes.id = cards.note_id
      ORDER BY schedules.due_at ASC
    `).all();

    return getDueCards(rows.map((row) => ({
      ...mapCard(row),
      noteTitle: row.note_title,
      sourceUrl: row.source_url,
      schedule: mapSchedule(row),
      cardId: row.id,
      dueAt: row.due_at
    })), now);
  }

  recordReview({ cardId, userAnswer, aiFeedback, rating, elapsedSeconds = 0, reviewedAt = new Date() }) {
    const card = this.getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    const schedule = this.getSchedule(cardId);
    if (!schedule) throw new Error(`Schedule not found for card: ${cardId}`);
    const reviewedDate = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
    const nextSchedule = gradeReview(schedule, rating, reviewedDate);

    let review;
    this.withTransaction(() => {
      const result = this.db.prepare(`
        INSERT INTO reviews (card_id, user_answer, ai_feedback_json, rating, elapsed_seconds, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        cardId,
        userAnswer,
        aiFeedback ? JSON.stringify(aiFeedback) : null,
        rating,
        elapsedSeconds,
        reviewedDate.toISOString()
      );
      this.saveSchedule(nextSchedule);
      review = this.getReview(Number(result.lastInsertRowid));
    });
    return review;
  }

  getReview(id) {
    const row = this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    return row ? mapReview(row) : undefined;
  }

  listReviews() {
    return this.db.prepare('SELECT * FROM reviews ORDER BY reviewed_at DESC, id DESC').all().map(mapReview);
  }

  stats(now = new Date()) {
    const totalNotes = this.db.prepare('SELECT COUNT(*) AS count FROM notes').get().count;
    const draftCount = this.db.prepare("SELECT COUNT(*) AS count FROM card_drafts WHERE status = 'draft'").get().count;
    const cardCount = this.db.prepare('SELECT COUNT(*) AS count FROM cards').get().count;
    const reviewCount = this.db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;
    const dueCount = this.listDueCards(now).length;
    return { totalNotes, draftCount, cardCount, reviewCount, dueCount };
  }

  withTransaction(fn) {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

function mapNote(row) {
  return {
    id: row.id,
    notionPageId: row.notion_page_id,
    title: row.title,
    content: row.content,
    sourceUrl: row.source_url,
    tags: JSON.parse(row.tags_json),
    notionLastEditedTime: row.notion_last_edited_time,
    syncedAt: row.synced_at
  };
}

function mapDraft(row) {
  return {
    id: row.id,
    noteId: row.note_id,
    question: row.question,
    expectedAnswer: row.expected_answer,
    rubric: JSON.parse(row.rubric_json),
    tags: JSON.parse(row.tags_json),
    status: row.status,
    createdAt: row.created_at
  };
}

function mapCard(row) {
  return {
    id: row.id,
    noteId: row.note_id,
    sourceDraftId: row.source_draft_id,
    question: row.question,
    expectedAnswer: row.expected_answer,
    rubric: JSON.parse(row.rubric_json),
    tags: JSON.parse(row.tags_json),
    createdAt: row.created_at
  };
}

function mapSchedule(row) {
  return {
    cardId: row.card_id,
    dueAt: row.due_at,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsed_days,
    scheduledDays: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReviewedAt: row.last_reviewed_at
  };
}

function mapReview(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    userAnswer: row.user_answer,
    aiFeedback: row.ai_feedback_json ? JSON.parse(row.ai_feedback_json) : null,
    rating: row.rating,
    elapsedSeconds: row.elapsed_seconds,
    reviewedAt: row.reviewed_at
  };
}

module.exports = {
  createAppDatabase
};
