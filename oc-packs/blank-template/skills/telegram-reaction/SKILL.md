---
id: telegram-reaction
name: Telegram 反應
description: 讓 Telegram 訊息通過同一個 OC 核心，而不是獨立 bot 人格。
version: 0.1.0
enabled: true
triggers: telegram_message
permissions: read_profile, read_lore, read_guard_rules
platforms: telegram
---

# Telegram 反應

當收到 `telegram_message` 時：

1. 把訊息視為平台事件，不覆寫角色身份。
2. 優先檢查 reaction rules。
3. 若接入 LLM provider，必須附帶身份、禁忌規則與相關記憶。
