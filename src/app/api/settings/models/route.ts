import { NextRequest, NextResponse } from 'next/server';
import { listProviderModels } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    const models = await listProviderModels(config);
    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
