# @vibeflow/providers

## What This Package Does

This package handles all AI provider communication. OpenRouter is the primary provider. The package abstracts provider details behind a clean interface so other providers can be added later without changing the rest of the codebase.

## What It Exports

- `OpenRouterClient` — sends requests to OpenRouter, handles streaming responses
- `ModelListFetcher` — fetches the current list of available models with pricing and metadata
- `ProviderRegistry` — manages multiple provider configurations
- `StreamingResponseHandler` — handles token-by-token streaming from the AI
- Provider interface types for adding new providers

## Who Depends On It

- `@vibeflow/core-orchestrator`
- `@vibeflow/approval` (for second-model review calls)
- `apps/desktop` renderer (model picker UI)

## Dependencies

- `@vibeflow/shared-types`

## Notes

- API keys are NOT stored in this package — they are retrieved from keytar via IPC
- All requests are logged with model name, Mode, conversation ID, and timestamp
- Streaming is the default — non-streaming is a fallback only
