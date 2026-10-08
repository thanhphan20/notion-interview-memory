import { withDb } from '@/lib/with-db';

export const GET = withDb((db) => ({ items: db.listChecklistItems() }));
