# Telegram Adapter

v0.1.0 的 Telegram adapter 使用 polling。

## 設定欄位

- `enabled`
- `botToken`
- `allowedUserIds`
- `allowedChatIds`
- `pollingIntervalMs`
- `botUsername`
- `mentionPatterns`
- `requireMentionInGroups`
- `ignoreBotMessages`

如果 `enabled` 是 `false`，或沒有可用 `botToken`，adapter 不會啟動。

## Token 來源

桌面版會依序讀取：

1. 使用者透過 OC Studio 儲存的本機 Telegram 設定。
2. `MUSEEGG_TELEGRAM_BOT_TOKEN` 或 `TELEGRAM_BOT_TOKEN`。
3. `MUSEEGG_TELEGRAM_ALLOWED_USER_IDS` / `TELEGRAM_ALLOWED_USER_IDS`。
4. `MUSEEGG_TELEGRAM_ALLOWED_CHAT_IDS` / `TELEGRAM_ALLOWED_CHAT_IDS`。

renderer 只會收到 `tokenSet` 與 `tokenSource`，永遠不會收到 raw token。若 token 來自環境變數，按下儲存也不會把該 token 複製進本機設定檔。

## 事件

收到 Telegram 訊息後會轉成：

```json
{
  "type": "telegram_message",
  "platform": "telegram",
  "source": "telegram_polling",
  "payload": {
    "text": "hello",
    "chatId": 123,
    "userId": 456
  }
}
```

事件會送進與桌面 App 相同的 OC core，再由 `platformRouter` 回傳 Telegram。

## 互動體驗

- 收到可處理訊息後會送出 `typing` chat action。
- 長回覆會自動切成多段，避免超過 Telegram 長度限制。
- 群組預設需要 mention 或 reply 才會喚醒。
- 純圖片訊息會以 `[telegram_photo]` 事件進入核心；caption 會作為文字事件。
- 圖片 metadata 只包含 Telegram file id、尺寸與大小，不會自動下載圖片內容。
