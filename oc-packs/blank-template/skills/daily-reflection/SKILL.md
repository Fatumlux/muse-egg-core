---
id: daily-reflection
name: 每日自省
description: 在每日排程事件中整理 OC 當天的記憶與狀態。
version: 0.1.0
enabled: true
triggers: scheduled_daily_reflection
permissions: read_memory, write_memory
platforms: scheduler, desktop
---

# 每日自省

當收到 `scheduled_daily_reflection` 時：

1. 檢查今日重要記憶。
2. 保留符合角色身份的事件。
3. 避免違反 `guard-rules.json`。
4. 產生短句式內在回應或記憶摘要。
