import type { OCPack } from "@muse-egg/oc-schema";

export interface OCPackReport {
  title: string;
  summary: string;
  counts: {
    loreEntries: number;
    memories: number;
    guardRules: number;
    reactionRules: number;
    awakeningRules: number;
    characterAssets: number;
    soulFiles: number;
    skills: number;
  };
  readiness: string[];
}

export class ReportGenerator {
  generate(pack: OCPack): OCPackReport {
    const readiness: string[] = [];
    if (pack.guardRules.some((rule) => rule.enabled)) {
      readiness.push("Guard rules are active.");
    }
    if (pack.reactionRules.some((rule) => rule.enabled)) {
      readiness.push("Rule-based responses are ready.");
    }
    if (pack.awakeningRules.some((rule) => rule.enabled) && pack.autonomy.enabled) {
      readiness.push("Autonomous awakening is enabled.");
    }
    if (pack.assets.character.length > 0) {
      readiness.push("Character assets are attached.");
    }
    if (pack.soulFiles && Object.keys(pack.soulFiles).length > 0) {
      readiness.push("Soul files are attached.");
    }
    if ((pack.skills?.length ?? 0) > 0) {
      readiness.push("OC skills are installed.");
    }
    if (pack.selfGrowth?.enabled) {
      readiness.push("Self-growth policy is enabled with permission boundaries.");
    }

    return {
      title: `${pack.manifest.name} OC Pack Report`,
      summary: `${pack.profile.name} is configured as ${pack.profile.role}. ${pack.manifest.description}`,
      counts: {
        loreEntries: pack.lore.entries.length,
        memories: pack.memories.entries.length,
        guardRules: pack.guardRules.length,
        reactionRules: pack.reactionRules.length,
        awakeningRules: pack.awakeningRules.length,
        characterAssets: pack.assets.character.length,
        soulFiles: pack.soulFiles ? Object.keys(pack.soulFiles).length : 0,
        skills: pack.skills?.length ?? 0
      },
      readiness
    };
  }

  toMarkdown(pack: OCPack): string {
    const report = this.generate(pack);
    return [
      `# ${report.title}`,
      "",
      report.summary,
      "",
      "## Counts",
      "",
      `- Lore entries: ${report.counts.loreEntries}`,
      `- Memories: ${report.counts.memories}`,
      `- Guard rules: ${report.counts.guardRules}`,
      `- Reaction rules: ${report.counts.reactionRules}`,
      `- Awakening rules: ${report.counts.awakeningRules}`,
      `- Character assets: ${report.counts.characterAssets}`,
      `- Soul files: ${report.counts.soulFiles}`,
      `- Skills: ${report.counts.skills}`,
      "",
      "## Readiness",
      "",
      ...(report.readiness.length > 0 ? report.readiness.map((item) => `- ${item}`) : ["- Needs more OC Pack data."])
    ].join("\n");
  }
}
