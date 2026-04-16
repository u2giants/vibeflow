/**
 * Orchestrator — backward-compatible wrapper around OpenRouterProvider.
 *
 * Component 12, Phase 1: The SSE streaming logic has been extracted into
 * OpenRouterProvider. This function wraps it to preserve the existing IPC
 * interface (conversations:sendMessage) during the strangler-pattern transition.
 *
 * Once the new OrchestrationEngine is proven, this wrapper will be removed.
 */

import type { Message, Mode } from '../shared-types';
import { OpenRouterProvider, type OpenRouterStreamCallbacks } from '../providers/openrouter-provider';

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
  const provider = new OpenRouterProvider(apiKey);

  const streamCallbacks: OpenRouterStreamCallbacks = {
    onToken: callbacks.onToken,
    onDone: callbacks.onDone,
    onError: callbacks.onError,
  };

  await provider.stream(
    {
      model: orchestratorMode.modelId,
      systemPrompt: orchestratorMode.soul,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: orchestratorMode.temperature,
    },
    streamCallbacks
  );
}
