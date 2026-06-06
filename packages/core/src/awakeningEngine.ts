import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AwakeningResult, OCEvent, OCPack } from "@muse-egg/oc-schema";
import { AutonomyEngine } from "./autonomyEngine.js";
import { clamp, matchesTextTrigger, nowIso } from "./utils.js";

export interface AwakeningLogEntry {
  id: string;
  timestamp: string;
  eventId: string;
  eventType: string;
  platform: string;
  score: number;
  level: string;
  matchedRuleIds: string[];
  dialogue?: string;
  expression?: string;
}

export class AwakeningEngine {
  constructor(private readonly pack: OCPack) {}

  async evaluate(event: OCEvent): Promise<AwakeningResult> {
    const wakeupsToday = await this.countWakeupsToday();
    const autonomy = new AutonomyEngine(this.pack.autonomy).evaluate(event, wakeupsToday);
    const matchedRules = this.pack.awakeningRules
      .filter((rule) => rule.enabled)
      .filter((rule) => matchesTextTrigger(rule.trigger, event));

    const baseline = this.baselineScore(event);
    const ruleScore = matchedRules.reduce((total, rule) => total + rule.score, 0);
    const rawScore = baseline + ruleScore;
    const gatedScore = autonomy.allowed ? rawScore * autonomy.multiplier : Math.min(rawScore, 29);
    const score = clamp(Math.round(gatedScore), 0, 100);
    const level = score < 30 ? "sleep" : score < 60 ? "subtle" : score < 80 ? "notification" : "full";
    const strongestRule = [...matchedRules].sort((a, b) => b.score - a.score)[0];

    const result: AwakeningResult = {
      score,
      level,
      dialogue: strongestRule?.dialogue,
      expression: strongestRule?.expression ?? this.pack.profile.defaultExpression,
      matchedRuleIds: matchedRules.map((rule) => rule.id),
      shouldWake: score >= 30
    };

    if (result.shouldWake) {
      await this.appendLog({
        id: `${event.id}_awakening`,
        timestamp: nowIso(),
        eventId: event.id,
        eventType: event.type,
        platform: event.platform,
        score,
        level,
        matchedRuleIds: result.matchedRuleIds,
        dialogue: result.dialogue,
        expression: result.expression
      });
    }

    return result;
  }

  private baselineScore(event: OCEvent): number {
    switch (event.type) {
      case "telegram_message":
        return 20;
      case "user_message":
        return 12;
      case "observed_final_candidate":
        return 35;
      case "observed_file_change":
        return 18;
      case "scheduled_daily_reflection":
        return 30;
      case "scheduled_weekly_report":
        return 45;
      case "lore_update":
      case "guard_rule_update":
      case "oc_pack_imported":
      case "oc_pack_exported":
        return 24;
      default:
        return 10;
    }
  }

  private async appendLog(entry: AwakeningLogEntry): Promise<void> {
    const logPath = this.logPath();
    if (!logPath) {
      return;
    }

    await mkdir(dirname(logPath), { recursive: true });
    const existing = await this.readLog();
    existing.unshift(entry);
    await writeFile(logPath, `${JSON.stringify(existing.slice(0, 500), null, 2)}\n`, "utf8");
  }

  private async countWakeupsToday(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const entries = await this.readLog();
    return entries.filter((entry) => entry.timestamp.startsWith(today)).length;
  }

  private async readLog(): Promise<AwakeningLogEntry[]> {
    const logPath = this.logPath();
    if (!logPath) {
      return [];
    }

    try {
      const raw = await readFile(logPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as AwakeningLogEntry[]) : [];
    } catch {
      return [];
    }
  }

  private logPath(): string | undefined {
    return this.pack.path ? join(this.pack.path, "awakening-log.json") : undefined;
  }
}
