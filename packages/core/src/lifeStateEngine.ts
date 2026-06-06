import type { AwakeningResult, OCEvent, OCLifeState, OCPack, OCSelfGrowthDecision } from "@muse-egg/oc-schema";
import { nowIso } from "./utils.js";

export class LifeStateEngine {
  constructor(private readonly pack: OCPack) {
    this.pack.lifeState ??= defaultLifeState();
  }

  current(): OCLifeState {
    this.pack.lifeState ??= defaultLifeState();
    return this.pack.lifeState;
  }

  update(event: OCEvent, awakening: AwakeningResult, selfGrowth?: OCSelfGrowthDecision, guarded = false): OCLifeState {
    const current = this.current();
    const next: OCLifeState = {
      ...current,
      wakefulness: clamp(Math.round((current.wakefulness * 0.55) + (awakening.score * 0.45))),
      energy: clamp(current.energy + energyDelta(event.type, guarded)),
      stress: clamp(current.stress + stressDelta(event.type, guarded, selfGrowth)),
      trust: clamp(current.trust + (guarded ? 0 : event.type === "training_input" ? 2 : 1)),
      bond: clamp(current.bond + (event.type === "user_message" || event.type === "telegram_message" ? 1 : 0)),
      lastUpdated: nowIso(),
      mood: "calm",
      summary: ""
    };

    next.mood = moodFrom(next, awakening, guarded, selfGrowth);
    next.summary = summaryFrom(next);
    this.pack.lifeState = next;
    return next;
  }
}

export function defaultLifeState(): OCLifeState {
  return {
    mood: "curious",
    energy: 72,
    trust: 55,
    bond: 35,
    wakefulness: 20,
    stress: 12,
    lastUpdated: nowIso(),
    summary: "剛被喚醒，正在建立與使用者的穩定連續感。"
  };
}

function energyDelta(type: OCEvent["type"], guarded: boolean): number {
  if (guarded) {
    return -2;
  }
  if (type === "scheduled_daily_reflection" || type === "scheduled_weekly_report") {
    return -4;
  }
  if (type === "user_message" || type === "telegram_message") {
    return 1;
  }
  return 0;
}

function stressDelta(type: OCEvent["type"], guarded: boolean, selfGrowth?: OCSelfGrowthDecision): number {
  if (guarded || (selfGrowth?.blocked.length ?? 0) > 0) {
    return 8;
  }
  if (type === "guard_rule_update") {
    return 3;
  }
  if (type === "scheduled_daily_reflection") {
    return -2;
  }
  return -1;
}

function moodFrom(
  state: OCLifeState,
  awakening: AwakeningResult,
  guarded: boolean,
  selfGrowth?: OCSelfGrowthDecision
): OCLifeState["mood"] {
  if (guarded || (selfGrowth?.blocked.length ?? 0) > 0) {
    return "guarded";
  }
  if (awakening.score >= 80) {
    return "alert";
  }
  if (state.energy < 30) {
    return "tired";
  }
  if ((selfGrowth?.proposals.length ?? 0) > 0) {
    return "curious";
  }
  if (state.bond >= 65) {
    return "warm";
  }
  return "focused";
}

function summaryFrom(state: OCLifeState): string {
  return `mood=${state.mood}, energy=${state.energy}, bond=${state.bond}, wakefulness=${state.wakefulness}, stress=${state.stress}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
