import type { AiModelOption } from './ai-models';

/**
 * Heuristic model recommender for the Settings page.
 *
 * The provider `/models` endpoints give us wildly different metadata: OpenRouter
 * reports per-token pricing and context length, while Groq/Gemini/OpenAI return
 * little more than an id. So we score on whatever signal is available —
 * cost (free > cheap > paid) first, then a keyword-based capability guess, then
 * context size — and surface the top few that are "free, cheap, and good enough".
 */

export interface ModelRecommendation {
  id: string;
  label: string;
  /** One-line, human-readable justification. */
  reason: string;
  /** Short chips shown next to the model (e.g. "Free", "$0.60/1M out", "128K ctx"). */
  badges: string[];
  isFree: boolean;
}

/** Providers whose whole catalogue is free to the user under a free tier. */
const FREE_TIER_PROVIDERS = new Set(['groq', 'gemini']);

/** Models that can't generate chat/JSON output — never recommend these. */
const NON_TEXT = /(text-embedding|embedding|embed|whisper|tts|text-to-speech|\baudio\b|transcrib|dall-?e|gpt-image|image-|\bimage\b|moderation|guard|rerank|stable-diffusion|sdxl|\bflux\b|\bsora\b|clip-|\bbge\b|nomic-embed|davinci-002|babbage-002)/i;

function isFreeModel(provider: string, model: AiModelOption): boolean {
  if (FREE_TIER_PROVIDERS.has(provider)) return true;
  if (/:free\b/i.test(model.id)) return true;
  if (model.priceIn === 0 && model.priceOut === 0) return true;
  return false;
}

/** Cost dominates the ranking, matching the "free, cheap, good enough" ask. */
function costScore(isFree: boolean, priceOut?: number): number {
  if (isFree) return 1000;
  if (typeof priceOut === 'number') {
    // Cheaper output price → higher score, floored so pricey-but-capable still ranks.
    return Math.max(200, 700 - priceOut * 40);
  }
  return 400; // Paid, but price unknown (Groq/OpenAI don't report it here).
}

/** Rough "good enough" guess from the model id, since most providers give no quality metadata. */
function capabilityScore(id: string): number {
  const s = id.toLowerCase();
  // Strong yet cost-effective sweet spots.
  if (/(gpt-4o-mini|gpt-4\.1-mini|o[34]-mini|gpt-5-mini|gemini-2\.5-flash|gemini-2\.0-flash|llama-3\.3-70b|llama-3\.1-70b|deepseek.*(v3|chat|r1)|qwen.*(2\.5|3).*(72b|32b)|mixtral-8x22b)/.test(s)) return 120;
  // Capable mid/large models.
  if (/(70b|72b|gpt-4o|gpt-4\.1|gemini.*(flash|pro)|qwen.*32b|gemma-?2.*(27b|9b)|mixtral-8x7b|command-r|mistral-large|deepseek)/.test(s)) return 95;
  // Tiny / not ideal for structured generation — checked before the generic
  // "instruct/chat" fallback so an explicit size marker isn't overridden.
  if (/(0\.5b|1\.5b|\b[13]b\b|1b-|3b-|nano|tiny|micro)/.test(s)) return 25;
  // Small/fast but still solid.
  if (/(8b|9b|mini|flash|small|haiku|scout|instant|gemma)/.test(s)) return 70;
  // Basic / older.
  if (/(7b|3\.5|turbo)/.test(s)) return 50;
  // Generic instruct/chat model with no other signal.
  if (/(instruct|chat)/.test(s)) return 45;
  return 45;
}

function contextBonus(contextTokens?: number): number {
  if (!contextTokens) return 0;
  return Math.min(contextTokens / 1000, 200) * 0.05; // up to ~10 at 200K
}

function formatPrice(usdPerMillion: number): string {
  if (usdPerMillion === 0) return '$0';
  return usdPerMillion < 1 ? `$${usdPerMillion.toFixed(3)}` : `$${usdPerMillion.toFixed(2)}`;
}

function describe(model: AiModelOption, isFree: boolean, capability: number): Pick<ModelRecommendation, 'reason' | 'badges'> {
  const badges: string[] = [];
  if (isFree) {
    badges.push('Free');
  } else if (typeof model.priceOut === 'number') {
    badges.push(`${formatPrice(model.priceOut)}/1M out`);
  }
  if (model.contextTokens) {
    badges.push(`${Math.round(model.contextTokens / 1000)}K ctx`);
  }
  const tier = capability >= 120 ? 'Great value'
    : capability >= 95 ? 'Capable'
    : capability >= 70 ? 'Fast & light'
    : 'Basic';
  badges.push(tier);

  const parts: string[] = [];
  parts.push(isFree ? 'Free to run' : (typeof model.priceOut === 'number' ? 'Low cost' : 'Paid'));
  if (capability >= 95) parts.push('strong output quality');
  else if (capability >= 70) parts.push('quick and lightweight');
  else parts.push('good enough for card generation');
  if (model.contextTokens && model.contextTokens >= 32000) parts.push('large context window');

  return { reason: `${parts.join(', ')}.`, badges };
}

/**
 * Returns up to `limit` recommended models, best first, biased toward free/cheap
 * options that are still capable enough for flashcard/MCQ generation.
 */
export function recommendModels(
  provider: string | undefined,
  models: AiModelOption[] | undefined,
  limit = 3,
): ModelRecommendation[] {
  if (!provider || provider === 'offline' || !models || models.length === 0) return [];

  const usable = models.filter((m) => m.id && !NON_TEXT.test(m.id));
  const pool = usable.length > 0 ? usable : models;

  const scored = pool
    .map((model) => {
      const free = isFreeModel(provider, model);
      const capability = capabilityScore(model.id);
      const score = costScore(free, model.priceOut) + capability + contextBonus(model.contextTokens);
      return { model, free, capability, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ model, free, capability }) => {
    const { reason, badges } = describe(model, free, capability);
    return { id: model.id, label: model.label, reason, badges, isFree: free };
  });
}
