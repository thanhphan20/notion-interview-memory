import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { createInitialSchedule, getDueCards, gradeReview } from './scheduler';
import type { Schedule } from './scheduler';
import type { CardDraft, MCQ } from './ai';
import type { NotionNote } from './notion';

export interface Note {
  id: number;
  notionPageId: string;
  title: string;
  content: string;
  sourceUrl: string;
  tags: string[];
  notionLastEditedTime: string;
  syncedAt: string;
}

export interface Draft {
  id: number;
  noteId: number;
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
  status: string;
  createdAt: string;
}

export interface Card {
  id: number;
  noteId: number;
  sourceDraftId: number | null;
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
  createdAt: string;
}

export interface Review {
  id: number;
  cardId: number;
  userAnswer: string;
  aiFeedback: any;
  rating: string;
  elapsedSeconds: number;
  reviewedAt: string;
}

export interface MCQQuestion {
  id: number;
  noteId: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
  createdAt: string;
}

export interface DbStats {
  totalNotes: number;
  draftCount: number;
  cardCount: number;
  reviewCount: number;
  dueCount: number;
}

export function createAppDatabase(filename: string = defaultDatabasePath()): AppDatabase {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const sqlite = new Database(filename);
  sqlite.run('PRAGMA foreign_keys = ON');
  migrate(sqlite);
  return new AppDatabase(sqlite);
}

function defaultDatabasePath(): string {
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  return path.join(dataDir, 'app.sqlite');
}

function migrate(db: Database): void {
  db.run(`
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
  `);
}

export class AppDatabase {
  db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  close(): void {
    this.db.close();
  }

