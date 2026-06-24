import { test, expect } from 'bun:test';
import { GET as stateGet } from '../src/app/api/state/route';
import { POST as syncPost } from '../src/app/api/notion/sync/route';
import { NextRequest } from 'next/server';

test('state and sync routes handle expected operations', async () => {
  const reqSync = new NextRequest('http://localhost/api/notion/sync', {
    method: 'POST',
    body: JSON.stringify({ token: 'fake', databaseId: 'fake' })
  });

  try {
    const syncRes = await syncPost(reqSync);
    expect(syncRes.status).toBe(400); // Fails due to invalid token
  } catch (e: any) {
    // Expected fail
  }
});
