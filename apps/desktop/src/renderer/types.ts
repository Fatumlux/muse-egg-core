import type { MuseEggDesktopApi } from "../main/preload";
import type { AwakeningResult, OCEventType, OCProcessResult } from "@muse-egg/oc-schema";

declare global {
  interface Window {
    museEgg: MuseEggDesktopApi;
  }
}

export type StudioTab =
  | "profile"
  | "lore"
  | "guards"
  | "reactions"
  | "awakening"
  | "assets"
  | "growth"
  | "proposals"
  | "permissions"
  | "companion"
  | "runtime"
  | "skills"
  | "models";

export interface TimelineEntry {
  id: string;
  timestamp: string;
  type: OCEventType;
  platform: string;
  payloadText: string;
  responseText?: string;
  expression?: string;
  awakening: AwakeningResult;
}

export function timelineEntryFromResult(result: OCProcessResult): TimelineEntry {
  const payload = result.event.payload;
  const payloadText = String(payload.text ?? payload.message ?? payload.title ?? payload.path ?? result.event.type);
  return {
    id: result.event.id,
    timestamp: result.event.timestamp,
    type: result.event.type,
    platform: result.event.platform,
    payloadText,
    responseText: result.response?.text,
    expression: result.response?.expression,
    awakening: result.awakening
  };
}
