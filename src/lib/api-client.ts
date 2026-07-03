import {
  USE_MOCK,
  mockStats,
  mockCards,
  mockNotes,
  mockDrafts,
  mockReviews,
  mockSettings,
} from './mock-data';

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

export interface ApiClient {
  getState(now?: Date): Promise<AppState>;
  getSettings(): Promise<any>;
  saveSettings(body: any): Promise<void>;
  syncNotion(): Promise<{ imported: number }>;
  generateFromNote(noteId: number): Promise<{ drafts: any[]; mcqs: any[] }>;
  generateAllNotes(): Promise<{ drafts: any[]; mcqs: any[] }>;
  generateMCQs(): Promise<{ mcqs: any[] }>;
  approveDraft(id: number): Promise<any>;
  rejectDraft(id: number): Promise<void>;
  critiqueAnswer(cardId: number, answer: string): Promise<any>;
  submitReview(cardId: number, data: {
    answer: string;
    aiFeedback: any;
    rating: string;
    elapsedSeconds: number;
  }): Promise<any>;
  recordMCQAnswer(mcqId: number, selectedIndex: number): Promise<any>;
  getDashboard(now?: Date): Promise<DashboardPayload>;
  setInterviewDate(date: string | null): Promise<{ interviewDate: string | null; countdown: any }>;
  startSprint(): Promise<{ sprint: any; cards: any[]; mcqs: any[] }>;
  completeSprint(sprintId: number, body: { ratings: any[]; mcqAnswers: any[] }): Promise<{ sprint: any; score: number; tagBreakdown: any[] }>;
  startMCQDiagnostic(): Promise<{ diagnostic: any; mcqs: any[] }>;
  completeMCQDiagnostic(diagnosticId: number, body: { answers: any[] }): Promise<{ diagnostic: any; score: number; weaknessReport: { entries: any[]; drillTargetTags: string[] } }>;
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

function createRealClient(): ApiClient {
  return {
    async getState(now) {
      const params = now ? `?now=${now.toISOString()}` : '';
      return fetcher(`/api/state${params}`);
    },
    async getSettings() {
      return fetcher('/api/settings');
    },
    async saveSettings(body) {
      await fetcher('/api/settings', { method: 'POST', body: JSON.stringify(body) });
    },
    async syncNotion() {
      return fetcher('/api/notion/sync', { method: 'POST', body: '{}' });
    },
    async generateFromNote(noteId) {
      return fetcher(`/api/notes/${noteId}/generate`, { method: 'POST', body: '{}' });
    },
    async generateAllNotes() {
      return fetcher('/api/notes/generate-all', { method: 'POST', body: '{}' });
    },
    async generateMCQs() {
      return fetcher('/api/mcqs/generate', { method: 'POST', body: '{}' });
    },
    async approveDraft(id) {
      return fetcher(`/api/drafts/${id}/approve`, { method: 'POST', body: '{}' });
    },
    async rejectDraft(id) {
      await fetcher(`/api/drafts/${id}/reject`, { method: 'POST', body: '{}' });
    },
    async critiqueAnswer(cardId, answer) {
      return fetcher(`/api/cards/${cardId}/critique`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
    },
    async submitReview(cardId, data) {
      return fetcher(`/api/cards/${cardId}/review`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async recordMCQAnswer(mcqId, selectedIndex) {
      return fetcher(`/api/mcqs/${mcqId}/review`, {
        method: 'POST',
        body: JSON.stringify({ selectedIndex }),
      });
    },
    async getDashboard(now) {
      const params = now ? `?now=${now.toISOString()}` : '';
      return fetcher(`/api/dashboard${params}`);
    },
    async setInterviewDate(date) {
      return fetcher('/api/interview-date', {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
    },
    async startSprint() {
      return fetcher('/api/sprints/start', { method: 'POST', body: '{}' });
    },
    async completeSprint(sprintId, body) {
      return fetcher(`/api/sprints/${sprintId}/complete`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    async startMCQDiagnostic() {
      return fetcher('/api/mcq-diagnostics/start', { method: 'POST', body: '{}' });
    },
    async completeMCQDiagnostic(diagnosticId, body) {
      return fetcher(`/api/mcq-diagnostics/${diagnosticId}/complete`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };
}

function delay(ms: number = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let mockReviewId = 10;

function createMockClient(): ApiClient {
  let mockDueCards = [...mockCards];
  let mockDraftList = [...mockDrafts];
  let mockMCQList: any[] = [];
  let mockMCQReviewList: any[] = [];

  return {
    async getState() {
      await delay();
      return {
        stats: { ...mockStats, draftCount: mockDraftList.length, dueCount: mockDueCards.length },
        notes: mockNotes,
        drafts: mockDraftList,
        dueCards: mockDueCards,
        reviews: mockReviews,
        mcqs: mockMCQList,
        mcqReviews: mockMCQReviewList,
      };
    },
    async getSettings() {
      await delay();
      return mockSettings;
    },
    async saveSettings() {
      await delay(100);
    },
    async syncNotion() {
      await delay(500);
      return { imported: 3 };
    },
    async generateFromNote() {
      await delay(800);
      return { drafts: [], mcqs: [] };
    },
    async generateAllNotes() {
      await delay(800);
      return { drafts: [], mcqs: [] };
    },
    async generateMCQs() {
      await delay(600);
      const newMCQs = [
        { id: 101, noteId: 1, question: 'Which algorithm allows burst traffic?', options: ['Token Bucket', 'Leaky Bucket', 'Fixed Window', 'Sliding Log'], correctIndex: 0, explanation: 'Token Bucket allows bursts by accumulating tokens.', tags: ['System Design'], createdAt: new Date().toISOString() },
        { id: 102, noteId: 1, question: 'What does CAP theorem guarantee?', options: ['Consistency, Availability, Partition Tolerance', 'Consistency, Accuracy, Performance', 'Concurrency, Availability, Persistence', 'Caching, Atomicity, Partitioning'], correctIndex: 0, explanation: 'CAP stands for Consistency, Availability, and Partition Tolerance.', tags: ['Distributed Systems'], createdAt: new Date().toISOString() },
      ];
      mockMCQList = [...newMCQs];
      return { mcqs: newMCQs };
    },
    async approveDraft(id) {
      await delay(100);
      const draft = mockDraftList.find((d) => d.id === id);
      if (!draft) throw new Error('Draft not found.');
      mockDraftList = mockDraftList.filter((d) => d.id !== id);
      const newCard = { ...draft, id: mockCards.length + mockDraftList.length + 1, expectedAnswer: draft.expectedAnswer };
      mockDueCards = [...mockDueCards, newCard];
      return newCard;
    },
    async rejectDraft(id) {
      await delay(100);
      mockDraftList = mockDraftList.filter((d) => d.id !== id);
    },
    async critiqueAnswer() {
      await delay(600);
      return {
        critique: {
          summary: 'Solid coverage of the main concepts. Consider elaborating on specific real-world examples.',
          suggestedRating: 'good',
          missingKeyPoints: ['Real-world architecture examples', 'Thread safety mechanisms'],
        },
      };
    },
    async submitReview(_cardId, data) {
      await delay(200);
      mockReviewId++;
      const review = { id: mockReviewId, ...data, reviewedAt: new Date().toISOString() };
      (mockReviews as any[]).unshift(review);
      mockDueCards = mockDueCards.filter((c: any) => c.id !== _cardId);
      return { review };
    },
    async recordMCQAnswer(mcqId, selectedIndex) {
      await delay(100);
      const mcq = mockMCQList.find((m: any) => m.id === mcqId);
      const correct = mcq ? selectedIndex === mcq.correctIndex : false;
      const review = {
        id: mockReviewId++,
        mcqId,
        selectedIndex,
        correct,
        reviewedAt: new Date().toISOString(),
      };
      mockMCQReviewList = [...mockMCQReviewList, review];
      return { review };
    },
    async getDashboard() {
      await delay(150);
      return {
        countdown: {
          interviewDate: '2026-08-15',
          daysUntil: 43,
          sprintScoreAverage: null,
          sprintCount: 0,
          heatmapGreenPercent: 0.4,
          status: 'active',
        },
        heatmap: [
          { tag: 'System Design', retentionRate: 0.82, ratingAverageTrend: 0.12, cardCount: 8, measuredCardCount: 6, status: 'green', isColdTag: false },
          { tag: 'Databases', retentionRate: 0.55, ratingAverageTrend: -0.05, cardCount: 6, measuredCardCount: 5, status: 'yellow', isColdTag: false },
          { tag: 'Distributed Systems', retentionRate: 0.4, ratingAverageTrend: null, cardCount: 5, measuredCardCount: 3, status: 'red', isColdTag: false },
          { tag: 'Networking', retentionRate: null, ratingAverageTrend: null, cardCount: 4, measuredCardCount: 0, status: 'grey', isColdTag: true },
        ],
        lapses: [
          { cardId: 12, question: 'Explain load balancing tradeoffs.', lastRating: 'again', reviewedAt: new Date(Date.now() - 86400000).toISOString(), tags: ['System Design'] },
          { cardId: 33, question: 'What is write-through caching?', lastRating: 'hard', reviewedAt: new Date(Date.now() - 172800000).toISOString(), tags: ['Databases'] },
        ],
        dueQueue: mockDueCards,
      };
    },
    async setInterviewDate(date) {
      await delay(80);
      return {
        interviewDate: date,
        countdown: { interviewDate: date, daysUntil: date ? 30 : null, sprintScoreAverage: null, sprintCount: 0, heatmapGreenPercent: 0.4, status: date ? 'active' : 'unset' },
      };
    },
    async startSprint() {
      await delay(200);
      throw new Error('Sprint not available in mock mode — use USE_MOCK=false to try sprints.');
    },
    async completeSprint(_id, _body) {
      await delay(200);
      throw new Error('Sprint not available in mock mode.');
    },
    async startMCQDiagnostic() {
      await delay(200);
      throw new Error('MCQ diagnostic not available in mock mode — use USE_MOCK=false to try.');
    },
    async completeMCQDiagnostic(_id, _body) {
      await delay(200);
      throw new Error('MCQ diagnostic not available in mock mode.');
    },
  };
}

let cachedClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!cachedClient) {
    cachedClient = USE_MOCK ? createMockClient() : createRealClient();
  }
  return cachedClient;
}
