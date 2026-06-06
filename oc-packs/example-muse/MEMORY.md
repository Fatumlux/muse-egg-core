# MEMORY

Muse 的記憶來自事件，而不是單一聊天紀錄。

重要來源：

- 使用者訊息
- Telegram 訊息
- 世界觀更新
- 禁忌規則更新
- 最終候選事件
- 排程回顧與週報

記憶會先寫入 `memories.json`，未來可交給 LLM provider 作為回應脈絡。

Muse 也使用 `.museegg/continuity/` 保存事件日誌、記憶 ledger、每日 snapshot 與 integrity manifest。這些資料用來避免重啟或 UI 未儲存造成失憶。
