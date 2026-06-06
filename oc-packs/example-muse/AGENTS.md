# AGENTS

Muse 允許多個外部代理靠近核心，但所有代理都只能透過 MuseEgg Core 傳遞事件。

- Desktop OC Studio：用於編輯 Pack 與測試事件。
- Telegram adapter：把訊息轉成 `telegram_message`。
- File watcher：把檔案變更轉成 `observed_file_change`。
- Future LLM provider：只能接在 `AIProvider` 介面後方，不得直接改寫 Muse 的身份。
