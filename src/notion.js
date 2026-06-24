const NOTION_VERSION = '2022-06-28';

function buildNotionDatabaseFilter(topicProperty, topics) {
  const selected = (topics || []).map((topic) => String(topic).trim()).filter(Boolean);
  if (!topicProperty || selected.length === 0) {
    return undefined;
  }
  return {
    or: selected.map((topic) => ({
      property: topicProperty,
      multi_select: { contains: topic }
    }))
  };
}

function richTextToPlainText(richText = []) {
  return richText.map((item) => item.plain_text || '').join('');
}

function extractPlainText(blocks) {
  const lines = [];
  for (const block of blocks) {
    const type = block.type;
    const value = block[type];
    if (!value) continue;

    if (type === 'heading_1') lines.push(`# ${richTextToPlainText(value.rich_text)}`);
    else if (type === 'heading_2') lines.push(`## ${richTextToPlainText(value.rich_text)}`);
    else if (type === 'heading_3') lines.push(`### ${richTextToPlainText(value.rich_text)}`);
    else if (type === 'bulleted_list_item') lines.push(`- ${richTextToPlainText(value.rich_text)}`);
    else if (type === 'numbered_list_item') lines.push(`1. ${richTextToPlainText(value.rich_text)}`);
    else if (type === 'to_do') lines.push(`- [${value.checked ? 'x' : ' '}] ${richTextToPlainText(value.rich_text)}`);
    else if (type === 'code') lines.push(`\`\`\`${value.language || ''}\n${richTextToPlainText(value.rich_text)}\n\`\`\``);
    else if (Array.isArray(value.rich_text)) lines.push(richTextToPlainText(value.rich_text));
  }
  return lines.map((line) => line.trimEnd()).filter(Boolean).join('\n');
}

function mapNotionPageToNote(page, blocks, options = {}) {
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
    notionLastEditedTime: page.last_edited_time
  };
}

function readTitle(property) {
  if (!property || property.type !== 'title') return '';
  return richTextToPlainText(property.title).trim();
}

function readAnyTitle(properties = {}) {
  for (const property of Object.values(properties)) {
    const title = readTitle(property);
    if (title) return title;
  }
  return '';
}

function readTags(property) {
  if (!property) return [];
  if (property.type === 'multi_select') return property.multi_select.map((item) => item.name);
  if (property.type === 'select' && property.select?.name) return [property.select.name];
  return [];
}

async function syncNotionDatabase(config, dependencies = {}) {
  const fetchImpl = dependencies.fetch || fetch;
  const token = config.token || process.env.NOTION_TOKEN;
  const databaseId = config.databaseId || process.env.NOTION_DATABASE_ID;
  if (!token) throw new Error('NOTION_TOKEN is required.');
  if (!databaseId) throw new Error('NOTION_DATABASE_ID is required.');

  const topicProperty = config.topicProperty || process.env.NOTION_TOPIC_PROPERTY || 'Topic';
  const topics = config.topics || parseCsv(process.env.NOTION_TOPIC_FILTERS || '');
  const filter = buildNotionDatabaseFilter(topicProperty, topics);
  const pages = await queryDatabase(fetchImpl, token, databaseId, filter);
  const notes = [];

  for (const page of pages) {
    const blocks = await fetchPageBlocks(fetchImpl, token, page.id);
    notes.push(mapNotionPageToNote(page, blocks, {
      titleProperty: config.titleProperty || 'Name',
      topicProperty
    }));
  }

  return {
    imported: notes.length,
    notes
  };
}

async function queryDatabase(fetchImpl, token, databaseId, filter) {
  const pages = [];
  let cursor;
  do {
    const response = await fetchImpl(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        ...(filter ? { filter } : {}),
        ...(cursor ? { start_cursor: cursor } : {})
      })
    });
    if (!response.ok) throw new Error(`Notion database query failed: ${response.status} ${await response.text()}`);
    const payload = await response.json();
    pages.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function fetchPageBlocks(fetchImpl, token, pageId) {
  const blocks = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const response = await fetchImpl(url, { headers: notionHeaders(token) });
    if (!response.ok) throw new Error(`Notion block query failed: ${response.status} ${await response.text()}`);
    const payload = await response.json();
    blocks.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function notionHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    'notion-version': NOTION_VERSION,
    'content-type': 'application/json'
  };
}

function parseCsv(value) {
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
}

module.exports = {
  buildNotionDatabaseFilter,
  extractPlainText,
  mapNotionPageToNote,
  syncNotionDatabase
};
