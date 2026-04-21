/** Known context window sizes (in tokens) for common OpenRouter model IDs. */
const CONTEXT_WINDOWS: Record<string, number> = {
  'anthropic/claude-opus-4-7': 200_000,
  'anthropic/claude-sonnet-4-6': 200_000,
  'anthropic/claude-haiku-4-5-20251001': 200_000,
  'anthropic/claude-3-5-sonnet': 200_000,
  'anthropic/claude-3-5-haiku': 200_000,
  'anthropic/claude-3-opus': 200_000,
  'google/gemini-2.0-flash': 1_000_000,
  'google/gemini-flash-1.5': 1_000_000,
  'google/gemini-flash-1.5-8b': 1_000_000,
  'google/gemini-pro-1.5': 2_000_000,
  'openai/gpt-4o': 128_000,
  'openai/gpt-4o-mini': 128_000,
  'openai/o1': 200_000,
  'openai/o1-mini': 128_000,
  'openai/o3-mini': 200_000,
  'openai/o4-mini': 200_000,
  'meta-llama/llama-3.3-70b-instruct': 128_000,
  'meta-llama/llama-3.1-405b-instruct': 128_000,
  'deepseek/deepseek-r1': 128_000,
  'deepseek/deepseek-chat': 128_000,
  'mistralai/mistral-large': 128_000,
  'x-ai/grok-2': 131_072,
  'x-ai/grok-3': 131_072,
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

export function getContextWindow(modelId: string): number {
  if (CONTEXT_WINDOWS[modelId]) return CONTEXT_WINDOWS[modelId];
  // Family fallbacks
  if (modelId.includes('claude')) return 200_000;
  if (modelId.includes('gemini')) return 1_000_000;
  if (modelId.includes('o1') || modelId.includes('o3') || modelId.includes('o4')) return 200_000;
  return DEFAULT_CONTEXT_WINDOW;
}

/** Format a token count for display: 1842 → "1.8k", 200000 → "200k" */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
