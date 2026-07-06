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
const DEFAULT_CONCURRENCY = 6;

export interface ExistingNoteInfo {
  content: string;
  notionLastEditedTime: string;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

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
  const topicProperty = options.topicProperty || 'Technology';
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

export async function syncNotionDatabase(
  config: NotionSyncConfig,
  dependencies: { fetch?: FetchFn; getExistingNote?: (notionPageId: string) => ExistingNoteInfo | undefined; concurrency?: number } = {}
): Promise<NotionSyncResult> {
  const fetchImpl = dependencies.fetch || fetch;
  const getExistingNote = dependencies.getExistingNote;
  const concurrency = dependencies.concurrency || DEFAULT_CONCURRENCY;
  const token = config.token || process.env.NOTION_TOKEN;
  const databaseId = config.databaseId || process.env.NOTION_DATABASE_ID;
  if (!token) throw new Error('NOTION_TOKEN is required.');
  if (!databaseId) throw new Error('NOTION_DATABASE_ID is required.');

  const topicProperty = config.topicProperty || process.env.NOTION_TOPIC_PROPERTY || 'Technology';
  const topics = config.topics || parseCsv(process.env.NOTION_TOPIC_FILTERS || '');
  const filter = buildNotionDatabaseFilter(topicProperty, topics);
  const pages = await queryDatabase(fetchImpl, token, databaseId, filter);
  const mapOptions = { titleProperty: config.titleProperty || 'Name', topicProperty };

  const notes = await mapWithConcurrency(pages, concurrency, async (page) => {
    const existing = getExistingNote?.(page.id);
    if (existing && page.last_edited_time && existing.notionLastEditedTime === page.last_edited_time) {
      const note = mapNotionPageToNote(page, [], mapOptions);
      note.content = existing.content;
      return note;
    }
    const blocks = await fetchPageBlocks(fetchImpl, token, page.id);
    return mapNotionPageToNote(page, blocks, mapOptions);
  });

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
