# 自行接 LLM Provider

MuseEgg Core v0.1.0 的 core package 只依賴 `AIProvider` 介面；桌面 App 另外提供 `host-auto-provider`，會自動嘗試主機上的 OpenAI OAuth、Gemini、Ollama 與 OpenAI-compatible 設定。這樣 core 仍保持乾淨可嵌入，桌面版則能直接使用本機已有憑證。

開發者也可以自行接 Ollama、OpenAI-compatible、Gemini、本機模型或自己的推論服務。

## 桌面版自動 provider

- OpenAI OAuth：模型 ID 使用 `openai-oauth-` 前綴，token 來源為環境變數或 `.codex/auth.json`，送 API 時移除此前綴。
- Gemini：模型 ID 使用 `gemini-` 前綴，讀取 `GEMINI_API_KEY`、`GOOGLE_API_KEY` 或 `MUSEEGG_GEMINI_API_KEY`。
- Ollama：Gemma 路由預設連到 `http://127.0.0.1:11434`。
- OpenAI-compatible：設定 `MUSEEGG_OPENAI_COMPATIBLE_BASE_URL`、`OPENAI_BASE_URL` 或 `LLM_BASE_URL` 後可接其他相容服務。

## 介面

`AIProvider` 定義在 `@muse-egg/oc-schema`：

```ts
export interface AIProvider {
  id: string;
  displayName: string;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}
```

`AIProviderRequest` 會拿到：

- `pack`
- `event`
- `model`
- `memories`
- `lore`
- `guardRules`
- `skills`
- `context`

`context` 是短期上下文快照，包含目前事件、最近訊息、runtime 設定與安全備註。自接 provider 時應先使用 `request.context` 理解「剛才、上面、那個、這件事」等指涉，再參照長期記憶與世界觀。

## 最小範例

```ts
import { loadOCPack, OCEngine } from "@muse-egg/core";
import type { AIProvider } from "@muse-egg/oc-schema";

const myProvider: AIProvider = {
  id: "my-local-llm",
  displayName: "My Local LLM",
  async generate(request) {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.model ?? "my-model",
        prompt: [
          request.pack.prompts.baseSystem,
          request.pack.soulFiles?.["IDENTITY.md"] ?? "",
          request.pack.soulFiles?.["SOUL.md"] ?? "",
          request.skills?.map((skill) => skill.instructions).join("\n\n") ?? "",
          request.context?.notes.join("\n") ?? "",
          request.context?.recentMessages
            .map((message) => `${message.speaker}: ${message.text}`)
            .join("\n") ?? "",
          `使用者事件：${JSON.stringify(request.event.payload)}`
        ].join("\n\n")
      })
    });

    const data = await response.json() as { response?: string };
    return {
      text: data.response ?? "核心有反應，但 provider 沒有回傳文字。",
      expression: request.pack.profile.defaultExpression
    };
  }
};

const pack = await loadOCPack("./oc-packs/example-muse");
const engine = new OCEngine(pack, { aiProvider: myProvider });

const result = await engine.processEvent({
  type: "user_message",
  platform: "desktop",
  payload: { text: "你好" }
});

console.log(result.response?.text);
```

## 安全建議

- 不要把 API key 寫進 OC Pack。
- provider 應該讀取環境變數或使用者本機設定。
- 送給 LLM 前仍要保留 guard rules。
- 送給 LLM 的 skills 應該只取 `request.skills`，不要把所有技能一次塞入上下文。
- LLM 回應不應覆寫 `profile.json`、`IDENTITY.md` 或高優先世界觀。
- Desktop renderer 不應直接呼叫本機檔案或讀取 token。
