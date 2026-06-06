# Context Window

MuseEgg Core uses a short-term context window in addition to long-term memory.

Long-term memory answers: what should this OC remember across restarts?

Context window answers: what just happened in this conversation or channel?

This avoids a common agent-runtime problem where the OC has durable memory but still responds to every message as if it were isolated.

## What It Stores

`ContextWindowEngine` keeps recent event and response pairs in memory while the engine is running:

- user messages
- Telegram messages
- system events that have readable text
- OC responses

It does not replace `memories.json`, the SQLite vector memory store, or `.museegg/continuity`.

## Provider Contract

When an AI provider is used, `ResponseEngine` passes `AIProviderRequest.context`.

The provider receives:

- `currentEvent`
- `recentMessages`
- `notes`
- `limits`

Providers should read this before long-term memories when resolving references such as:

- 剛才
- 上面
- 前面
- 那個
- 這件事
- 繼續

## Runtime Settings

`runtime.json` controls context behavior:

```json
{
  "context": {
    "enabled": true,
    "maxRecentEvents": 12,
    "maxPromptChars": 6000,
    "includeRuntimeEnvironment": true,
    "includeLifeState": true
  }
}
```

## Boundary

The context window is local runtime state. It is not a cloud sync feature and is not a public publishing feature.

GitHub publishing is a maintainer workflow for this repository. Ordinary MuseEgg users do not need to push to GitHub to use their OC Pack.
