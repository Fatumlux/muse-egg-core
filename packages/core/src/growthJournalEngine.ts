import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { OCGrowthJournalEntry, OCPack, OCProcessResult, OCQualitySignal } from "@muse-egg/oc-schema";
import { createId, getEventText, nowIso } from "./utils.js";

export class GrowthJournalEngine {
  constructor(private readonly pack: OCPack) {}

  async record(result: OCProcessResult): Promise<OCGrowthJournalEntry | undefined> {
    if (!this.pack.selfGrowth?.autoRecordReflections) {
      return undefined;
    }

    const entry = this.entryFor(result);
    if (!this.pack.path) {
      return entry;
    }

    const dir = join(this.pack.path, ".museegg", "growth-journal");
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, `${entry.date}.jsonl`), `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  private entryFor(result: OCProcessResult): OCGrowthJournalEntry {
    const date = result.event.timestamp.slice(0, 10);
    const text = getEventText(result.event);
    const qualitySignals: OCQualitySignal[] = result.quality?.signals ?? [];
    const proposalIds = result.growthProposals?.map((proposal) => proposal.id) ?? [];
    const summaryParts = [
      text ? `事件：${text.slice(0, 120)}` : `事件型別：${result.event.type}`,
      result.response?.text ? `回應：${result.response.text.slice(0, 120)}` : "",
      result.memory ? `記憶：${result.memory.content.slice(0, 100)}` : "",
      proposalIds.length > 0 ? `提案：${proposalIds.length} 件` : "",
      qualitySignals.length > 0 ? `品質訊號：${qualitySignals.join(", ")}` : ""
    ].filter(Boolean);

    return {
      id: createId("journal"),
      date,
      title: `${this.pack.profile.name} 的事件回顧`,
      summary: summaryParts.join("\n"),
      eventId: result.event.id,
      memoryId: result.memory?.id,
      proposalIds,
      qualitySignals,
      createdAt: nowIso()
    };
  }
}
