# OC Skills

MuseEgg Core skills 是安裝在 OC Pack 裡的程序式提示與工作流程。

它們參考 agent skill system 的結構，但 MuseEgg skills 的作用範圍只在 OC 生命核心內。Skill 不能替換 OC 身份、繞過禁忌規則，也不能變成獨立 bot。

## Location

```text
oc-pack/skills/<skill-id>/SKILL.md
```

## Frontmatter

```md
---
id: telegram-bridge
name: Telegram 星橋
description: 把 Telegram 訊息接到同一個 OC 生命核心。
version: 0.1.0
enabled: true
triggers: telegram_message, telegram
permissions: read_profile, read_lore, send_message
platforms: telegram
---
```

## Runtime

`loadOCPack()` 會把 skills 載入 `pack.skills`。

`SkillEngine.relevantTo(event)` 會回傳符合條件、已啟用，且通過 `SkillPermissionEngine` 的 skills：

- 事件類型
- 文字 trigger
- 平台

當開發者自行接 LLM provider 時，`ResponseEngine` 會把 relevant skills 放進 `AIProviderRequest.skills`。

## Permission Sandbox

允許的低風險權限包含：

- `read_event`
- `read_profile`
- `read_pack`
- `read_memory`
- `write_memory`
- `read_lore`
- `read_guard_rules`
- `write_proposal`
- `telegram_reply`
- `send_message`
- `scheduler`
- `file_index_read`
- `asset_read`
- `network_request`

高風險權限會被擋下，不會進入 provider context：

- `delete_file`
- `write_outside_pack`
- `read_private_data`
- `export_private_data`
- `run_system_command`
- `install_plugin`

## Security

v0.1.0 skills 只是提示與程序指令，不執行程式碼。

未來若加入可執行 skills，必須包含：

- permission declarations
- sandboxing
- install-time review
- prompt-injection resistance
- token and file access boundaries
