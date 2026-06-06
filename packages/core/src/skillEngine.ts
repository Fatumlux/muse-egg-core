import type { OCEvent, OCPack, OCSkill } from "@muse-egg/oc-schema";
import { matchesTextTrigger } from "./utils.js";

export class SkillEngine {
  constructor(private readonly pack: OCPack) {}

  all(): OCSkill[] {
    return this.pack.skills?.filter((skill) => skill.enabled) ?? [];
  }

  relevantTo(event: OCEvent, limit = 6): OCSkill[] {
    return this.all()
      .filter((skill) => this.matchesPlatform(skill, event))
      .filter((skill) => skill.triggers.length === 0 || skill.triggers.some((trigger) => matchesTextTrigger(trigger, event)))
      .slice(0, limit);
  }

  private matchesPlatform(skill: OCSkill, event: OCEvent): boolean {
    return skill.platforms.length === 0 || skill.platforms.includes("any") || skill.platforms.includes(event.platform);
  }
}
