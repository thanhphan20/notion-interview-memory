import { NextRequest, NextResponse } from 'next/server';
import { createAppDatabase } from '@/lib/database';

export async function GET() {
  const db = createAppDatabase();
  try {
    const notion = db.getSetting('notion') || {};
    const ai = db.getSetting('ai') || { provider: 'offline' };
    return NextResponse.json({ notion, ai });
  } finally {
    db.close();
  }
}

export async function POST(request: NextRequest) {
  const db = createAppDatabase();
  try {
    const body = await request.json();
    db.setSetting('notion', body.notion || {});
    db.setSetting('ai', body.ai || { provider: 'offline' });
    return NextResponse.json({ saved: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    db.close();
  }
}
