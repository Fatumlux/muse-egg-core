import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OCMemoryEntry, OCPack, OCProcessResult } from "@muse-egg/oc-schema";
import { nowIso } from "./utils.js";

export interface ContinuityJournalRecord {
  version: 1;
  timestamp: string;
  eventId: string;
  eventType: string;
  platform: string;
  event: OCProcessResult["event"];
  response?: OCProcessResult["response"];
  awakening: OCProcessResult["awakening"];
  guardRuleIds: string[];
  memoryId?: string;
}

export interface ContinuityIntegrityReport {
  timestamp: string;
  packId: string;
  memoriesCount: number;
  eventJournalSha256?: string;
  memoryLedgerSha256?: string;
  memoriesJsonSha256?: string;
}

export class ContinuityEngine {
  constructor(private readonly pack: OCPack) {}

  async persist(result: OCProcessResult): Promise<void> {
    if (!this.pack.path) {
      return;
    }

    await mkdir(this.root(), { recursive: true });
    await this.appendEvent(result);

    if (result.memory) {
      await this.appendMemory(result.memory);
      await this.writeMemoriesJson();
      await this.writeDailySnapshot();
    }
    if ((result.growthProposals?.length ?? 0) > 0 || this.pack.growthProposals) {
      await this.writeGrowthProposalsJson();
    }
    if (result.lifeState || this.pack.lifeState) {
      await this.writeLifeStateJson();
    }

    await this.writeIntegrityReport();
  }

  async audit(): Promise<ContinuityIntegrityReport | undefined> {
    if (!this.pack.path) {
      return undefined;
    }

    return {
      timestamp: nowIso(),
      packId: this.pack.manifest.id,
      memoriesCount: this.pack.memories.entries.length,
      eventJournalSha256: await this.hashFileIfPresent(this.eventJournalPath()),
      memoryLedgerSha256: await this.hashFileIfPresent(this.memoryLedgerPath()),
      memoriesJsonSha256: await this.hashFileIfPresent(join(this.pack.path, "memories.json"))
    };
  }

  private async appendEvent(result: OCProcessResult): Promise<void> {
    const record: ContinuityJournalRecord = {
      version: 1,
      timestamp: nowIso(),
      eventId: result.event.id,
      eventType: result.event.type,
      platform: result.event.platform,
      event: result.event,
      response: result.response,
      awakening: result.awakening,
      guardRuleIds: result.guardRuleIds,
      memoryId: result.memory?.id
    };
    await appendJsonl(this.eventJournalPath(), record);
  }

  private async appendMemory(memory: OCMemoryEntry): Promise<void> {
    await appendJsonl(this.memoryLedgerPath(), memory);
  }

  private async writeMemoriesJson(): Promise<void> {
    if (!this.pack.path) {
      return;
    }

    await writeJsonAtomic(join(this.pack.path, "memories.json"), this.pack.memories);
  }

  private async writeGrowthProposalsJson(): Promise<void> {
    if (!this.pack.path || !this.pack.growthProposals) {
      return;
    }
    await writeJsonAtomic(join(this.pack.path, "growth-proposals.json"), this.pack.growthProposals);
  }

  private async writeLifeStateJson(): Promise<void> {
    if (!this.pack.path || !this.pack.lifeState) {
      return;
    }
    await writeJsonAtomic(join(this.pack.path, "life-state.json"), this.pack.lifeState);
  }

  private async writeDailySnapshot(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    await writeJsonAtomic(join(this.snapshotsPath(), `${date}.json`), {
      timestamp: nowIso(),
      packId: this.pack.manifest.id,
      profileName: this.pack.profile.name,
      memories: this.pack.memories.entries.slice(0, 120),
      loreCount: this.pack.lore.entries.length,
      guardRuleCount: this.pack.guardRules.length,
      skillCount: this.pack.skills?.length ?? 0
    });
  }

  private async writeIntegrityReport(): Promise<void> {
    const report = await this.audit();
    if (!report) {
      return;
    }
    await writeJsonAtomic(join(this.root(), "integrity.json"), report);
  }

  private root(): string {
    return join(this.pack.path ?? "", ".museegg", "continuity");
  }

  private snapshotsPath(): string {
    return join(this.root(), "snapshots");
  }

  private eventJournalPath(): string {
    return join(this.root(), "events.jsonl");
  }

  private memoryLedgerPath(): string {
    return join(this.root(), "memory-ledger.jsonl");
  }

  private async hashFileIfPresent(filePath: string): Promise<string | undefined> {
    try {
      const raw = await readFile(filePath);
      return createHash("sha256").update(raw).digest("hex");
    } catch {
      return undefined;
    }
  }
}

export async function readMemoryLedger(packPath: string): Promise<OCMemoryEntry[]> {
  try {
    const raw = await readFile(join(packPath, ".museegg", "continuity", "memory-ledger.jsonl"), "utf8");
    return raw
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OCMemoryEntry)
      .filter(isMemoryEntry);
  } catch {
    return [];
  }
}

export function mergeMemories(primary: OCMemoryEntry[], recovered: OCMemoryEntry[]): OCMemoryEntry[] {
  const byId = new Map<string, OCMemoryEntry>();
  for (const memory of [...primary, ...recovered]) {
    if (!byId.has(memory.id)) {
      byId.set(memory.id, memory);
    }
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 500);
}

async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

function isMemoryEntry(value: unknown): value is OCMemoryEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<OCMemoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.importance === "number" &&
    Array.isArray(candidate.tags)
  );
}
