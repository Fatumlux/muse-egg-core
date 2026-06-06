# OC Pack Specification

An OC Pack is a folder that can be loaded by MuseEgg Core.

Required files:

- `manifest.json`
- `profile.json`
- `lore.json`
- `memories.json`
- `guard-rules.json`
- `reaction-rules.json`
- `awakening-rules.json`
- `autonomy.json`
- `model-routing.json`
- `self-growth.json`
- `growth-proposals.json`
- `life-state.json`
- `companion.json`
- `runtime.json`
- `asset-bindings.json` is optional
- `prompts/base-system.md`
- `prompts/response-style.md`

Optional soul files:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `MEMORY.md`

Optional skills:

- `skills/<skill-id>/SKILL.md`

Required asset folders:

- `assets/character`
- `assets/live2d`
- `assets/voice`

Optional asset bindings:

- `asset-bindings.json` maps character image files to expressions used by the UI.

Soul files are loaded into `pack.soulFiles` when present. See [OC 生命文件層](soul-files.md).

Skills are loaded into `pack.skills` when present. See [OC Skills](skills.md).

Self-growth files:

- `self-growth.json` defines which growth actions are allowed, blocked, or require explicit permission, including self rewrite proposals.
- `growth-proposals.json` stores pending / approved / rejected / applied growth proposals, including `self_rewrite` drafts for profile, prompts, reaction rules, and lore candidates.
- `life-state.json` stores mood, energy, trust, bond, wakefulness, stress, and a short state summary.
- `companion.json` stores desktop pet, website sync, startup, relationship mode, and notification settings.
- `runtime.json` stores local time, locale, Pack file boundaries, network request policy, allowed hosts, blocked hosts, context window settings, fixed folder index settings, quality checks, and update checks.

Runtime continuity files are created lazily:

- `.museegg/continuity/events.jsonl`
- `.museegg/continuity/memory-ledger.jsonl`
- `.museegg/continuity/integrity.json`
- `.museegg/continuity/snapshots/YYYY-MM-DD.json`

Pack export creates version backups before writing:

- `.museegg/backups/<timestamp>/`

Growth journal files are created lazily:

- `.museegg/growth-journal/YYYY-MM-DD.jsonl`

See [Anti-Amnesia 設計](anti-amnesia.md) and [MuseEgg Life Systems](life-systems.md).

## Event Types

MuseEgg Core v0.1.0 supports:

- `user_message`
- `training_input`
- `lore_update`
- `guard_rule_update`
- `oc_pack_imported`
- `oc_pack_exported`
- `observed_file_change`
- `observed_final_candidate`
- `scheduled_daily_reflection`
- `scheduled_weekly_report`
- `telegram_message`
- `custom_event`

## Rule Triggers

Rule triggers can match:

- an event type, such as `telegram_message`
- an event-prefixed type, such as `event:observed_file_change`
- text contained in the event payload
- `any`
