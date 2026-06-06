import type { OCLoreEntry, OCPack } from "@muse-egg/oc-schema";
import { normalizeText, splitTags } from "./utils.js";

export class LoreEngine {
  constructor(private readonly pack: OCPack) {}

  all(): OCLoreEntry[] {
    return [...this.pack.lore.entries].sort((a, b) => b.priority - a.priority);
  }

  relevantTo(text: string, limit = 8): OCLoreEntry[] {
    const terms = splitTags(normalizeText(text));
    if (terms.length === 0) {
      return this.all().slice(0, limit);
    }

    return this.pack.lore.entries
      .map((entry) => ({
        entry,
        score: terms.reduce((total, term) => {
          const haystack = `${entry.title} ${entry.content} ${entry.scope} ${entry.tags.join(" ")}`.toLowerCase();
          return total + (haystack.includes(term) ? 1 : 0);
        }, 0)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority)
      .slice(0, limit)
      .map((item) => item.entry);
  }
}
