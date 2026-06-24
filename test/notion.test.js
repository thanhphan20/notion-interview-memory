const assert = require('node:assert/strict');
const test = require('node:test');

const { buildNotionDatabaseFilter, extractPlainText, mapNotionPageToNote } = require('../src/notion');

test('buildNotionDatabaseFilter creates an OR filter for selected topics', () => {
  const filter = buildNotionDatabaseFilter('Topic', ['System Design', 'JavaScript']);

  assert.deepEqual(filter, {
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
  };
  const blocks = [
    { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Layer 4 vs Layer 7.' }] } },
    { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Health checks matter.' }] } }
  ];

  const note = mapNotionPageToNote(page, blocks, { titleProperty: 'Name', topicProperty: 'Topic' });

  assert.equal(note.notionPageId, 'page-1');
  assert.equal(note.title, 'Load Balancing');
  assert.equal(note.content, 'Layer 4 vs Layer 7.\n- Health checks matter.');
  assert.deepEqual(note.tags, ['System Design']);
  assert.equal(note.sourceUrl, 'https://notion.so/page-1');
});

test('extractPlainText supports common Notion rich text block types', () => {
  const blocks = [
    { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Patterns' }] } },
    { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'Factory' }] } },
    { type: 'code', code: { rich_text: [{ plain_text: 'class Factory {}' }], language: 'typescript' } }
  ];

  assert.equal(extractPlainText(blocks), '## Patterns\n1. Factory\n```typescript\nclass Factory {}\n```');
});
