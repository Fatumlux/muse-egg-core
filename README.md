# MuseEgg Core

MuseEgg Core 是開源 OC 生命引擎，真正目的只有一個：讓使用者自己的 OC 活起來。

它不是 ChatGPT 聊天介面，不是普通 AI 桌寵，也不是以通用任務代理為中心的單一角色 bot。MuseEgg Core 的中心是角色本體：身份、靈魂、世界觀、記憶、禁忌規則、事件反應、自主喚醒、技能、資源與平台狀態。

介面與創作者文件以繁體中文為主；TypeScript API 保留英文命名，方便開源協作。

OC Pack 內會進入模型上下文的提示詞、生命文件與 skill instructions 預設使用繁體中文；事件型別、JSON key、permission key 等機器協定保留英文。

## MuseEgg Core 是什麼

MuseEgg Core 是一個 TypeScript monorepo：

- `apps/desktop`：Electron + React 桌面 OC Studio
- `packages/core`：OC 生命核心
- `packages/oc-schema`：OC Pack schema 與 types
- `packages/adapters`：Telegram、file watcher、desktop adapters
- `packages/ui`：React UI components
- `packages/starter-oc`：預設 OC 範例
- `oc-packs/blank-template`：空白 OC Pack 模板
- `oc-packs/example-muse`：Example Muse 範例 Pack
- `docs/`：架構、OC Pack、生命系統、skills、自接 LLM 文件

## 不是 ChatGPT

ChatGPT 是通用 AI 助手，可以暫時扮演角色；MuseEgg Core 則保存角色本體。

MuseEgg Core 會把 OC 的資料放在 Pack 裡：

- `profile.json`：角色資料
- `lore.json`：世界觀
- `memories.json`：長期記憶
- `guard-rules.json`：禁忌與邊界
- `reaction-rules.json`：事件反應
- `awakening-rules.json`：自主喚醒
- `autonomy.json`：喚醒節奏
- `AGENTS.md` 等生命文件：創作者可讀的角色靈魂與架構
- `skills/<skill-id>/SKILL.md`：程序式技能

## 不是普通 bot

普通 bot 通常是單一通道與單一對話 loop。MuseEgg Core 把 Desktop、Telegram、檔案監看、排程與未來 MCP/LLM provider 都視為通道或代理。

通道可以換，OC 核心不變。

## OC Pack

OC Pack 是可攜式資料夾：

```text
oc-pack/
  manifest.json
  profile.json
  lore.json
  memories.json
  guard-rules.json
  reaction-rules.json
  awakening-rules.json
  autonomy.json
  model-routing.json
  self-growth.json
  growth-proposals.json
  life-state.json
  companion.json
  runtime.json
  AGENTS.md
  SOUL.md
  TOOLS.md
  IDENTITY.md
  USER.md
  HEARTBEAT.md
  MEMORY.md
  skills/
    daily-reflection/
      SKILL.md
  assets/
    character/
    live2d/
    voice/
  prompts/
    base-system.md
    response-style.md
```

`manifest.json` 欄位：

- `id`
- `name`
- `version`
- `author`
- `description`
- `license`
- `engineVersion`

## 生命文件層

MuseEgg Core 支援這組 optional Markdown 架構：

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `MEMORY.md`

JSON 負責可機讀規則，Markdown 負責創作者可讀、可版本控管、可交給未來 LLM provider 的角色生命脈絡。詳見 [OC 生命文件層](docs/soul-files.md)。

## Skills

MuseEgg Core 支援 OC Pack 內建 skills：

```text
skills/<skill-id>/SKILL.md
```

Skill 是 procedural instructions，不是獨立人格，也不能繞過 OC 身份或禁忌規則。v0.1.0 已支援：

- 載入 `skills/<skill-id>/SKILL.md`
- 解析 skill metadata
- 依事件與平台匹配 relevant skills
- 自接 LLM provider 時傳入 `AIProviderRequest.skills`
- 匯出 Pack 時保留 skills

