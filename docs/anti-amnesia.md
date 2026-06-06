# Anti-Amnesia 設計

MuseEgg Core 不只把記憶放在 prompt 裡。v0.1.0 開始，核心使用 file-based continuity layer，避免常見代理系統的失憶問題。

## 問題

長期代理常見失憶來源：

- 記憶只存在執行期物件，程式重啟後消失。
- 只保存摘要，原始事件被覆蓋。
- UI 沒按儲存，剛生成的記憶沒有落盤。
- LLM provider 自行決定要記什麼，繞過核心規則。
- skill 把上下文塞滿，重要身份與記憶被擠掉。

## MuseEgg 的解法

每個有 `pack.path` 的 OC Pack 都會自動建立：

```text
oc-pack/
  memories.json
  .museegg/
    continuity/
      events.jsonl
      memory-ledger.jsonl
      integrity.json
      snapshots/
        2026-06-06.json
```

## 三層記憶

1. `events.jsonl`

Append-only 原始事件日誌。保存事件、回應、喚醒結果、命中的 guard rules、memory id。

2. `memory-ledger.jsonl`

Append-only 記憶流水帳。每次 `MemoryEngine` 產生記憶，就額外寫入這份 ledger。

3. `memories.json`

目前 Pack 的工作記憶集合。每次產生新記憶後會原子寫入，避免 UI 未儲存造成失憶。

## 重啟恢復

`loadOCPack()` 會讀取：

- `memories.json`
- `.museegg/continuity/memory-ledger.jsonl`

並以 memory id 合併，缺失的記憶會從 ledger 補回。

## 完整性檢查

`ContinuityEngine` 會產生 `integrity.json`，包含：

- `eventJournalSha256`
- `memoryLedgerSha256`
- `memoriesJsonSha256`
- `memoriesCount`

這不是安全簽章，但能讓開發者快速確認 Pack 的記憶層是否有明顯漂移或遺失。

## Provider 邊界

LLM provider 不直接寫記憶。provider 只能回傳候選文字與表情。

記憶寫入由 core 決定：

- `MemoryEngine`
- `GuardEngine`
- `ContinuityEngine`

這樣可以避免 provider 把短期幻覺寫成長期記憶。

## Skill 邊界

v0.1.0 skills 是 instructions，不執行程式碼。

`SkillEngine` 只選出與當前事件相關的 skill，避免把所有 skill 一次塞進 LLM 上下文，降低上下文污染與記憶擠壓。

## 不承諾魔法

MuseEgg Core 不能保證永遠不出錯，但設計原則是：原始事件不丟、記憶自動落盤、重啟可恢復、LLM 不擁有記憶權限。
