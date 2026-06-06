import type { OCEvent, OCMemoryLayer } from "@muse-egg/oc-schema";
import { getEventText, normalizeText } from "./utils.js";

const identityTerms = ["我是", "身份", "身分", "本名", "不是通用助理", "identity"];
const canonTerms = ["canon", "正式設定", "世界觀", "lore", "角色設定", "禁忌"];
const ephemeralTerms = ["暫時", "先不用記", "不要記", "臨時", "ephemeral"];

export function classifyMemoryLayer(event: OCEvent, existingTags: string[] = []): OCMemoryLayer {
  const tags = existingTags.map((tag) => normalizeText(tag));
  const text = normalizeText(getEventText(event));

  if (tags.includes("identity") || identityTerms.some((term) => text.includes(normalizeText(term)))) {
    return "identity";
  }
  if (event.type === "lore_update" || event.type === "guard_rule_update" || canonTerms.some((term) => text.includes(normalizeText(term)))) {
    return "canon";
  }
  if (event.type === "training_input" || event.type === "observed_final_candidate") {
    return "long_term";
  }
  if (event.type === "observed_file_change" || event.type === "scheduled_daily_reflection") {
    return "observation";
  }
  if (ephemeralTerms.some((term) => text.includes(normalizeText(term)))) {
    return "ephemeral";
  }
  return "short_term";
}

export function memoryLayerTag(layer: OCMemoryLayer): string {
  return `layer:${layer}`;
}
