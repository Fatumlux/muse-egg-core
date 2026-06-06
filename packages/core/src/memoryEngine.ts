import type { AIProvider, OCEvent, OCMemoryEntry, OCPack } from "@muse-egg/oc-schema";
import { classifyMemoryLayer, memoryLayerTag } from "./memoryLayerEngine.js";
import { SQLiteVecMemoryStore } from "./sqliteVecMemoryStore.js";
import { createId, getEventText, normalizeText, nowIso, splitTags } from "./utils.js";

const memorableEvents = new Set([
  "user_message",
  "telegram_message",
  "training_input",
  "lore_update",
  "guard_rule_update",
  "observed_final_candidate",
  "scheduled_daily_reflection",
  "scheduled_weekly_report",
  "custom_event"
]);

export class MemoryEngine {
  private readonly vectorStore: SQLiteVecMemoryStore;

  constructor(private readonly pack: OCPack) {
    this.vectorStore = new SQLiteVecMemoryStore(pack);
  }

  async recordEvent(event: OCEvent, provider?: AIProvider): Promise<OCMemoryEntry | undefined> {
    if (!memorableEvents.has(event.type)) {
      return undefined;
    }

    const text = getEventText(event);
    const fallback = `${event.type} from ${event.platform}`;
    const content = text.length > 0 ? text : fallback;
    const entry: OCMemoryEntry = {
      id: createId("mem"),
      type: event.type,
      content,
      timestamp: nowIso(),
      sourceEventId: event.id,
      importance: this.estimateImportance(event, content),
      tags: this.deriveTags(event, content)
    };
    entry.tags = Array.from(new Set([...entry.tags, memoryLayerTag(classifyMemoryLayer(event, entry.tags))]));

    this.pack.memories.entries.unshift(entry);
    this.pack.memories.entries = this.pack.memories.entries.slice(0, 500);
    await this.vectorStore.upsertMemory(entry, { provider });
    return entry;
  }

  recent(limit = 12): OCMemoryEntry[] {
    return this.memoriesForPrompt("").slice(0, limit);
  }

  async relevantTo(text: string, limit = 8, provider?: AIProvider): Promise<OCMemoryEntry[]> {
    const terms = splitTags(normalizeText(text));
    if (terms.length === 0) {
      return this.recent(limit);
    }

    const candidates = this.memoriesForPrompt(text);
    const lexical = candidates
      .map((entry) => ({
        entry,
        score: terms.reduce((total, term) => {
          const haystack = `${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
          return total + (haystack.includes(term) ? 1 : 0);
        }, 0)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.importance - a.entry.importance)
      .slice(0, limit)
      .map((item) => item.entry);

    const vector = await this.vectorStore.search(text, limit, { provider });
    return mergeMemories(vector, lexical, this.recent(limit))
      .filter((entry) => shouldIncludeMemoryInPrompt(entry, text))
      .slice(0, limit);
  }

  private estimateImportance(event: OCEvent, content: string): number {
    if (event.type === "guard_rule_update" || event.type === "lore_update") {
      return 80;
    }
    if (event.type === "training_input") {
      return 70;
    }
    if (content.length > 160) {
      return 60;
    }
    return 35;
  }

  private deriveTags(event: OCEvent, content: string): string[] {
    const payloadTags = Array.isArray(event.payload.tags)
      ? event.payload.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    const textTags = splitTags(content).slice(0, 6);
    return Array.from(new Set([event.type, event.platform, ...payloadTags, ...textTags]));
  }

  private memoriesForPrompt(query: string): OCMemoryEntry[] {
    return this.pack.memories.entries.filter((entry) => shouldIncludeMemoryInPrompt(entry, query));
  }
}

function mergeMemories(...groups: OCMemoryEntry[][]): OCMemoryEntry[] {
  const byId = new Map<string, OCMemoryEntry>();
  for (const memory of groups.flat()) {
    if (!byId.has(memory.id)) {
      byId.set(memory.id, memory);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const importance = b.importance - a.importance;
    return Math.abs(importance) > 0 ? importance : Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });
}

function shouldIncludeMemoryInPrompt(entry: OCMemoryEntry, query: string): boolean {
  if (isMaintenanceQuery(query)) {
    return true;
  }
  return !isIdentityContaminatedMemory(entry.content);
}

function isMaintenanceQuery(value: string): boolean {
  const text = normalizeText(value);
  return (
    /(?:遷移|移植|同步|設定檔|路徑|資料夾|migration|sync|debug|診斷|檢查|匯入|匯出)/iu.test(text) &&
    !/(?:你是|妳是|我是|本名|名字|身分|身份|人格|來源|以前|過去|承認|否認)/u.test(text)
  );
}

function isIdentityContaminatedMemory(value: string): boolean {
  const text = normalizeText(value);
  return /(?:舊名|舊核心|舊系統|舊來源|遷移來源|工具代號|被創造|被擁有|附屬物|設定集合|工具外殼|因使用者而生|因你而生|因我而生)/iu.test(text);
}
