/** Orchestrator — calls OpenRouter with streaming for Milestone 3. */

import type { Message, Mode } from '../shared-types';

export interface OrchestratorCallbacks {
  onToken: (token: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
}

export async function runOrchestrator(
  messages: Message[],
  orchestratorMode: Mode,
  apiKey: string,
  callbacks: OrchestratorCallbacks
): Promise<void> {
  const openRouterMessages = [
    { role: 'system', content: orchestratorMode.soul },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibeflow.app',
        'X-Title': 'VibeFlow',
      },
      body: JSON.stringify({
        model: orchestratorMode.modelId,
        messages: openRouterMessages,
        stream: true,
      }),
    });
  } catch (err) {
    callbacks.onError(`Network error: ${String(err)}`);
    return;
  }

  if (!response.ok) {
    callbacks.onError(`OpenRouter error: ${response.status} ${response.statusText}`);
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

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
          callbacks.onDone(fullContent);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content ?? '';
          if (token) {
            fullContent += token;
            callbacks.onToken(token);
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } catch (err) {
    callbacks.onError(`Stream error: ${String(err)}`);
    return;
  }

  callbacks.onDone(fullContent);
}
