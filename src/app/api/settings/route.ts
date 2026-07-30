import { withDb } from '@/lib/with-db';

export const GET = withDb((db) => ({
  notion: db.getSetting('notion') || {},
  ai: db.getSetting('ai') || { provider: 'offline' },
}));

export const POST = withDb(async (db, request: Request) => {
  const body = await request.json();
  db.setSetting('notion', body.notion || {});
  db.setSetting('ai', body.ai || { provider: 'offline' });
  return { saved: true };
});
