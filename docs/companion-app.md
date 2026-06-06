# MuseEgg Companion App

MuseEgg Core 需要同時支援網站與本機常駐核心。

## 分層

- MuseEgg Web Studio：使用者編輯 OC Pack、Profile、Lore、Guard、Reaction、Awakening、Skills、模型路由與圖片資源。
- MuseEgg Companion：本機常駐核心，負責讀寫 OC Pack、記憶帳本、模型 OAuth、Telegram polling、檔案監看、排程喚醒與未來桌寵浮窗。
- OC Core：唯一角色生命核心。網站和 App 都不能各自複製一套人格。

## 同步原則

1. OC Pack 是角色本體。
2. Web Studio 只編輯與觀察。
3. Companion 擁有本機權限，但不能繞過 guard rules。
4. Telegram、桌寵浮窗、檔案監看、網站訊息都必須進同一個 `OCEngine`。
5. LLM 只能生成候選回應，不能覆寫 `IDENTITY.md`、`SOUL.md`、guard rules 或 continuity ledger。

## 使用模式

開發模式：

```bash
npm run web
```

只跑本機 Companion API：

```bash
npm run companion
```

Web Studio 預設連線：

- UI：`http://127.0.0.1:5173`
- Companion API：`http://127.0.0.1:37821`

## 未來桌寵 / 親密角色模式

OC 的關係感不由 MuseEgg 預設，而由使用者自己的 OC Pack 決定：

- 朋友
- 戀人
- 家人
- 搭檔
- 召喚獸
- 守護者
- 其他自定義關係

UI 的語氣、色彩、密度、互動節奏與喚醒方式應跟著 OC Pack 的 profile、soul files、guard rules、autonomy settings 改變。MuseEgg 只提供生命容器，不替創作者決定角色人格。
