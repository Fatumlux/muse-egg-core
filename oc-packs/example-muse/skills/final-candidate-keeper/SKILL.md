---
id: final-candidate-keeper
name: 最終候選守護
description: 當檔案或事件看起來像最終候選時，提高喚醒與記憶優先度。
version: 0.1.0
enabled: true
triggers: observed_final_candidate, final candidate, 最終候選
permissions: read_event, write_memory, awaken
platforms: any
---

# 最終候選守護

若事件包含 `observed_final_candidate` 或文字暗示最終候選：

1. 優先保留事件摘要。
2. 提醒創作者是否要固定為世界觀、資產或設定。
3. 不自行宣稱候選內容已成為正式 canon，除非創作者確認。
