import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { applyInterviewDateClamp, createInitialSchedule, getDueCards, gradeReview } from './scheduler';
import type { Schedule } from './scheduler';
import type { CardDraft, MCQ } from './ai';
import type { NotionNote } from './notion';
import { runMigrations } from './migrate';

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
  tags?: string[];
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

export interface MCQReview {
  id: number;
  mcqId: number;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  correct: boolean;
  reviewedAt: string;
  tags?: string[];
}

export interface SprintTagBreakdown {
  tag: string;
  score: number;
  total: number;
}

export interface Sprint {
  id: number;
  startedAt: string;
  completedAt: string | null;
  cardIds: number[];
  mcqIds: number[];
  score: number | null;
  tagBreakdown: SprintTagBreakdown[] | null;
}

export interface WeaknessReportEntry {
  tag: string;
  wrongCount: number;
  total: number;
}

export interface MCQDiagnostic {
  id: number;
  startedAt: string;
  completedAt: string | null;
  mcqIds: number[];
  score: number | null;
  weaknessReport: WeaknessReportEntry[] | null;
}

export interface DbStats {
  totalNotes: number;
  draftCount: number;
  cardCount: number;
  reviewCount: number;
  mcqReviewCount: number;
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
  runMigrations(db);
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

  getInterviewDate(): string | null {
    return this.getSetting<string>('interview_date') ?? null;
  }

  setInterviewDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid interview date format: ${date}. Expected YYYY-MM-DD.`);
    }
    this.setSetting('interview_date', date);
  }

  clearInterviewDate(): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run('interview_date');
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

  /** Distinct topic tags across all synced notes, sorted alphabetically. */
  listTopics(): string[] {
    const set = new Set<string>();
    for (const note of this.listNotes()) {
      for (const tag of note.tags) set.add(tag);
    }
    return Array.from(set).sort();
  }

  /** Notes whose tags intersect any of the given topics (OR semantics). */
  listNotesByTopics(topics: string[]): Note[] {
    const wanted = new Set(topics);
    return this.listNotes().filter((note) => note.tags.some((tag) => wanted.has(tag)));
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
    const gradedSchedule = gradeReview(schedule, rating, reviewedDate);
    const nextSchedule = applyInterviewDateClamp(gradedSchedule, this.getInterviewDate(), reviewedDate);

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
    return (this.db.prepare(`
      SELECT r.*, c.tags_json
      FROM reviews r
      LEFT JOIN cards c ON c.id = r.card_id
      ORDER BY r.reviewed_at DESC, r.id DESC
    `).all() as any[]).map(mapReview);
  }

  recordMCQReview(mcqId: number, selectedIndex: number): MCQReview {
    const mcq = this.getMCQ(mcqId);
    if (!mcq) throw new Error(`MCQ not found: ${mcqId}`);
    const correct = selectedIndex === mcq.correctIndex ? 1 : 0;
    const reviewedAt = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO mcq_reviews (mcq_id, selected_index, correct, reviewed_at)
      VALUES (?, ?, ?, ?)
    `).run(mcqId, selectedIndex, correct, reviewedAt) as { lastInsertRowid: number };
    return mapMCQReview({ id: Number(result.lastInsertRowid), mcq_id: mcqId, selected_index: selectedIndex, correct, reviewed_at: reviewedAt }, mcq);
  }

  listMCQReviews(): MCQReview[] {
    const rows = this.db.prepare(`
      SELECT r.id, r.mcq_id, r.selected_index, r.correct, r.reviewed_at,
             q.question, q.options_json, q.correct_index, q.tags_json
      FROM mcq_reviews r
      JOIN mcq_questions q ON q.id = r.mcq_id
      ORDER BY r.reviewed_at DESC, r.id DESC
    `).all() as any[];
    return rows.map(mapMCQReviewRow);
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

  /** Inserts new MCQs for a note without touching any existing ones (used when generating "more" MCQs). */
  appendMCQs(noteId: number, mcqs: MCQ[]): MCQQuestion[] {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO mcq_questions (note_id, question, options_json, correct_index, explanation, tags_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const created: MCQQuestion[] = [];
    this.withTransaction(() => {
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

  listMCQsForNote(noteId: number): MCQQuestion[] {
    return (this.db.prepare('SELECT * FROM mcq_questions WHERE note_id = ? ORDER BY created_at DESC, id DESC')
      .all(noteId) as any[]).map(mapMCQ);
  }

  createSprint(cardIds: number[], mcqIds: number[]): Sprint {
    const startedAt = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO sprints (started_at, card_ids_json, mcq_ids_json)
      VALUES (?, ?, ?)
    `).run(startedAt, JSON.stringify(cardIds), JSON.stringify(mcqIds)) as { lastInsertRowid: number };
    return this.getSprint(Number(result.lastInsertRowid))!;
  }

  completeSprint(id: number, score: number, tagBreakdown: SprintTagBreakdown[]): Sprint {
    const completedAt = new Date().toISOString();
    this.db.prepare(`
      UPDATE sprints
      SET completed_at = ?, score = ?, tag_breakdown_json = ?
      WHERE id = ?
    `).run(completedAt, score, JSON.stringify(tagBreakdown), id);
    return this.getSprint(id)!;
  }

  getSprint(id: number): Sprint | undefined {
    const row = this.db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as any;
    return row ? mapSprint(row) : undefined;
  }

  listSprints(limit: number = 10): Sprint[] {
    return (this.db.prepare(`
      SELECT * FROM sprints
      WHERE completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC
      LIMIT ?
    `).all(limit) as any[]).map(mapSprint);
  }

  getSprintScoreAverage(limit: number = 10): { average: number | null; count: number } {
    const sprints = this.listSprints(limit);
    if (sprints.length === 0) return { average: null, count: 0 };
    const total = sprints.reduce((sum, s) => sum + (s.score ?? 0), 0);
    return { average: total / sprints.length, count: sprints.length };
  }

  createMCQDiagnostic(mcqIds: number[]): MCQDiagnostic {
    const startedAt = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO mcq_diagnostics (started_at, mcq_ids_json)
      VALUES (?, ?)
    `).run(startedAt, JSON.stringify(mcqIds)) as { lastInsertRowid: number };
    return this.getMCQDiagnostic(Number(result.lastInsertRowid))!;
  }

  completeMCQDiagnostic(id: number, score: number, weaknessReport: WeaknessReportEntry[]): MCQDiagnostic {
    const completedAt = new Date().toISOString();
    this.db.prepare(`
      UPDATE mcq_diagnostics
      SET completed_at = ?, score = ?, weakness_report_json = ?
      WHERE id = ?
    `).run(completedAt, score, JSON.stringify(weaknessReport), id);
    return this.getMCQDiagnostic(id)!;
  }

  getMCQDiagnostic(id: number): MCQDiagnostic | undefined {
    const row = this.db.prepare('SELECT * FROM mcq_diagnostics WHERE id = ?').get(id) as any;
    return row ? mapMCQDiagnostic(row) : undefined;
  }

  listMCQDiagnostics(limit: number = 10): MCQDiagnostic[] {
    return (this.db.prepare(`
      SELECT * FROM mcq_diagnostics
      WHERE completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC
      LIMIT ?
    `).all(limit) as any[]).map(mapMCQDiagnostic);
  }

  stats(now: Date = new Date()): DbStats {
    const totalNotes = (this.db.prepare('SELECT COUNT(*) AS count FROM notes').get() as any).count;
    const draftCount = (this.db.prepare("SELECT COUNT(*) AS count FROM card_drafts WHERE status = 'draft'").get() as any).count;
    const cardCount = (this.db.prepare('SELECT COUNT(*) AS count FROM cards').get() as any).count;
    const reviewCount = (this.db.prepare('SELECT COUNT(*) AS count FROM reviews').get() as any).count;
    const mcqReviewCount = (this.db.prepare('SELECT COUNT(*) AS count FROM mcq_reviews').get() as any).count;
    const dueCount = this.listDueCards(now).length;
    return { totalNotes, draftCount, cardCount, reviewCount, mcqReviewCount, dueCount };
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
    reviewedAt: row.reviewed_at,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
  };
}

function mapMCQReview(row: any, mcq: MCQQuestion): MCQReview {
  return {
    id: row.id,
    mcqId: row.mcq_id,
    question: mcq.question,
    options: mcq.options,
    correctIndex: mcq.correctIndex,
    selectedIndex: row.selected_index,
    correct: row.correct === 1,
    reviewedAt: row.reviewed_at,
  };
}

function mapMCQReviewRow(row: any): MCQReview {
  return {
    id: row.id,
    mcqId: row.mcq_id,
    question: row.question,
    options: JSON.parse(row.options_json),
    correctIndex: row.correct_index,
    selectedIndex: row.selected_index,
    correct: row.correct === 1,
    reviewedAt: row.reviewed_at,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
  };
}

function mapSprint(row: any): Sprint {
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    cardIds: JSON.parse(row.card_ids_json),
    mcqIds: JSON.parse(row.mcq_ids_json),
    score: row.score ?? null,
    tagBreakdown: row.tag_breakdown_json ? JSON.parse(row.tag_breakdown_json) : null,
  };
}

function mapMCQDiagnostic(row: any): MCQDiagnostic {
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    mcqIds: JSON.parse(row.mcq_ids_json),
    score: row.score ?? null,
    weaknessReport: row.weakness_report_json ? JSON.parse(row.weakness_report_json) : null,
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
