import type { OCEvent, OCEventType, OCPlatform } from "@muse-egg/oc-schema";

export interface OCEventInput {
  type: OCEventType;
  platform?: OCPlatform;
  payload?: Record<string, unknown>;
  source?: string;
  id?: string;
  timestamp?: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function createEvent(input: OCEventInput): OCEvent {
  return {
    id: input.id ?? createId("evt"),
    type: input.type,
    timestamp: input.timestamp ?? nowIso(),
    platform: input.platform ?? "system",
    payload: input.payload ?? {},
    source: input.source
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function getEventText(event: OCEvent): string {
  const payload = event.payload;
  const fields = ["text", "message", "content", "path", "title", "summary"];
  for (const field of fields) {
    if (typeof payload[field] === "string" && payload[field].trim().length > 0) {
      return payload[field];
    }
  }
  return "";
}

export function matchesTextTrigger(trigger: string, event: OCEvent): boolean {
  const normalizedTrigger = normalizeText(trigger);
  if (normalizedTrigger.length === 0) {
    return false;
  }
  if (normalizedTrigger === "*" || normalizedTrigger === "any") {
    return true;
  }
  if (normalizedTrigger === event.type) {
    return true;
  }
  if (normalizedTrigger.startsWith("event:")) {
    return normalizedTrigger.slice("event:".length) === event.type;
  }
  return normalizeText(getEventText(event)).includes(normalizedTrigger);
}

export function splitTags(value: string): string[] {
  return value
    .split(/[,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}
