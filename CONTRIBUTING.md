# Contributing To MuseEgg Core

Thank you for helping build an open OC life engine.

## Project Principles

- Preserve creator ownership of OC identity, lore, assets, and rules.
- Keep core logic shared across platforms.
- Treat desktop, Telegram, file watchers, and future channels as adapters.
- Do not hard-wire the first AI provider into the core.
- Keep v0.x changes small, readable, and easy to review.

## Local Setup

```bash
npm install
npm run build
npm run dev
```

## Package Boundaries

- `packages/oc-schema`: shared OC Pack types and schema.
- `packages/core`: event, memory, lore, guard, reaction, awakening, autonomy, response, routing, pack IO, plugins, reports.
- `packages/adapters`: platform adapters.
- `packages/ui`: reusable React primitives.
- `apps/desktop`: Electron and React OC Studio.

## Pull Requests

Before opening a PR:

1. Run `npm run build`.
2. Keep unrelated formatting churn out of the diff.
3. Update README or docs when changing OC Pack behavior.
4. Add or update example Pack fields when changing schema expectations.

## Security Notes

- Renderer code must not use Node `fs`.
- File IO must go through Electron IPC.
- Telegram bot tokens must not be printed or shown in plaintext in the UI.
- New adapters should route events through `packages/core`.
