# OC 生命文件層

MuseEgg Core v0.1.0 支援一組 optional Markdown 文件。它們不是取代 JSON，而是補上創作者可讀、可版本控管、可交給未來 LLM provider 的角色生命脈絡。

支援檔案：

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `MEMORY.md`

## 與 JSON 的分工

JSON 是可機讀規則：

- `profile.json`：角色基本資料
- `lore.json`：世界觀條目
- `memories.json`：事件記憶
- `guard-rules.json`：禁忌與邊界
- `reaction-rules.json`：規則式反應
- `awakening-rules.json`：喚醒分數
- `autonomy.json`：自主喚醒節奏

Markdown 是可讀的生命文件：

- `AGENTS.md`：哪些代理、平台、provider 可以接觸核心
- `SOUL.md`：角色靈魂、存在感與不可替代的本質
- `TOOLS.md`：可用工具與事件來源
- `IDENTITY.md`：角色是誰、不是誰
- `USER.md`：創作者與互動者邊界
- `HEARTBEAT.md`：喚醒節奏與心跳規則
- `MEMORY.md`：記憶策略與保護規則

## Loader 行為

`loadOCPack()` 會讀取這些檔案並放入 `pack.soulFiles`。

`saveOCPack()` 與 `exportOCPack()` 會在 `pack.soulFiles` 存在時寫回同名檔案。

這代表創作者可以只用 JSON 跑 MVP，也可以加上生命文件讓 OC Pack 更完整。
