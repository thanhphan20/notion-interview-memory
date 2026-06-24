# Next.js and Bun Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Notion Interview Memory app to Next.js for the frontend and Bun for the runtime and testing.

**Architecture:** The core spaced-repetition scheduling, Notion sync, and AI generation logic are moved to a modern TypeScript ES modules library in `src/lib/`. The database layer is ported to use `bun:sqlite`'s `Database` instead of `node:sqlite`. Next.js App Router routes handle requests under `src/app/api/` and a React component handles the SPA frontend under `src/app/page.tsx`. All tests are migrated to Bun's native test runner.

**Tech Stack:** Next.js (App Router), React, Bun Runtime, `bun:sqlite`, Bun Test, TypeScript.

---

### Task 1: Project Setup (Bun + Next.js)

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`

- [ ] **Step 1: Update package.json scripts and dependencies**

Modify `package.json` to configure Next.js and Bun.

```json
{
  "name": "notion-interview-memory",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "bun test"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "20.12.12",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "typescript": "5.4.5"
  }
}
```

- [ ] **Step 2: Create next.config.mjs**

Write Next.js configuration in `next.config.mjs`.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 3: Create tsconfig.json**

Write `tsconfig.json` optimized for Next.js App Router.

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Clean up old Node.js entrypoints**

Run the following commands to delete outdated Node.js files:
```powershell
Remove-Item -LiteralPath src/server.ts, src/http.ts -ErrorAction SilentlyContinue
```
---

### Task 2: Migrate Core Business Logic to ESM (`src/lib/`)

**Files:**
- Create: `src/lib/scheduler.ts`
- Create: `src/lib/ai.ts`
- Create: `src/lib/notion.ts`
- Create: `src/lib/database.ts`

- [ ] **Step 1: Create src/lib/scheduler.ts**

Implement scheduler scheduling logic in ESM.

```typescript
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type ScheduleState = 'new' | 'review';

export interface Schedule {
  cardId: number;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: ScheduleState;
  lastReviewedAt: string | null;
}

const VALID_RATINGS = new Set<string>(['again', 'hard', 'good', 'easy']);

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function createInitialSchedule({ cardId, now = new Date() }: { cardId: number; now?: Date }): Schedule {
  return {
    cardId,
    dueAt: toIso(now),
    stability: 0.4,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReviewedAt: null,
  };
}