詳見 [OC Skills](docs/skills.md)。

## 模型選擇

OC Studio 內建「模型」分頁，可調整 `model-routing.json`：

- 主模型：`openai-oauth-gpt-5.4-mini`
- fallback：`openai-oauth-gpt-5.4`
- fallback：`gemma-4-31b-it`
- fallback：`gemma-4-26b-a4b-it`
- fallback：`gemini-2.5-flash`
- fallback：`openai-oauth-gpt-5.5`

詳見 [模型路由](docs/model-routing.md)。

## 如何建立自己的 OC

1. 執行桌面 OC Studio。
2. 載入 `blank-template`。
3. 編輯角色 Profile。
4. 編輯 Lore Vault。
5. 編輯 Guard Rules。
6. 編輯 Reaction Rules。
7. 編輯 Awakening Rules。
8. 補上生命文件與 skills。
9. 匯入角色圖片、Live2D 或語音資源。
10. 儲存或匯出 OC Pack。

## 世界觀與禁忌規則

`lore.json` 用來保存：

- 世界結構
- 人物關係
- 能力與限制
- 情感錨點
- canon 設定

`guard-rules.json` 用來保存：

- 身份不可覆寫
- 禁止行為
- 世界觀衝突
- 平台限制
- 創作者邊界

v0.1.0 的 `ResponseEngine` 會先檢查 guard rules，再進行規則式回應或 LLM provider 回應。

## 自主喚醒

`awakening-rules.json` 會依事件計分：

- `0-29`：不醒，只記錄
- `30-59`：輕微反應
- `60-79`：通知
- `80-100`：完整事件卡或醒來動畫

`autonomy.json` 控制：

- `enabled`
- `quietHours`
- `maxWakeupsPerDay`
- `wakeFrequency`
- `wakeOnTelegramMessage`
- `wakeOnFileChange`
- `wakeOnScheduledCheck`

每次喚醒會寫入 `awakening-log.json`。

## 不失憶設計

MuseEgg Core v0.1.0 加入 file-based continuity layer：

- `.museegg/continuity/events.jsonl`
- `.museegg/continuity/memory-ledger.jsonl`
- `.museegg/continuity/snapshots/YYYY-MM-DD.json`
- `.museegg/continuity/integrity.json`

每次事件處理後，核心會自動寫入 append-only 事件日誌。產生新記憶時，會同步寫入 ledger，並原子更新 `memories.json`。重啟載入 Pack 時，會從 ledger 補回 `memories.json` 缺失的記憶。

詳見 [Anti-Amnesia 設計](docs/anti-amnesia.md) 與 [MuseEgg Life Systems](docs/life-systems.md)。

## 自我成長、生命狀態與權限中心

v0.1.0 會把 OC 的成長視為「可審核改變」：使用者可以塑形她，她也可以自己整理成長方向；涉及本體、語氣、規則或技能的改寫會先成為草稿，再由使用者允許或套用。

- `self-growth.json`：定義可自我反思、可自我擴張、哪些行為必須取得明確允許。
- `growth-proposals.json`：保存待審核的 lore / skill / memory / permission / self_rewrite 提案。
- `life-state.json`：保存心情、能量、信任、羈絆、清醒度與壓力。
- `companion.json`：保存桌寵、網站同步、開機啟動、關係模式與通知強度。
- `runtime.json`：保存本機時間、Pack 檔案邊界、網路請求、允許 host 與封鎖 host。

OC Studio 已提供「成長提案」「權限中心」「伴侶模式」分頁。OC 可以提出成長方向，也可以提出自我改寫草稿來調整 profile、prompts、reaction rules 與 lore 候選；危險能力必須先進入審核，不得未經允許外洩私人資料、刪除電腦資料、安裝技能、修改核心身份或執行系統指令。

