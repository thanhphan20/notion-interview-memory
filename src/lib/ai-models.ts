export interface AiModelOption {
  id: string;
  label: string;
}

export interface AiProviderInfo {
  /** Provider id stored in settings and read by createAiProvider. */
  id: string;
  /** Human-readable label shown in the Settings dropdown. */
  label: string;
  /** Default OpenAI-compatible base URL for this provider. */
  defaultBaseUrl: string;
  /** Model id used when the user hasn't picked one. */
  defaultModel: string;
  /** Whether this provider needs an API key. */
  requiresApiKey: boolean;
}

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Model lists are not hardcoded here — the Settings UI fetches them live from
// each provider's `GET {baseUrl}/models` endpoint (see listProviderModels in ai.ts).
// These are just the "if the user hasn't picked one yet" defaults.
export const AI_PROVIDERS: AiProviderInfo[] = [
  { id: 'offline', label: 'Offline deterministic', defaultBaseUrl: '', defaultModel: '', requiresApiKey: false },
  { id: 'groq', label: 'Groq (free)', defaultBaseUrl: GROQ_BASE_URL, defaultModel: 'llama-3.3-70b-versatile', requiresApiKey: true },
  { id: 'openrouter', label: 'OpenRouter (free tier)', defaultBaseUrl: OPENROUTER_BASE_URL, defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', requiresApiKey: true },
  { id: 'gemini', label: 'Google Gemini (free tier)', defaultBaseUrl: GEMINI_BASE_URL, defaultModel: 'gemini-2.5-flash', requiresApiKey: true },
  { id: 'openai', label: 'OpenAI (ChatGPT)', defaultBaseUrl: OPENAI_BASE_URL, defaultModel: 'gpt-4o-mini', requiresApiKey: true },
  { id: 'openai-compatible', label: 'OpenAI-compatible (custom endpoint)', defaultBaseUrl: OPENAI_BASE_URL, defaultModel: 'gpt-4.1-mini', requiresApiKey: true },
];

export function getProviderInfo(id: string | undefined): AiProviderInfo | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}
