import type { OCEvent, OCReactionRule, OCPack } from "@muse-egg/oc-schema";
import { matchesTextTrigger } from "./utils.js";

export class ReactionEngine {
  constructor(private readonly pack: OCPack) {}

  match(event: OCEvent): OCReactionRule | undefined {
    return this.pack.reactionRules
      .filter((rule) => rule.enabled)
      .filter((rule) => rule.platform === "any" || rule.platform === event.platform)
      .filter((rule) => matchesTextTrigger(rule.trigger, event))
      .sort((a, b) => b.trigger.length - a.trigger.length)[0];
  }
}
