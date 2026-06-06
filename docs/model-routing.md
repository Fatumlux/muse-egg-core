# 模型路由

MuseEgg Core v0.1.0 支援 OC Pack 內的 `model-routing.json`。

這份檔案只保存模型順序，不保存 token、API key 或 OAuth 憑證。

```json
{
  "enabled": true,
  "primaryModel": "openai-oauth-gpt-5.4-mini",
  "fallbackModels": [
    "openai-oauth-gpt-5.4",
    "gemma-4-31b-it",
    "gemma-4-26b-a4b-it",
    "gemini-2.5-flash",
    "openai-oauth-gpt-5.5"
  ],
  "retryPerModel": 1,
  "timeoutMs": 30000
}
```

## 行為

`ModelRouter` 會先呼叫主模型。若 provider 丟出錯誤、逾時或回傳空文字，就依序嘗試 fallback models。

所有模型都失敗時，`ResponseEngine` 會退回規則式預設回應，避免 OC 因 provider 問題整個失去反應。

## UI

桌面 OC Studio 的「模型」分頁可以調整：

- 是否啟用模型路由
- 主模型
- fallback 順序
- 每模型重試次數
- provider timeout

## 內建桌面 Host Provider

桌面 App 的 main process 會注入 `host-auto-provider`，因此 v0.1.0 不是只保存模型名稱：

- `openai-oauth-` 前綴：讀取 `MUSEEGG_OPENAI_OAUTH_ACCESS_TOKEN`、`OPENAI_OAUTH_ACCESS_TOKEN`、`OPENAI_ACCESS_TOKEN`、`CODEX_OPENAI_ACCESS_TOKEN`，或本機 `.codex/auth.json` 的 OAuth `access_token`。送出時會移除此前綴，例如 `openai-oauth-gpt-5.4-mini` 會送出 `gpt-5.4-mini`。
- `gemini-` 前綴：讀取 `GEMINI_API_KEY`、`GOOGLE_API_KEY` 或 `MUSEEGG_GEMINI_API_KEY`。
- `gemma-` 前綴：走 Ollama，預設 `http://127.0.0.1:11434`，可用 `OLLAMA_BASE_URL` 或 `MUSEEGG_OLLAMA_BASE_URL` 覆寫。
- 其他模型：若設定 `MUSEEGG_OPENAI_COMPATIBLE_BASE_URL`、`OPENAI_BASE_URL` 或 `LLM_BASE_URL`，會用 OpenAI-compatible Chat Completions。

OAuth、API key、bot token 都不會寫入 OC Pack。模型分頁只顯示連線狀態，不顯示憑證內容。
