import { withDb, type IdContext } from '@/lib/with-db';

export const POST = withDb(async (db, request: Request, { params }: IdContext) => {
  const body = await request.json().catch(() => ({}));
  return { card: db.approveDraft(Number((await params).id), body.now ? new Date(body.now) : new Date()) };
});
