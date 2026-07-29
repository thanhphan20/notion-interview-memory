import { NextResponse } from 'next/server';
import { createAppDatabase, type AppDatabase } from './database';

/**
 * Wraps a route handler with the per-request SQLite lifecycle every route needs:
 * open the db, always close it, and turn a thrown error into a 400 with its
 * message. Return a plain object to have it JSON-encoded, or a NextResponse
 * when the route needs a different status.
 */
export function withDb<A extends unknown[]>(handler: (db: AppDatabase, ...args: A) => unknown) {
  return async (...args: A): Promise<NextResponse> => {
    const db = createAppDatabase();
    try {
      const result = await handler(db, ...args);
      return result instanceof NextResponse ? result : NextResponse.json(result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } finally {
      db.close();
    }
  };
}

/** Reads the `?now=` override used by tests and time-travel debugging. */
export function nowFrom(request: Request): Date {
  const value = new URL(request.url).searchParams.get('now');
  return value ? new Date(value) : new Date();
}
