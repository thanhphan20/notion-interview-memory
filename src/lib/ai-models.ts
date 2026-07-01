export interface AiModelOption {
  id: string;
  label: string;
}

export const GROQ_MODELS: AiModelOption[] = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { id: 'llama3-70b-8192', label: 'Llama 3 70B' },
  { id: 'llama3-8b-8192', label: 'Llama 3 8B' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B IT' },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B' },
  { id: 'qwen-2.5-32b', label: 'Qwen 2.5 32B' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (preview)' },
  { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B (preview)' },
];