  getSetting<T>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  }

  setSetting<T>(key: string, value: T): void {
    this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  }

  upsertNote(note: NotionNote | { notionPageId: string; title: string; content: string; sourceUrl?: string; tags?: string[]; notionLastEditedTime?: string }): Note {
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
    return this.getNoteByNotionPageId(note.notionPageId)!;
  }

  getNoteByNotionPageId(notionPageId: string): Note | undefined {
    const row = this.db.prepare('SELECT * FROM notes WHERE notion_page_id = ?').get(notionPageId) as any;
    return row ? mapNote(row) : undefined;
  }

  getNote(id: number): Note | undefined {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    return row ? mapNote(row) : undefined;
  }

  listNotes(): Note[] {
    return (this.db.prepare('SELECT * FROM notes ORDER BY synced_at DESC, id DESC').all() as any[]).map(mapNote);
  }

  createDrafts(noteId: number, drafts: CardDraft[]): Draft[] {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO card_drafts (note_id, question, expected_answer, rubric_json, tags_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?)
    `);
    const created: Draft[] = [];
    this.withTransaction(() => {
      for (const draft of drafts) {
        const result = insert.run(
          noteId,
          draft.question,
          draft.expectedAnswer,
          JSON.stringify(draft.rubric || []),
          JSON.stringify(draft.tags || []),
          now
        ) as { lastInsertRowid: number };
        created.push(this.getDraft(Number(result.lastInsertRowid))!);
      }
    });
    return created;
  }

  getDraft(id: number): Draft | undefined {
    const row = this.db.prepare('SELECT * FROM card_drafts WHERE id = ?').get(id) as any;
    return row ? mapDraft(row) : undefined;
  }

  listDrafts(status: string = 'draft'): Draft[] {
    return (this.db.prepare('SELECT * FROM card_drafts WHERE status = ? ORDER BY created_at DESC, id DESC')
      .all(status) as any[])
      .map(mapDraft);
  }

  approveDraft(draftId: number, now: Date = new Date()): Card {
    const draft = this.getDraft(draftId);
    if (!draft) throw new Error(`Draft not found: ${draftId}`);
    if (draft.status !== 'draft') throw new Error('Draft is already handled.');

    let card: Card;
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
      ) as { lastInsertRowid: number };
      this.db.prepare('UPDATE card_drafts SET status = ? WHERE id = ?').run('approved', draft.id);
      card = this.getCard(Number(result.lastInsertRowid))!;
      this.saveSchedule(createInitialSchedule({ cardId: card.id, now }));
    });
    return card!;
  }

  rejectDraft(draftId: number): Draft {
    const draft = this.getDraft(draftId);
    if (!draft) throw new Error(`Draft not found: ${draftId}`);
    if (draft.status !== 'draft') throw new Error('Draft is already handled.');
    this.db.prepare('UPDATE card_drafts SET status = ? WHERE id = ?').run('rejected', draftId);
    return this.getDraft(draftId)!;
  }

  getCard(id: number): Card | undefined {
    const row = this.db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as any;
    return row ? mapCard(row) : undefined;
  }

  listCards(): Card[] {
    return (this.db.prepare('SELECT * FROM cards ORDER BY created_at DESC, id DESC').all() as any[]).map(mapCard);
  }

  getSchedule(cardId: number): Schedule | undefined {
    const row = this.db.prepare('SELECT * FROM schedules WHERE card_id = ?').get(cardId) as any;
    return row ? mapSchedule(row) : undefined;
  }

  saveSchedule(schedule: Schedule): void {
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

  listDueCards(now: Date = new Date()): any[] {
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
    `).all() as any[];

    return getDueCards(rows.map((row) => ({
      ...mapCard(row),
      noteTitle: row.note_title,
      sourceUrl: row.source_url,
      schedule: mapSchedule(row),
      cardId: row.id,
      dueAt: row.due_at
    })), now);
  }

  recordReview({ cardId, userAnswer, aiFeedback, rating, elapsedSeconds = 0, reviewedAt = new Date() }: {
    cardId: number;
    userAnswer: string;
    aiFeedback?: any;
    rating: string;
    elapsedSeconds?: number;
    reviewedAt?: Date | string;
  }): Review {
    const card = this.getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    const schedule = this.getSchedule(cardId);
    if (!schedule) throw new Error(`Schedule not found for card: ${cardId}`);
    const reviewedDate = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
    const nextSchedule = gradeReview(schedule, rating, reviewedDate);

    let review: Review;
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
      ) as { lastInsertRowid: number };
      this.saveSchedule(nextSchedule);
      review = this.getReview(Number(result.lastInsertRowid))!;
    });
    return review!;
  }

  getReview(id: number): Review | undefined {
    const row = this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as any;
    return row ? mapReview(row) : undefined;
  }

  listReviews(): Review[] {
    return (this.db.prepare('SELECT * FROM reviews ORDER BY reviewed_at DESC, id DESC').all() as any[]).map(mapReview);
  }

  createMCQs(noteId: number, mcqs: MCQ[]): MCQQuestion[] {
    const now = new Date().toISOString();
    const deleteOld = this.db.prepare('DELETE FROM mcq_questions WHERE note_id = ?');
    const insert = this.db.prepare(`
      INSERT INTO mcq_questions (note_id, question, options_json, correct_index, explanation, tags_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const created: MCQQuestion[] = [];
    this.withTransaction(() => {
      deleteOld.run(noteId);
      for (const mcq of mcqs) {
        const result = insert.run(
          noteId,
          mcq.question,
          JSON.stringify(mcq.options),
          mcq.correctIndex,
          mcq.explanation,
          JSON.stringify(mcq.tags || []),
          now
        ) as { lastInsertRowid: number };
        created.push(this.getMCQ(Number(result.lastInsertRowid))!);
      }
    });
    return created;
  }

  getMCQ(id: number): MCQQuestion | undefined {
    const row = this.db.prepare('SELECT * FROM mcq_questions WHERE id = ?').get(id) as any;
    return row ? mapMCQ(row) : undefined;
  }

  listMCQs(): MCQQuestion[] {
    return (this.db.prepare('SELECT * FROM mcq_questions ORDER BY created_at DESC, id DESC').all() as any[]).map(mapMCQ);
  }

  stats(now: Date = new Date()): DbStats {
    const totalNotes = (this.db.prepare('SELECT COUNT(*) AS count FROM notes').get() as any).count;
    const draftCount = (this.db.prepare("SELECT COUNT(*) AS count FROM card_drafts WHERE status = 'draft'").get() as any).count;
    const cardCount = (this.db.prepare('SELECT COUNT(*) AS count FROM cards').get() as any).count;
    const reviewCount = (this.db.prepare('SELECT COUNT(*) AS count FROM reviews').get() as any).count;
    const dueCount = this.listDueCards(now).length;
    return { totalNotes, draftCount, cardCount, reviewCount, dueCount };
  }

  withTransaction<T>(fn: () => T): T {
    this.db.run('BEGIN');
    try {
      const result = fn();
      this.db.run('COMMIT');
      return result;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }
}

function mapNote(row: any): Note {
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

function mapDraft(row: any): Draft {
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

function mapCard(row: any): Card {
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

function mapSchedule(row: any): Schedule {
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

function mapReview(row: any): Review {
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

function mapMCQ(row: any): MCQQuestion {
  return {
    id: row.id,
    noteId: row.note_id,
    question: row.question,
    options: JSON.parse(row.options_json),
    correctIndex: row.correct_index,
    explanation: row.explanation,
    tags: JSON.parse(row.tags_json),
    createdAt: row.created_at
  };
}
