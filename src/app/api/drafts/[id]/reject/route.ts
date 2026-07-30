import { withDb, type IdContext } from '@/lib/with-db';

export const POST = withDb(async (db, _request: Request, { params }: IdContext) => ({
  draft: db.rejectDraft(Number((await params).id)),
}));
