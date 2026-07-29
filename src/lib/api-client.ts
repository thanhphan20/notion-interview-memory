export interface AppState {
  stats: any;
  notes: any[];
  drafts: any[];
  dueCards: any[];
  reviews: any[];
  mcqs: any[];
  mcqReviews: any[];
}

export interface DashboardPayload {
  countdown: any;
  heatmap: any[];
  lapses: any[];
  dueQueue: any[];
}

export interface AiPingResult {
  label: string;
  provider: string;
  ok: boolean;
  message: string;
}

export interface AiModelOption {
  id: string;
  label: string;
  /** USD per 1M input tokens, when the provider reports pricing (e.g. OpenRouter). */
  priceIn?: number;
  /** USD per 1M output tokens, when the provider reports pricing. */
  priceOut?: number;
  /** Context window in tokens, when the provider reports it. */
  contextTokens?: number;
}

async function fetcher(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

function post(path: string, body: unknown = {}): Promise<any> {
  return fetcher(path, { method: 'POST', body: JSON.stringify(body) });
}

export const api = {
  getState(now?: Date): Promise<AppState> {
    return fetcher(`/api/state${now ? `?now=${now.toISOString()}` : ''}`);
  },
  getSettings(): Promise<any> {
    return fetcher('/api/settings');
  },
  async saveSettings(body: any): Promise<void> {
    await post('/api/settings', body);
  },
  async listAiModels(config: { provider?: string; apiKey?: string; baseUrl?: string }): Promise<AiModelOption[]> {
    const payload = await post('/api/settings/models', config);
    return payload.models || [];
  },
  async pingAiProviders(ai: any): Promise<AiPingResult[]> {
    const payload = await post('/api/settings/ping', { ai });
    return payload.results || [];
  },
  syncNotion(): Promise<{ imported: number }> {
    return post('/api/notion/sync');
  },
  generateFromNote(noteId: number): Promise<{ drafts: any[]; mcqs: any[] }> {
    return post(`/api/notes/${noteId}/generate`);
  },
  generateAllNotes(): Promise<{ drafts: any[]; mcqs: any[] }> {
    return post('/api/notes/generate-all');
  },
  generateMCQs(topics?: string[]): Promise<{ mcqs: any[] }> {
    return post('/api/mcqs/generate', topics?.length ? { topics } : {});
  },
  approveDraft(id: number): Promise<any> {
    return post(`/api/drafts/${id}/approve`);
  },
  async rejectDraft(id: number): Promise<void> {
    await post(`/api/drafts/${id}/reject`);
  },
  critiqueAnswer(cardId: number, answer: string): Promise<any> {
    return post(`/api/cards/${cardId}/critique`, { answer });
  },
  submitReview(cardId: number, data: {
    answer: string;
    aiFeedback: any;
    rating: string;
    elapsedSeconds: number;
  }): Promise<any> {
    return post(`/api/cards/${cardId}/review`, data);
  },
  recordMCQAnswer(mcqId: number, selectedIndex: number): Promise<any> {
    return post(`/api/mcqs/${mcqId}/review`, { selectedIndex });
  },
  getDashboard(now?: Date): Promise<DashboardPayload> {
    return fetcher(`/api/dashboard${now ? `?now=${now.toISOString()}` : ''}`);
  },
  setInterviewDate(date: string | null): Promise<{ interviewDate: string | null; countdown: any }> {
    return post('/api/interview-date', { date });
  },
  startSprint(): Promise<{ sprint: any; cards: any[]; mcqs: any[] }> {
    return post('/api/sprints/start');
  },
  completeSprint(sprintId: number, body: { ratings: any[]; mcqAnswers: any[] }): Promise<{ sprint: any; score: number; tagBreakdown: any[] }> {
    return post(`/api/sprints/${sprintId}/complete`, body);
  },
  startMCQDiagnostic(tag?: string): Promise<{ diagnostic: any; mcqs: any[]; tag: string | null }> {
    return post('/api/mcq-diagnostics/start', tag ? { tag } : {});
  },
  completeMCQDiagnostic(diagnosticId: number, body: { answers: any[] }): Promise<{ diagnostic: any; score: number; weaknessReport: { entries: any[]; drillTargetTags: string[] } }> {
    return post(`/api/mcq-diagnostics/${diagnosticId}/complete`, body);
  },
};
