import { NextResponse } from 'next/server';
import { withDb, type IdContext } from '@/lib/with-db';
import type { ChecklistItemPatch } from '@/lib/database';

export const PATCH = withDb(async (db, request: Request, context: IdContext) => {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)) {
    return NextResponse.json({ error: 'Checklist item id must be a positive integer.' }, { status: 400 });
  }

  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Checklist update must be a JSON object.' }, { status: 400 });
  }

  const values = body as Record<string, unknown>;
  const keys = Object.keys(values);
  if (keys.length === 0 || keys.some((key) => key !== 'done' && key !== 'takeaway')) {
    return NextResponse.json({ error: 'Provide only done and/or takeaway.' }, { status: 400 });
  }
  if (Object.hasOwn(values, 'done') && typeof values.done !== 'boolean') {
    return NextResponse.json({ error: 'done must be a boolean.' }, { status: 400 });
  }
  if (Object.hasOwn(values, 'takeaway') && typeof values.takeaway !== 'string') {
    return NextResponse.json({ error: 'takeaway must be a string.' }, { status: 400 });
  }

  const patch: ChecklistItemPatch = {};
  if (Object.hasOwn(values, 'done')) {
    const done = values.done;
    if (typeof done === 'boolean') patch.done = done;
  }
  if (Object.hasOwn(values, 'takeaway')) {
    const takeaway = values.takeaway;
    if (typeof takeaway === 'string') patch.takeaway = takeaway;
  }
  return { item: db.updateChecklistItem(id, patch) };
});
