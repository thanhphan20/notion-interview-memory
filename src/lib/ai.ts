export interface MCQ {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

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
  generateMCQs(note: NoteInput): Promise<MCQ[]>;
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

export function parseMCQs(raw: string | any): MCQ[] {
  const parsed = typeof raw === 'string' ? parseJsonObject(raw) : raw;
  const mcqs = Array.isArray(parsed) ? parsed : parsed.mcqs;
  if (!Array.isArray(mcqs)) {
    throw new Error('AI provider output must include a mcqs array.');
  }
  return mcqs.map((mcq: any) => {
    const options = Array.isArray(mcq.options) ? mcq.options.map(String) : [];
    if (options.length < 2) throw new Error('Each MCQ must have at least 2 options.');
    const correctIndex = Number(mcq.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new Error('MCQ correctIndex must be a valid index within the options array.');
    }
    const question = String(mcq.question || '').trim();
    if (!question) throw new Error('Each MCQ must have a non-empty question.');
    return {
      question,
      options,
      correctIndex,
      explanation: String(mcq.explanation || '').trim(),
      tags: normalizeStringList(mcq.tags),
    };
  });
}

export function createAiProvider(config: AiConfig = {}): AiProvider {
  const provider = config.provider || process.env.AI_PROVIDER || 'offline';
  if (provider === 'offline') {
    return createOfflineProvider();
  }
  if (provider === 'groq') {
    return createOpenAiCompatibleProvider({
      ...config,
      baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
      model: config.model || 'llama-3.3-70b-versatile',
    });
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
    async generateMCQs(note: NoteInput): Promise<MCQ[]> {
      const tags = Array.isArray(note.tags) ? note.tags : [];
      const sentences = (note.content || '').split(/\n|(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20);
      const fallback = note.title;
      const result: MCQ[] = [];
      const used = new Set<string>();
      for (let i = 0; i < Math.min(3, sentences.length || 1); i++) {
        const sentence = sentences[i] || fallback;
        const words = sentence.split(/\s+/).filter((w: string) => w.length > 3 && !used.has(w.toLowerCase()));
        if (words.length === 0) continue;
        const correctWord = words[Math.floor(words.length / 2)];
        used.add(correctWord.toLowerCase());
        result.push({
          question: `Which statement best describes ${sentence.length > 60 ? sentence.slice(0, 60) + '...' : sentence}?`,
          options: [
            `The key concept is ${correctWord}.`,
            `The key concept is the opposite of ${correctWord}.`,
            `${correctWord} is unrelated to this topic.`,
            `${correctWord} only applies to NoSQL databases.`,
          ],
          correctIndex: 0,
          explanation: sentence,
          tags,
        });
      }
      if (result.length === 0) {
        result.push({
          question: `Which statement best describes ${note.title}?`,
          options: [
            'The described concept is accurate.',
            'The described concept is the opposite.',
            'This concept does not exist.',
            'This concept only applies to databases.',
          ],
          correctIndex: 0,
          explanation: fallback,
          tags,
        });
      }
      return result;
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
    async generateMCQs(note: NoteInput): Promise<MCQ[]> {
      const content = await completeJson([
        { role: 'system', content: 'Generate 5-8 multiple-choice questions from the note for interview practice. Return JSON with a mcqs array. Each MCQ needs question, options (4 items), correctIndex, explanation, and tags array.' },
        { role: 'user', content: JSON.stringify(note) },
      ]);
      return parseMCQs(content);
    },
  };
}
