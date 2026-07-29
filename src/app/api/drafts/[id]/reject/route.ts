import { withDb } from '@/lib/with-db';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withDb(async (db, _request: Request, { params }: Ctx) => ({
  draft: db.rejectDraft(Number((await params).id)),
}));
