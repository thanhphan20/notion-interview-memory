import { NextRequest, NextResponse } from 'next/server';
import { pingProvider, type AiConfig } from '@/lib/ai';

export interface PingResultEntry {
  label: string;
  provider: string;
  ok: boolean;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ai: AiConfig = body.ai || {};
    const fallbacks = Array.isArray(ai.fallbacks) ? ai.fallbacks : [];

    const targets: Array<{ label: string; config: AiConfig }> = [
      { label: 'Primary', config: ai },
      ...fallbacks.map((config, index) => ({ label: `Fallback ${index + 1}`, config })),
    ];

    const results: PingResultEntry[] = await Promise.all(
      targets.map(async ({ label, config }) => {
        const result = await pingProvider(config);
        return { label, provider: config.provider || 'offline', ...result };
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
