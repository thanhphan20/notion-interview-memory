import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, request: Request, { params }: Ctx) => {
  const body = await request.json().catch(() => ({}));
  return { card: db.approveDraft(Number((await params).id), body.now ? new Date(body.now) : new Date()) };
});
