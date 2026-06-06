# MuseEgg Life Systems

MuseEgg Core is built as an OC life engine, not a single chat UI. These systems keep an OC stable, inspectable, and safe while still allowing growth.

## Identity Consistency

`IdentityTestEngine` runs a fixed prompt suite against the loaded OC Pack. It checks that the OC uses its configured name, does not drift into generic assistant language, and does not emit Markdown emphasis marks.

Use it before publishing a Pack, after prompt edits, and after changing model routing.

## Memory Trust Layers

Every new memory can carry:

- `layer`: identity, canon, long_term, short_term, observation, or ephemeral
- `confidence`: confirmed, observed, inferred, or speculative
- `status`: candidate, confirmed, deprecated, or rejected
- `confirmRequired`: true when a memory should not become long-term truth yet

Candidate memories are saved, but low-importance unconfirmed memories are not pushed into normal provider context unless the user is asking about recent context or maintenance.

## Self-Rewrite Review

Self-growth proposals remain drafts until approved or applied. `ProposalReviewEngine` can apply skills, lore, reaction rules, and self-rewrite patches while refusing blocked or rejected proposals.

The OC may propose growth, but it must not silently install skills, export private data, delete files, run shell commands, or rewrite identity without review.

## Skill Permission Sandbox

`SkillPermissionEngine` filters skills before they enter provider context.

Allowed permissions include memory, lore, proposal, Telegram reply, scheduler, asset read, folder index read, and network request when runtime allows outbound access.

Blocked permissions include deleting files, reading private data, exporting private data, running system commands, installing plugins, or writing outside the Pack.

## Response Quality

`ResponseQualityEngine` reports identity drift, generic assistant drift, private data risk, destructive action risk, incomplete responses, unsupported claims, and Markdown emphasis marks.

Quality reports are attached to `OCProcessResult` and can be shown in event timelines or written into continuity logs.

## Growth Journal

`GrowthJournalEngine` writes daily JSONL entries under:

```text
.museegg/growth-journal/YYYY-MM-DD.jsonl
```

The journal records event summaries, response summaries, memory ids, proposal ids, and quality signals.

## Expression Image Binding

Optional `asset-bindings.json` maps expressions to character images:

```json
[
  {
    "id": "asset-binding-default",
    "expression": "柔和微笑",
    "fileName": "default.png",
    "enabled": true,
    "priority": 50
  }
]
```

`CharacterView` uses the active awakening or response expression to pick the matching image. If no binding exists, it falls back to the core visual.

## Fixed Folder Index

MuseEgg indexes the currently installed OC Pack folder. It does not scan the whole computer and does not let the runtime switch to arbitrary folders.

`runtime.json` keeps index limits and filters:

```json
{
  "folderIndex": {
    "enabled": true,
    "roots": [],
    "maxFiles": 2000,
    "includeExtensions": [".md", ".txt", ".json", ".png", ".jpg", ".jpeg", ".webp"],
    "excludePatterns": ["node_modules", ".git", ".museegg/backups", ".museegg/memory"],
    "refreshIntervalMinutes": 60
  }
}
```

`roots` is retained for older Pack compatibility, but v0.1 reads from the Pack installation path instead. The index records file names and metadata, not full contents. If the OC needs content that is not inside its installed Pack folder, it should say it cannot see it.

## Pack Health

`PackHealthEngine` combines schema validation, identity tests, private data scanning, asset binding checks, and skill permission audits.

Use it before exporting or publishing a Pack.

## Backup And Rollback

Saving a Pack creates snapshots under:

```text
.museegg/backups/YYYYMMDDHHMMSS/
```

`listPackBackups()` lists snapshots and `restorePackBackup()` restores core Pack files and prompts.

## Telegram Experience

The Telegram adapter supports polling, typing actions, mention/reply gates, allow lists, text messages, captioned images, image metadata events, and long response splitting.

Bot tokens stay in local settings or environment variables and must not be placed in OC Packs.
