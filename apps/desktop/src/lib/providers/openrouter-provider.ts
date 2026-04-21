/**
 * OpenRouterProvider — handles SSE streaming to OpenRouter chat completions API.
 * Extracted from orchestrator.ts (Component 12, Phase 1).
 *
 * This class is responsible for:
 * - Connecting to OpenRouter with the correct headers and body
 * - Parsing the SSE stream and emitting tokens
 * - Error handling and retry logic
 * - Producing the full response content
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OpenRouterStreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullContent: string, usage?: TokenUsage) => void;
  onError: (error: string) => void;
}

export interface OpenRouterRequest {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxRetries?: number;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MAX_RETRIES = 2;

export class OpenRouterProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Update the API key at runtime (e.g. after user changes it). */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Stream a chat completion from OpenRouter.
   *
   * @param request - Model, messages, and options
   * @param callbacks - Token, done, and error callbacks
   * @param retryCount - Internal retry counter (do not set manually)
   */
  async stream(
    request: OpenRouterRequest,
    callbacks: OpenRouterStreamCallbacks,
    retryCount: number = 0
  ): Promise<void> {
    const maxRetries = request.maxRetries ?? DEFAULT_MAX_RETRIES;

    const openRouterMessages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages,
    ];

    let response: Response;
    try {
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vibeflow.app',
          'X-Title': 'VibeFlow',
        },
        body: JSON.stringify({
          model: request.model,
          messages: openRouterMessages,
          stream: true,
          temperature: request.temperature,
        }),
      });
    } catch (err) {
      // Network error — retry if under limit
      if (retryCount < maxRetries) {
        console.warn(
          `[OpenRouterProvider] Network error, retrying (${retryCount + 1}/${maxRetries}): ${String(err)}`
        );
        await this.delay(1000 * (retryCount + 1));
        return this.stream(request, callbacks, retryCount + 1);
      }
      callbacks.onError(`Network error: ${String(err)}`);
      return;
    }

    if (!response.ok) {
      // HTTP error — retry on 5xx only
      if (response.status >= 500 && retryCount < maxRetries) {
        console.warn(
          `[OpenRouterProvider] Server error ${response.status}, retrying (${retryCount + 1}/${maxRetries})`
        );
        await this.delay(1000 * (retryCount + 1));
        return this.stream(request, callbacks, retryCount + 1);
      }
      callbacks.onError(`OpenRouter error: ${response.status} ${response.statusText}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let lastUsage: TokenUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onDone(fullContent, lastUsage);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content ?? '';
            if (token) {
              fullContent += token;
              callbacks.onToken(token);
            }
            if (parsed.usage) {
              lastUsage = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                totalTokens: parsed.usage.total_tokens ?? 0,
              };
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      // Stream read error — retry if under limit
      if (retryCount < maxRetries) {
        console.warn(
          `[OpenRouterProvider] Stream error, retrying (${retryCount + 1}/${maxRetries}): ${String(err)}`
        );
        await this.delay(1000 * (retryCount + 1));
        return this.stream(request, callbacks, retryCount + 1);
      }
      callbacks.onError(`Stream error: ${String(err)}`);
      return;
    }

    callbacks.onDone(fullContent, lastUsage);
  }

  /** Simple delay utility for retry backoff. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