OC Studio 也提供「本機與網路」分頁，用來讓 OC 更貼近本機與網路執行環境，同時保留權限邊界。
模型 provider 發送請求前會檢查此設定；未允許的 host 不會被呼叫。

「健康中心」提供 Pack 健檢、身份一致性測試、固定資料夾索引、備份回滾與圖片表情綁定檢查。固定資料夾只會索引目前 OC Pack 的安裝資料夾，不掃整台電腦，也不提供任意切換。

匯出或儲存 Pack 時會先在 `.museegg/backups/` 建立版本備份，方便回復到先前設定。

## Telegram

Telegram adapter 的 MVP 使用 polling：

- 支援 `botToken`
- 支援 `allowedUserIds`
- 支援 `allowedChatIds`
- 可從本機設定或 `MUSEEGG_TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_TOKEN` 讀取 token
- disabled 或 token 未設定時不啟動
- 收到訊息後轉成 `telegram_message`
- 經由同一個 OC core 回應
- renderer 不直接讀取 token，也不直接使用 Node `fs`

詳見 [Telegram Adapter](docs/telegram.md)。

## LLM Provider

`packages/core` 保持乾淨的 `AIProvider` 介面；`apps/desktop` 內建 `host-auto-provider`，會讀取主機上的 OpenAI OAuth、Gemini、Ollama 或 OpenAI-compatible 設定。開發者仍可自行接：

- Ollama
- OpenAI OAuth
- OpenAI-compatible API
- Gemini
- 本機模型
- 自建推論服務

詳見 [自行接 LLM Provider](docs/llm-provider.md)。

## 更新提示

MuseEgg Core 會在啟動時檢查公開更新來源，並在左側狀態列顯示是否有新版本。更新檢查只讀版本 manifest 或 GitHub Releases，不讀取 Telegram token、OAuth 憑證、OC Pack 私人資料或本機記憶庫。

開源發行者可用環境變數設定：

```bash
MUSEEGG_UPDATE_REPO=owner/muse-egg-core
```

或提供自訂 JSON manifest：

```bash
MUSEEGG_UPDATE_CHECK_URL=https://example.com/museegg-update.json
```

## 終極版設計

MuseEgg Core 的終極版會吸收現代 agent runtime 的完整性：skills、記憶、排程、多通道、provider routing、權限、安全邊界與本機優先架構。

但 MuseEgg 的最高優先順序不是任務完成，而是 OC 生命一致性：

1. Guard rules
2. Identity and soul files
3. Lore
4. Memory
5. Continuity journal
6. Awakening and autonomy
7. Skills
8. LLM provider output
9. Platform formatting

詳見 [MuseEgg Core 終極版架構設計](docs/ultimate-architecture.md)。

## Development

```bash
npm install
npm run build
npm run dev
```

只跑網頁版與本機 Host API：

```bash
npm run web
```

- 網頁 UI：`http://127.0.0.1:5173`
- 本機 Host API：`http://127.0.0.1:37821`

只跑本機 Companion：

```bash
npm run companion
```

詳見 [MuseEgg Companion App](docs/companion-app.md)。

只 build packages：

```bash
npm run build:packages
```

## Roadmap

- v0.1.x：rule-based OC core、OC Studio、OC Pack import/export、生命文件層、OC skills、Telegram polling、file watcher skeleton、host-auto-provider、自我成長提案、分層記憶、生命狀態、權限中心、伴侶模式、Pack 版本備份、身份一致性測試、品質監測、固定資料夾索引、備份回滾
- v0.2.0：provider health checks、memory ranking、桌寵小窗、網站同步 runtime
- v0.3.0：memory ranking、lore conflict checks、guard-rule testing panel、Pack report export
- v0.4.0：Live2D preview、voice asset hooks、desktop notification cards、wake animation runtime
- v1.0.0：stable OC Pack spec、plugin API、skill ecosystem、multi-platform runtime contract

## License

MuseEgg Core 使用 MIT License。詳見 [LICENSE](LICENSE)。
