export interface CardDraft {
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
}

export interface AnswerCritique {
  summary: string;
  missingKeyPoints: string[];
  suggestedRating: string;
}

export interface NoteInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface CritiqueInput {
  card: { rubric?: string[]; [key: string]: any };
  answer: string;
}

export interface AiProvider {
  generateCards(note: NoteInput): Promise<CardDraft[]>;
  critiqueAnswer(input: CritiqueInput): Promise<AnswerCritique>;
}

export interface AiConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

function parseJsonObject(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`AI provider returned invalid JSON: ${(error as Error).message}`);
  }
}

function normalizeStringList(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function parseCardDrafts(raw: string | any): CardDraft[] {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) {
    throw new Error('AI provider output must include a cards array.');
  }

  return cards.map((card: any) => {
    const draft: CardDraft = {
      question: typeof card.question === 'string' ? card.question.trim() : '',
      expectedAnswer: typeof card.expectedAnswer === 'string' ? card.expectedAnswer.trim() : '',
      rubric: normalizeStringList(card.rubric),
      tags: normalizeStringList(card.tags),
    };

    if (!draft.question || !draft.expectedAnswer || draft.rubric.length === 0) {
      throw new Error('AI provider returned an invalid card draft.');
    }

    return draft;
  });
}

export function parseAnswerCritique(raw: string | any): AnswerCritique {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const suggestedRating = ['again', 'hard', 'good', 'easy'].includes(parsed.suggestedRating)
    ? parsed.suggestedRating
    : 'good';

  return {
    summary: typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'No critique summary returned.',
    missingKeyPoints: normalizeStringList(parsed.missingKeyPoints),
    suggestedRating,
  };
}

export function createAiProvider(config: AiConfig = {}): AiProvider {
  const provider = config.provider || process.env.AI_PROVIDER || 'offline';
  if (provider === 'offline') {
    return createOfflineProvider();
  }
  if (provider === 'openai-compatible') {
    return createOpenAiCompatibleProvider(config);
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

function createOfflineProvider(): AiProvider {
  return {
    async generateCards(note: NoteInput): Promise<CardDraft[]> {
      const tags = Array.isArray(note.tags) ? note.tags : [];
      const summary = firstUsefulSentence(note.content) || note.title;
      return [{
        question: `Explain ${note.title} as you would in an interview.`,
        expectedAnswer: summary,
        rubric: [
          `Defines ${note.title}`,
          'Explains the key tradeoffs or use cases',
          'Uses clear interview-ready language',
        ],
        tags,
      }];
    },
    async critiqueAnswer({ card, answer }: CritiqueInput): Promise<AnswerCritique> {
      const missingKeyPoints = (card.rubric || []).filter((point: string) => {
        return !answer.toLowerCase().includes(String(point).split(' ')[0].toLowerCase());
      }).slice(0, 3);
      return {
        summary: missingKeyPoints.length === 0
          ? 'Your answer covers the main rubric points.'
          : 'Your answer is usable, but it misses some rubric points.',
        missingKeyPoints,
        suggestedRating: missingKeyPoints.length > 1 ? 'hard' : 'good',
      };
    },
  };
}

function firstUsefulSentence(content: string = ''): string | undefined {
  return String(content)
    .split(/\n|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find((part) => part.length > 20);
}

function createOpenAiCompatibleProvider(config: AiConfig = {}): AiProvider {
  const apiKey = config.apiKey || process.env.AI_API_KEY;
  const baseUrl = (config.baseUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = config.model || process.env.AI_MODEL || 'gpt-4.1-mini';

  if (!apiKey) {
    throw new Error('AI_API_KEY is required for openai-compatible provider.');
  }

  async function completeJson(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content || '{}';
  }

  return {
    async generateCards(note: NoteInput): Promise<CardDraft[]> {
      const content = await completeJson([
        { role: 'system', content: 'Create interview-style open-recall study cards. Return JSON with a cards array. Each card needs question, expectedAnswer, rubric array, and tags array.' },
        { role: 'user', content: JSON.stringify(note) },
      ]);
      return parseCardDrafts(content);
    },
    async critiqueAnswer(input: CritiqueInput): Promise<AnswerCritique> {
      const content = await completeJson([
        { role: 'system', content: 'Critique an interview practice answer. Return JSON with summary, missingKeyPoints array, and suggestedRating as again, hard, good, or easy.' },
        { role: 'user', content: JSON.stringify(input) },
      ]);
      return parseAnswerCritique(content);
    },
  };
}