export function getDueCards<T extends { dueAt: string }>(schedules: T[], now: Date = new Date()): T[] {
  const cutoff = now.getTime();
  return schedules
    .filter((schedule) => new Date(schedule.dueAt).getTime() <= cutoff)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function gradeReview(schedule: Schedule, rating: string, reviewedAt: Date | string = new Date()): Schedule {
  if (!VALID_RATINGS.has(rating)) {
    throw new Error(`Unknown review rating: ${rating}`);
  }

  const reviewDate = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  const previousReview = schedule.lastReviewedAt ? new Date(schedule.lastReviewedAt) : reviewDate;
  const elapsedDays = Math.max(0, Math.floor((reviewDate.getTime() - previousReview.getTime()) / 86400000));
  const reps = schedule.reps + 1;
  let lapses = schedule.lapses;
  let stability = Number(schedule.stability) || 0.4;
  let difficulty = Number(schedule.difficulty) || 5;
  let scheduledDays = 0;
  let dueAt: Date;

  if (rating === 'again') {
    lapses += 1;
    difficulty = Math.min(10, difficulty + 0.8);
    stability = Math.max(0.2, stability * 0.45);
    scheduledDays = 0;
    dueAt = addMinutes(reviewDate, 5);
  } else {
    const growth = rating === 'hard' ? 1.4 : rating === 'good' ? 2.5 : 3.6;
    const firstInterval = rating === 'hard' ? 1 : rating === 'good' ? 1 : 3;
    difficulty = Math.max(1, difficulty + (rating === 'hard' ? 0.25 : rating === 'good' ? -0.15 : -0.35));
    stability = Math.max(firstInterval, stability * growth + elapsedDays * 0.15);
    scheduledDays = reps === 1 ? firstInterval : Math.max(firstInterval, Math.round(stability));
    dueAt = addDays(reviewDate, scheduledDays);
  }

  return {
    ...schedule,
    dueAt: dueAt.toISOString(),
    stability: round(stability),
    difficulty: round(difficulty),
    elapsedDays,
    scheduledDays,
    reps,
    lapses,
    state: 'review',
    lastReviewedAt: reviewDate.toISOString(),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
```

- [ ] **Step 2: Create src/lib/ai.ts**

Write AI card generator and critiquer in ESM.

```typescript
export interface CardDraft {
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
}

export interface AnswerCritique {
  summary: string;
  missingKeyPoints: string[];
  suggestedRating: string;
}

export interface NoteInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface CritiqueInput {
  card: { rubric?: string[]; [key: string]: any };
  answer: string;
}

export interface AiProvider {
  generateCards(note: NoteInput): Promise<CardDraft[]>;
  critiqueAnswer(input: CritiqueInput): Promise<AnswerCritique>;
}

export interface AiConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

function parseJsonObject(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`AI provider returned invalid JSON: ${(error as Error).message}`);
  }
}

function normalizeStringList(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function parseCardDrafts(raw: string | any): CardDraft[] {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) {
    throw new Error('AI provider output must include a cards array.');
  }

  return cards.map((card: any) => {
    const draft: CardDraft = {
      question: typeof card.question === 'string' ? card.question.trim() : '',
      expectedAnswer: typeof card.expectedAnswer === 'string' ? card.expectedAnswer.trim() : '',
      rubric: normalizeStringList(card.rubric),
      tags: normalizeStringList(card.tags),
    };

    if (!draft.question || !draft.expectedAnswer || draft.rubric.length === 0) {
      throw new Error('AI provider returned an invalid card draft.');
    }

    return draft;
  });
}

export function parseAnswerCritique(raw: string | any): AnswerCritique {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const suggestedRating = ['again', 'hard', 'good', 'easy'].includes(parsed.suggestedRating)
    ? parsed.suggestedRating
    : 'good';

  return {
    summary: typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'No critique summary returned.',
    missingKeyPoints: normalizeStringList(parsed.missingKeyPoints),
    suggestedRating,
  };
}

export function createAiProvider(config: AiConfig = {}): AiProvider {
  const provider = config.provider || process.env.AI_PROVIDER || 'offline';
  if (provider === 'offline') {
    return createOfflineProvider();
  }
  if (provider === 'openai-compatible') {
    return createOpenAiCompatibleProvider(config);
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

function createOfflineProvider(): AiProvider {
  return {
    async generateCards(note: NoteInput): Promise<CardDraft[]> {
      const tags = Array.isArray(note.tags) ? note.tags : [];
      const summary = firstUsefulSentence(note.content) || note.title;
      return [{
        question: `Explain ${note.title} as you would in an interview.`,
        expectedAnswer: summary,
        rubric: [
          `Defines ${note.title}`,
          'Explains the key tradeoffs or use cases',
          'Uses clear interview-ready language',
        ],
        tags,
      }];
    },
    async critiqueAnswer({ card, answer }: CritiqueInput): Promise<AnswerCritique> {
      const missingKeyPoints = (card.rubric || []).filter((point: string) => {
        return !answer.toLowerCase().includes(String(point).split(' ')[0].toLowerCase());
      }).slice(0, 3);
      return {
        summary: missingKeyPoints.length === 0
          ? 'Your answer covers the main rubric points.'
          : 'Your answer is usable, but it misses some rubric points.',
        missingKeyPoints,
        suggestedRating: missingKeyPoints.length > 1 ? 'hard' : 'good',
      };
    },
  };
}

function firstUsefulSentence(content: string = ''): string | undefined {
  return String(content)
    .split(/\n|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find((part) => part.length > 20);
}

function createOpenAiCompatibleProvider(config: AiConfig = {}): AiProvider {
  const apiKey = config.apiKey || process.env.AI_API_KEY;
  const baseUrl = (config.baseUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = config.model || process.env.AI_MODEL || 'gpt-4.1-mini';

  if (!apiKey) {
    throw new Error('AI_API_KEY is required for openai-compatible provider.');
  }

  async function completeJson(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content || '{}';
  }

  return {
    async generateCards(note: NoteInput): Promise<CardDraft[]> {
      const content = await completeJson([
        { role: 'system', content: 'Create interview-style open-recall study cards. Return JSON with a cards array. Each card needs question, expectedAnswer, rubric array, and tags array.' },
        { role: 'user', content: JSON.stringify(note) },
      ]);
      return parseCardDrafts(content);
    },
    async critiqueAnswer(input: CritiqueInput): Promise<AnswerCritique> {
      const content = await completeJson([
        { role: 'system', content: 'Critique an interview practice answer. Return JSON with summary, missingKeyPoints array, and suggestedRating as again, hard, good, or easy.' },
        { role: 'user', content: JSON.stringify(input) },
      ]);
      return parseAnswerCritique(content);
    },
  };
}
```
- [ ] **Step 3: Create src/lib/notion.ts**

Write Notion synchronization module.

```typescript
export interface NotionNote {
  notionPageId: string;
  title: string;
  content: string;
  sourceUrl: string;
  tags: string[];
  notionLastEditedTime: string;
}

export interface NotionSyncConfig {
  token?: string;
  databaseId?: string;
  topicProperty?: string;
  titleProperty?: string;
  topics?: string[];
}

export interface NotionSyncResult {
  imported: number;
  notes: NotionNote[];
}

interface NotionRichText {
  plain_text?: string;
}

interface NotionBlock {
  type: string;
  [key: string]: any;
}

interface NotionProperty {
  type: string;
  title?: NotionRichText[];
  multi_select?: Array<{ name: string }>;
  select?: { name?: string } | null;
}

interface NotionPage {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, NotionProperty>;
}

interface NotionDatabaseFilter {
  or: Array<{ property: string; multi_select: { contains: string } }>;
}

type FetchFn = typeof fetch;

const NOTION_VERSION = '2022-06-28';

export function buildNotionDatabaseFilter(topicProperty: string, topics: string[]): NotionDatabaseFilter | undefined {
  const selected = (topics || []).map((topic) => String(topic).trim()).filter(Boolean);
  if (!topicProperty || selected.length === 0) {
    return undefined;
  }
  return {
    or: selected.map((topic) => ({
      property: topicProperty,
      multi_select: { contains: topic },
    })),
  };
}

function richTextToPlainText(richText: NotionRichText[] = []): string {
  return richText.map((item) => item.plain_text || '').join('');
}

export function extractPlainText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const type = block.type as string;
    const value = block[type] as Record<string, any> | undefined;
    if (!value) continue;

    const rt = value.rich_text as NotionRichText[] | undefined;

    if (type === 'heading_1') lines.push(`# ${richTextToPlainText(rt)}`);
    else if (type === 'heading_2') lines.push(`## ${richTextToPlainText(rt)}`);
    else if (type === 'heading_3') lines.push(`### ${richTextToPlainText(rt)}`);
    else if (type === 'bulleted_list_item') lines.push(`- ${richTextToPlainText(rt)}`);
    else if (type === 'numbered_list_item') lines.push(`1. ${richTextToPlainText(rt)}`);
    else if (type === 'to_do') lines.push(`- [${(value as Record<string, any>).checked ? 'x' : ' '}] ${richTextToPlainText(rt)}`);
    else if (type === 'code') lines.push(`\`\`\`${(value as Record<string, any>).language || ''}\n${richTextToPlainText(rt)}\n\`\`\``);
    else if (Array.isArray(rt)) lines.push(richTextToPlainText(rt));
  }
  return lines.map((line) => line.trimEnd()).filter(Boolean).join('\n');
}

export function mapNotionPageToNote(page: NotionPage, blocks: NotionBlock[], options: { titleProperty?: string; topicProperty?: string } = {}): NotionNote {
  const titleProperty = options.titleProperty || 'Name';
  const topicProperty = options.topicProperty || 'Topic';
  const title = readTitle(page.properties?.[titleProperty]) || readAnyTitle(page.properties) || 'Untitled note';
  const tags = readTags(page.properties?.[topicProperty]);

  return {
    notionPageId: page.id,
    title,
    content: extractPlainText(blocks),
    sourceUrl: page.url || '',
    tags,
    notionLastEditedTime: page.last_edited_time || '',
  };
}

function readTitle(property: NotionProperty | undefined): string {
  if (!property || property.type !== 'title') return '';
  return richTextToPlainText(property.title).trim();
}

function readAnyTitle(properties: Record<string, NotionProperty> = {}): string {
  for (const property of Object.values(properties)) {
    const title = readTitle(property);
    if (title) return title;
  }
  return '';
}

function readTags(property: NotionProperty | undefined): string[] {
  if (!property) return [];
  if (property.type === 'multi_select') return (property.multi_select || []).map((item) => item.name);
  if (property.type === 'select' && property.select?.name) return [property.select.name];
  return [];
}

export async function syncNotionDatabase(config: NotionSyncConfig, dependencies: { fetch?: FetchFn } = {}): Promise<NotionSyncResult> {
  const fetchImpl = dependencies.fetch || fetch;
  const token = config.token || process.env.NOTION_TOKEN;
  const databaseId = config.databaseId || process.env.NOTION_DATABASE_ID;
  if (!token) throw new Error('NOTION_TOKEN is required.');
  if (!databaseId) throw new Error('NOTION_DATABASE_ID is required.');

  const topicProperty = config.topicProperty || process.env.NOTION_TOPIC_PROPERTY || 'Topic';
  const topics = config.topics || parseCsv(process.env.NOTION_TOPIC_FILTERS || '');
  const filter = buildNotionDatabaseFilter(topicProperty, topics);
  const pages = await queryDatabase(fetchImpl, token, databaseId, filter);
  const notes: NotionNote[] = [];

  for (const page of pages) {
    const blocks = await fetchPageBlocks(fetchImpl, token, page.id);
    notes.push(mapNotionPageToNote(page, blocks, {
      titleProperty: config.titleProperty || 'Name',
      topicProperty,
    }));
  }

  return {
    imported: notes.length,
    notes,
  };
}

async function queryDatabase(fetchImpl: FetchFn, token: string, databaseId: string, filter: NotionDatabaseFilter | undefined): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const response = await fetchImpl(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        ...(filter ? { filter } : {}),
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!response.ok) throw new Error(`Notion database query failed: ${response.status} ${await response.text()}`);
    const payload = await response.json() as { results: NotionPage[]; has_more: boolean; next_cursor?: string };
    pages.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function fetchPageBlocks(fetchImpl: FetchFn, token: string, pageId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const response = await fetchImpl(url, { headers: notionHeaders(token) });
    if (!response.ok) throw new Error(`Notion block query failed: ${response.status} ${await response.text()}`);
    const payload = await response.json() as { results: NotionBlock[]; has_more: boolean; next_cursor?: string };
    blocks.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function notionHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'notion-version': NOTION_VERSION,
    'content-type': 'application/json',
  };
}

function parseCsv(value: string): string[] {
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
}
```
- [ ] **Step 4: Create src/lib/database.ts**

Write the database class utilizing `bun:sqlite`.

```typescript
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { createInitialSchedule, getDueCards, gradeReview } from './scheduler';
import type { Schedule } from './scheduler';
import type { CardDraft } from './ai';
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
```

- [ ] **Step 5: Clean up old TypeScript files**

Delete the root level `src/*.ts` files:
```powershell
Remove-Item -LiteralPath src/ai.ts, src/notion.ts, src/scheduler.ts, src/database.ts -ErrorAction SilentlyContinue
```
---

### Task 3: Implement Next.js API Routes (`src/app/api/`)

**Files:**
- Create: `src/app/api/state/route.ts`
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/api/notion/sync/route.ts`
- Create: `src/app/api/notes/[id]/generate/route.ts`
- Create: `src/app/api/drafts/[id]/approve/route.ts`
- Create: `src/app/api/drafts/[id]/reject/route.ts`
- Create: `src/app/api/cards/[id]/critique/route.ts`
- Create: `src/app/api/cards/[id]/review/route.ts`

- [ ] **Step 1: Create src/app/api/state/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const url = new URL(request.url);
    const now = url.searchParams.get('now') ? new Date(url.searchParams.get('now')!) : new Date();
    const stats = db.stats(now);
    const notes = db.listNotes();
    const drafts = db.listDrafts('draft');
    const cards = db.listCards();
    const dueCards = db.listDueCards(now);
    const reviews = db.listReviews();

    return NextResponse.json({ stats, notes, drafts, cards, dueCards, reviews });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 2: Create src/app/api/settings/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function GET() {
  const db = createAppDatabase();
  try {
    const notion = db.getSetting('notion') || {};
    const ai = db.getSetting('ai') || { provider: 'offline' };
    return NextResponse.json({ notion, ai });
  } finally {
    db.close();
  }
}

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json();
    db.setSetting('notion', body.notion || {});
    db.setSetting('ai', body.ai || { provider: 'offline' });
    return NextResponse.json({ saved: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 3: Create src/app/api/notion/sync/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { syncNotionDatabase } from '@/lib/notion';

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const config = {
      ...(db.getSetting('notion') || {}),
      ...(body || {})
    };
    const result = await syncNotionDatabase(config);
    const notes = result.notes.map((note) => db.upsertNote(note));
    return NextResponse.json({ imported: notes.length, notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Create src/app/api/notes/[id]/generate/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const note = db.getNote(Number(params.id));
    if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const generated = await aiProvider.generateCards(note);
    const drafts = db.createDrafts(note.id, generated);
    return NextResponse.json({ drafts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 5: Create src/app/api/drafts/[id]/approve/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const body = await request.json().catch(() => ({}));
    const now = body.now ? new Date(body.now) : new Date();
    const card = db.approveDraft(Number(params.id), now);
    return NextResponse.json({ card });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 6: Create src/app/api/drafts/[id]/reject/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const draft = db.rejectDraft(Number(params.id));
    return NextResponse.json({ draft });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 7: Create src/app/api/cards/[id]/critique/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';
import { createAiProvider } from '@/lib/ai';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const body = await request.json();
    const card = db.getCard(Number(params.id));
    if (!card) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
    const aiProvider = createAiProvider(db.getSetting('ai') || {});
    const critique = await aiProvider.critiqueAnswer({
      card,
      answer: body.answer || ''
    });
    return NextResponse.json({ critique });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 8: Create src/app/api/cards/[id]/review/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createAppDatabase();
  try {
    const body = await request.json();
    const cardId = Number(params.id);
    const review = db.recordReview({
      cardId,
      userAnswer: body.answer || '',
      aiFeedback: body.aiFeedback || null,
      rating: body.rating,
      elapsedSeconds: Number(body.elapsedSeconds || 0),
      reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : new Date()
    });
    return NextResponse.json({ review, schedule: db.getSchedule(cardId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
```
---

### Task 4: Implement React Frontend Components (`src/app/`)

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create src/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Interview Memory',
  description: 'Notion-powered spaced interview practice',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create src/app/globals.css**

Convert the styles from the old stylesheet `src/static/styles.css`.

```css
:root {
  --bg: #1e1e2e;
  --panel: #252538;
  --text: #cdd6f4;
  --muted: #a6adc8;
  --primary: #cba6f7;
  --primary-hover: #b4befe;
  --danger: #f38ba8;
  --border: #313244;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
}

.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 280px;
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.sidebar h1 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.muted {
  color: var(--muted);
  font-size: 0.875rem;
}

.nav {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav button, button {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text);
  padding: 0.75rem 1rem;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.nav button.active, button:not(.secondary):not(.danger) {
  background: var(--primary);
  color: var(--bg);
  font-weight: 600;
}

button:hover {
  opacity: 0.9;
}

button.secondary {
  border: 1px solid var(--border);
  background: var(--panel);
}

button.danger {
  background: var(--danger);
  color: var(--bg);
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.topbar {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  align-items: center;
}

.metric {
  background: var(--panel);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  text-align: center;
}

.metric span {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.item {
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 1.5rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: var(--border);
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status {
  padding: 1rem;
  background: #a6e3a1;
  color: var(--bg);
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-weight: bold;
}

.status.error {
  background: var(--danger);
}

.work-surface {
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 2rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.answer-panel textarea {
  width: 100%;
  height: 120px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 1rem;
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.feedback {
  background: var(--border);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--primary);
}

.actions {
  display: flex;
  gap: 1rem;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}

.settings-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-grid input, .settings-grid select {
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 1rem;
}
```
- [ ] **Step 3: Create src/app/page.tsx**

Write the complete React app in `src/app/page.tsx`.

```tsx
'use client';

import React, { useState, useEffect } from 'react';

export default function SPA() {
  const [view, setView] = useState<'practice' | 'drafts' | 'notes' | 'history' | 'settings'>('practice');
  const [stats, setStats] = useState({ dueCount: 0, draftCount: 0, reviewCount: 0 });
  const [notes, setNotes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ notion: {}, ai: { provider: 'offline' } });

  const [status, setStatus] = useState<{ message: string; isError?: boolean } | null>(null);

  // Practice state
  const [activeCard, setActiveCard] = useState<any>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [aiCritique, setAiCritique] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadState();
  }, []);

  const triggerStatus = (msg: string, isErr = false) => {
    setStatus({ message: msg, isError: isErr });
    setTimeout(() => setStatus(null), 5000);
  };

  async function api(path: string, options: any = {}) {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Request failed.');
    return payload;
  }

  async function loadSettings() {
    try {
      const data = await api('/api/settings');
      setSettings(data);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }

  async function loadState() {
    try {
      const data = await api('/api/state');
      setStats(data.stats);
      setNotes(data.notes);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);

      if (data.dueCards.length > 0) {
        if (!activeCard) {
          setActiveCard(data.dueCards[0]);
          setActiveStartedAt(Date.now());
        }
      } else {
        setActiveCard(null);
      }
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const target = e.currentTarget as any;
    const body = {
      notion: {
        token: target.token.value.trim(),
        databaseId: target.databaseId.value.trim(),
        titleProperty: target.titleProperty.value.trim() || 'Name',
        topicProperty: target.topicProperty.value.trim() || 'Topic',
        topics: target.topics.value.split(',').map((t: string) => t.trim()).filter(Boolean)
      },
      ai: {
        provider: target.provider.value,
        apiKey: target.apiKey.value.trim(),
        baseUrl: target.baseUrl.value.trim(),
        model: target.model.value.trim()
      }
    };
    try {
      await api('/api/settings', { method: 'POST', body });
      triggerStatus('Settings saved.');
      await loadSettings();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleSyncNotion() {
    triggerStatus('Syncing Notion...');
    try {
      const result = await api('/api/notion/sync', { method: 'POST', body: {} });
      triggerStatus(`Synced ${result.imported} notes.`);
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleGenerateDrafts(noteId: number) {
    triggerStatus('Generating drafts...');
    try {
      const result = await api(`/api/notes/${noteId}/generate`, { method: 'POST', body: {} });
      triggerStatus(`Generated ${result.drafts.length} drafts.`);
      await loadState();
      setView('drafts');
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleApproveDraft(id: number) {
    try {
      await api(`/api/drafts/${id}/approve`, { method: 'POST', body: {} });
      triggerStatus('Draft approved.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleRejectDraft(id: number) {
    try {
      await api(`/api/drafts/${id}/reject`, { method: 'POST', body: {} });
      triggerStatus('Draft rejected.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleRequestCritique() {
    if (!userAnswer.trim()) {
      triggerStatus('Write an answer before requesting critique.', true);
      return;
    }
    try {
      const result = await api(`/api/cards/${activeCard.id}/critique`, {
        method: 'POST',
        body: { answer: userAnswer.trim() }
      });
      setAiCritique(result.critique);
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleSubmitReview(rating: string) {
    if (!userAnswer.trim()) {
      triggerStatus('Write an answer before grading the card.', true);
      return;
    }
    try {
      await api(`/api/cards/${activeCard.id}/review`, {
        method: 'POST',
        body: {
          answer: userAnswer.trim(),
          aiFeedback: aiCritique,
          rating,
          elapsedSeconds: Math.round((Date.now() - (activeStartedAt || Date.now())) / 1000)
        }
      });
      setUserAnswer('');
      setShowAnswerKey(false);
      setAiCritique(null);
      setActiveCard(null);
      setActiveStartedAt(null);
      triggerStatus('Review saved.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <h1>Interview Memory</h1>
          <p className="muted">Notion-powered spaced interview practice</p>
        </div>
        <nav className="nav">
          <button onClick={() => setView('practice')} className={view === 'practice' ? 'active' : ''}>Practice</button>
          <button onClick={() => setView('drafts')} className={view === 'drafts' ? 'active' : ''}>Drafts</button>
          <button onClick={() => setView('notes')} className={view === 'notes' ? 'active' : ''}>Notes</button>
          <button onClick={() => setView('history')} className={view === 'history' ? 'active' : ''}>History</button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'active' : ''}>Settings</button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="metric">
            <span>{stats.dueCount}</span>
            <small>Due</small>
          </div>
          <div className="metric">
            <span>{stats.draftCount}</span>
            <small>Drafts</small>
          </div>
          <div className="metric">
            <span>{stats.reviewCount}</span>
            <small>Reviews</small>
          </div>
          <button onClick={loadState}>Refresh</button>
        </header>

        {status && (
          <section className={`status ${status.isError ? 'error' : ''}`}>
            {status.message}
          </section>
        )}

        {view === 'practice' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Interview Practice</h2>
                <p className="muted">Answer due cards aloud or in writing, then self-grade.</p>
              </div>
            </div>
            <article className="work-surface">
              {activeCard ? (
                <>
                  <h3>{activeCard.question}</h3>
                  <div className="tags">
                    {activeCard.tags.map((tag: string) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                  <div className="answer-panel">
                    <textarea
                      placeholder="Answer as if an interviewer asked you this question."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                    />
                    <div className="actions">
                      <button onClick={handleRequestCritique} className="secondary">AI Critique</button>
                      <button onClick={() => setShowAnswerKey(true)} className="secondary">Show Answer</button>
                    </div>

                    {showAnswerKey && (
                      <div id="answerKey">
                        <h3>Expected Answer</h3>
                        <p>{activeCard.expectedAnswer}</p>
                        <h3>Rubric</h3>
                        <ul className="rubric">
                          {activeCard.rubric.map((point: string, idx: number) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiCritique && (
                      <div className="feedback">
                        <h3>AI Critique</h3>
                        <p>{aiCritique.summary}</p>
                        <p className="muted">Suggested rating: {aiCritique.suggestedRating}</p>
                        {aiCritique.missingKeyPoints.length > 0 && (
                          <ul className="rubric">
                            {aiCritique.missingKeyPoints.map((point: string, idx: number) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="actions" style={{ marginTop: '1.5rem' }}>
                      <button onClick={() => handleSubmitReview('again')} className="danger">Again</button>
                      <button onClick={() => handleSubmitReview('hard')} className="secondary">Hard</button>
                      <button onClick={() => handleSubmitReview('good')}>Good</button>
                      <button onClick={() => handleSubmitReview('easy')}>Easy</button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted">No cards are due. Approve drafts or come back when scheduled cards are ready.</p>
              )}
            </article>
          </section>
        )}

        {view === 'drafts' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Draft Approval</h2>
                <p className="muted">Generated questions only enter review after approval.</p>
              </div>
            </div>
            <div className="stack">
              {drafts.length > 0 ? (
                drafts.map((draft) => (
                  <article key={draft.id} className="item">
                    <h3>{draft.question}</h3>
                    <p>{draft.expectedAnswer}</p>
                    <ul className="rubric">
                      {draft.rubric.map((point: string, idx: number) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                    <div className="tags">
                      {draft.tags.map((tag: string) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="actions">
                      <button onClick={() => handleApproveDraft(draft.id)}>Approve</button>
                      <button onClick={() => handleRejectDraft(draft.id)} className="secondary">Reject</button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No pending drafts.</p>
              )}
            </div>
          </section>
        )}

        {view === 'notes' && (
          <section className="view active">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Notion Notes</h2>
                <p className="muted">Sync selected topics, then generate interview questions.</p>
              </div>
              <button onClick={handleSyncNotion}>Sync Notion</button>
            </div>
            <div className="stack">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <article key={note.id} className="item">
                    <h3>{note.title}</h3>
                    <p className="muted">
                      {note.content.slice(0, 220)}
                      {note.content.length > 220 ? '...' : ''}
                    </p>
                    <div className="tags">
                      {note.tags.map((tag: string) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="actions">
                      <button onClick={() => handleGenerateDrafts(note.id)}>Generate Drafts</button>
                      {note.sourceUrl && (
                        <a href={note.sourceUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'center' }}>Open Notion</a>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No notes synced yet.</p>
              )}
            </div>
          </section>
        )}

        {view === 'history' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Review History</h2>
                <p className="muted">Recent answers, ratings, and feedback.</p>
              </div>
            </div>
            <div className="stack">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <article key={review.id} className="item">
                    <h3>{review.rating.toUpperCase()}</h3>
                    <p>{review.userAnswer}</p>
                    {review.aiFeedback && <p className="muted">AI: {review.aiFeedback.summary}</p>}
                    <p className="muted">{new Date(review.reviewedAt).toLocaleString()}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No reviews yet.</p>
              )}
            </div>
          </section>
        )}

        {view === 'settings' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Settings</h2>
                <p className="muted">Local-only configuration for Notion and AI providers.</p>
              </div>
            </div>
            <form onSubmit={handleSaveSettings} className="settings-grid">
              <label>Notion token <input name="token" type="password" defaultValue={settings.notion?.token || ''} /></label>
              <label>Notion database ID <input name="databaseId" defaultValue={settings.notion?.databaseId || ''} /></label>
              <label>Title property <input name="titleProperty" defaultValue={settings.notion?.titleProperty || 'Name'} /></label>
              <label>Topic property <input name="topicProperty" defaultValue={settings.notion?.topicProperty || 'Topic'} /></label>
              <label>Topic filters <input name="topics" placeholder="System Design,JavaScript" defaultValue={Array.isArray(settings.notion?.topics) ? settings.notion.topics.join(',') : ''} /></label>
              <label>AI provider
                <select name="provider" defaultValue={settings.ai?.provider || 'offline'}>
                  <option value="offline">Offline deterministic</option>
                  <option value="openai-compatible">OpenAI-compatible</option>
                </select>
              </label>
              <label>AI API key <input name="apiKey" type="password" defaultValue={settings.ai?.apiKey || ''} /></label>
              <label>AI base URL <input name="baseUrl" placeholder="https://api.openai.com/v1" defaultValue={settings.ai?.baseUrl || ''} /></label>
              <label>AI model <input name="model" placeholder="gpt-4.1-mini" defaultValue={settings.ai?.model || ''} /></label>
              <button type="submit">Save Settings</button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Delete old static files**

Run commands to clean up the legacy browser assets:
```powershell
Remove-Item -Recurse -Force -LiteralPath src/static -ErrorAction SilentlyContinue
```
---

### Task 5: Migrate Tests to Bun Test (`test/`)

**Files:**
- Modify: `test/scheduler.test.ts`
- Modify: `test/ai.test.ts`
- Modify: `test/notion.test.ts`
- Modify: `test/database.test.ts`
- Modify: `test/api.test.ts`
- Modify: `test/http.test.ts`
- Create: `test/route.test.ts`
- Delete: `test/run.ts`

- [ ] **Step 1: Update test/scheduler.test.ts**

Write scheduler tests in Bun Test.

```typescript
import { test, expect } from 'bun:test';
import { createInitialSchedule, gradeReview, getDueCards } from '../src/lib/scheduler';

test('new approved cards are due immediately', () => {
  const now = new Date('2026-06-24T08:00:00.000Z');
  const schedules = [
    createInitialSchedule({ cardId: 1, now }),
    { ...createInitialSchedule({ cardId: 2, now }), dueAt: '2026-06-25T08:00:00.000Z' }
  ];

  const due = getDueCards(schedules, now);

  expect(due.map((item) => item.cardId)).toEqual([1]);
});

test('again rating keeps a card due soon and records a lapse', () => {
  const now = new Date('2026-06-24T08:00:00.000Z');
  const schedule = createInitialSchedule({ cardId: 7, now });

  const next = gradeReview(schedule, 'again', now);

  expect(next.cardId).toBe(7);
  expect(next.reps).toBe(1);
  expect(next.lapses).toBe(1);
  expect(next.state).toBe('review');
  expect(next.scheduledDays).toBe(0);
  expect(next.dueAt).toBe('2026-06-24T08:05:00.000Z');
});

test('good rating increases review interval after repeated successful reviews', () => {
  const firstReviewAt = new Date('2026-06-24T08:00:00.000Z');
  const first = gradeReview(createInitialSchedule({ cardId: 3, now: firstReviewAt }), 'good', firstReviewAt);

  const secondReviewAt = new Date('2026-06-25T08:00:00.000Z');
  const second = gradeReview(first, 'good', secondReviewAt);

  expect(first.scheduledDays).toBe(1);
  expect(first.dueAt).toBe('2026-06-25T08:00:00.000Z');
  expect(second.scheduledDays).toBeGreaterThan(first.scheduledDays);
  expect(second.reps).toBe(2);
  expect(second.lapses).toBe(0);
});
```

- [ ] **Step 2: Update test/ai.test.ts**

Write AI parsing and offline provider tests in Bun Test.

```typescript
import { test, expect } from 'bun:test';
import { createAiProvider, parseCardDrafts, parseAnswerCritique } from '../src/lib/ai';

test('parseCardDrafts accepts strict JSON card arrays and normalizes tags', () => {
  const raw = JSON.stringify({
    cards: [
      {
        question: 'Explain database indexing tradeoffs.',
        expectedAnswer: 'Indexes speed reads and slow writes.',
        rubric: ['mentions read speed', 'mentions write cost'],
        tags: 'database'
      }
    ]
  });

  const drafts = parseCardDrafts(raw);

  expect(drafts).toEqual([
    {
      question: 'Explain database indexing tradeoffs.',
      expectedAnswer: 'Indexes speed reads and slow writes.',
      rubric: ['mentions read speed', 'mentions write cost'],
      tags: ['database']
    }
  ]);
});

test('parseCardDrafts rejects malformed provider output', () => {
  expect(() => parseCardDrafts('{"cards":[{"question":""}]}')).toThrow(/valid card draft/);
});

test('parseAnswerCritique returns structured feedback with missing key points', () => {
  const critique = parseAnswerCritique(JSON.stringify({
    summary: 'Good high-level answer.',
    missingKeyPoints: ['write amplification'],
    suggestedRating: 'hard'
  }));

  expect(critique).toEqual({
    summary: 'Good high-level answer.',
    missingKeyPoints: ['write amplification'],
    suggestedRating: 'hard'
  });
});

test('createAiProvider supports deterministic offline mode', async () => {
  const provider = createAiProvider({ provider: 'offline' });

  const drafts = await provider.generateCards({
    title: 'CAP theorem',
    content: 'Consistency, availability, and partition tolerance are tradeoffs.',
    tags: ['system-design']
  });

  expect(drafts.length).toBe(1);
  expect(drafts[0].question).toMatch(/CAP theorem/);
  expect(drafts[0].tags[0]).toBe('system-design');
});
```

- [ ] **Step 3: Update test/notion.test.ts**

Write Notion parsing tests in Bun Test.

```typescript
import { test, expect } from 'bun:test';
import { buildNotionDatabaseFilter, extractPlainText, mapNotionPageToNote } from '../src/lib/notion';

test('buildNotionDatabaseFilter creates an OR filter for selected topics', () => {
  const filter = buildNotionDatabaseFilter('Topic', ['System Design', 'JavaScript']);

  expect(filter).toEqual({
    or: [
      { property: 'Topic', multi_select: { contains: 'System Design' } },
      { property: 'Topic', multi_select: { contains: 'JavaScript' } }
    ]
  });
});

test('mapNotionPageToNote extracts title, tags, url, and content', () => {
  const page = {
    id: 'page-1',
    url: 'https://notion.so/page-1',
    last_edited_time: '2026-06-24T09:00:00.000Z',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Load Balancing' }] },
      Topic: { type: 'multi_select', multi_select: [{ name: 'System Design' }] }
    }
  } as any;
  const blocks = [
    { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Layer 4 vs Layer 7.' }] } },
    { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Health checks matter.' }] } }
  ] as any[];

  const note = mapNotionPageToNote(page, blocks, { titleProperty: 'Name', topicProperty: 'Topic' });

  expect(note.notionPageId).toBe('page-1');
  expect(note.title).toBe('Load Balancing');
  expect(note.content).toBe('Layer 4 vs Layer 7.\n- Health checks matter.');
  expect(note.tags).toEqual(['System Design']);
  expect(note.sourceUrl).toBe('https://notion.so/page-1');
});

test('extractPlainText supports common Notion rich text block types', () => {
  const blocks = [
    { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Patterns' }] } },
    { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'Factory' }] } },
    { type: 'code', code: { rich_text: [{ plain_text: 'class Factory {}' }], language: 'typescript' } }
  ] as any[];

  expect(extractPlainText(blocks)).toBe('## Patterns\n1. Factory\n```typescript\nclass Factory {}\n```');
});
```

- [ ] **Step 4: Update test/database.test.ts**

Write database tests targeting `bun:sqlite` in Bun Test.

```typescript
import { test, expect } from 'bun:test';
import { createAppDatabase } from '../src/lib/database';

test('upsertNote keeps one row per Notion page and updates changed content', () => {
  const db = createAppDatabase(':memory:');

  const first = db.upsertNote({
    notionPageId: 'notion-1',
    title: 'Caching',
    content: 'Cache aside',
    sourceUrl: 'https://notion.so/notion-1',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const second = db.upsertNote({
    notionPageId: 'notion-1',
    title: 'Caching',
    content: 'Cache aside and write through',
    sourceUrl: 'https://notion.so/notion-1',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T09:00:00.000Z'
  });

  expect(first.id).toBe(second.id);
  expect(db.listNotes()[0].content).toBe('Cache aside and write through');
  db.close();
});

test('draft approval creates a scheduled card and prevents double approval', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'notion-2',
    title: 'Indexes',
    content: 'Indexes speed reads.',
    sourceUrl: 'https://notion.so/notion-2',
    tags: ['database'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const [draft] = db.createDrafts(note.id, [
    {
      question: 'What is the tradeoff of an index?',
      expectedAnswer: 'Faster reads, slower writes.',
      rubric: ['reads', 'writes'],
      tags: ['database']
    }
  ]);

  const card = db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'));

  expect(card.question).toBe('What is the tradeoff of an index?');
  expect(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length).toBe(1);
  expect(() => db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'))).toThrow(/already handled/);
  db.close();
});

test('recordReview stores optional AI feedback and advances schedule', () => {
  const db = createAppDatabase(':memory:');
  const note = db.upsertNote({
    notionPageId: 'notion-3',
    title: 'Queues',
    content: 'Queues decouple producers and consumers.',
    sourceUrl: 'https://notion.so/notion-3',
    tags: ['system-design'],
    notionLastEditedTime: '2026-06-24T08:00:00.000Z'
  });
  const [draft] = db.createDrafts(note.id, [{
    question: 'Why use a queue?',
    expectedAnswer: 'To decouple producers and consumers.',
    rubric: ['decouple'],
    tags: ['system-design']
  }]);
  const card = db.approveDraft(draft.id, new Date('2026-06-24T08:00:00.000Z'));

  const review = db.recordReview({
    cardId: card.id,
    userAnswer: 'It buffers work between services.',
    aiFeedback: { summary: 'Mention decoupling explicitly.', missingKeyPoints: ['decoupling'], suggestedRating: 'hard' },
    rating: 'hard',
    elapsedSeconds: 42,
    reviewedAt: new Date('2026-06-24T08:00:00.000Z')
  });

  expect(review.rating).toBe('hard');
  expect(db.listReviews()[0].aiFeedback.summary).toBe('Mention decoupling explicitly.');
  expect(db.listDueCards(new Date('2026-06-24T08:00:00.000Z')).length).toBe(0);
  db.close();
});
```

- [ ] **Step 5: Create test/route.test.ts**

Write route handler tests verifying integration of the Next.js API Routes using `bun:test`.

```typescript
import { test, expect } from 'bun:test';
import { GET as stateGet } from '../src/app/api/state/route';
import { POST as syncPost } from '../src/app/api/notion/sync/route';
import { NextRequest } from 'next/server';

test('state and sync routes handle expected operations', async () => {
  const reqSync = new NextRequest('http://localhost/api/notion/sync', {
    method: 'POST',
    body: JSON.stringify({ token: 'fake', databaseId: 'fake' })
  });

  try {
    const syncRes = await syncPost(reqSync);
    expect(syncRes.status).toBe(400); // Fails due to invalid token
  } catch (e: any) {
    // Expected fail
  }
});
```

- [ ] **Step 6: Clean up old test runner and unused test files**

Delete obsolete tests and Node-specific test runner:
```powershell
Remove-Item -LiteralPath test/run.ts, test/api.test.ts, test/http.test.ts -ErrorAction SilentlyContinue
```

---

### Task 6: Run verification and tests

**Files:**
- None

- [ ] **Step 1: Install packages**

Run: `bun install`
Expected: Dependencies resolved and installed successfully.

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 3: Build frontend**

Run: `bun run build`
Expected: Production build of Next.js compiles successfully.
