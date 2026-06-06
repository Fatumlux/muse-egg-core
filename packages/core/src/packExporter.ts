import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { ocSoulFileNames, type OCPack, type OCSkill } from "@muse-egg/oc-schema";

export async function saveOCPack(pack: OCPack, targetPath = pack.path): Promise<string> {
  if (!targetPath) {
    throw new Error("Cannot save OC Pack without a target path.");
  }

  await writePackFiles(pack, targetPath);
  return targetPath;
}

export async function exportOCPack(pack: OCPack, parentDir: string): Promise<string> {
  const packDir = resolve(parentDir, pack.manifest.id);
  await writePackFiles(pack, packDir);

  if (pack.path && resolve(pack.path) !== packDir) {
    await copyAssetFolder(pack.path, packDir, "character");
    await copyAssetFolder(pack.path, packDir, "live2d");
    await copyAssetFolder(pack.path, packDir, "voice");
    await copySkillFolder(pack.path, packDir);
    await copyContinuityFolder(pack.path, packDir);
    await copyMemoryStoreFolder(pack.path, packDir);
  }

  return packDir;
}

async function writePackFiles(pack: OCPack, targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
  await createPackBackup(targetPath);
  await mkdir(join(targetPath, "assets", "character"), { recursive: true });
  await mkdir(join(targetPath, "assets", "live2d"), { recursive: true });
  await mkdir(join(targetPath, "assets", "voice"), { recursive: true });
  await mkdir(join(targetPath, "prompts"), { recursive: true });

  await writeJson(join(targetPath, "manifest.json"), pack.manifest);
  await writeJson(join(targetPath, "profile.json"), pack.profile);
  await writeJson(join(targetPath, "lore.json"), pack.lore);
  await writeJson(join(targetPath, "memories.json"), pack.memories);
  await writeJson(join(targetPath, "guard-rules.json"), pack.guardRules);
  await writeJson(join(targetPath, "reaction-rules.json"), pack.reactionRules);
  await writeJson(join(targetPath, "awakening-rules.json"), pack.awakeningRules);
  await writeJson(join(targetPath, "autonomy.json"), pack.autonomy);
  if (pack.modelRouting) {
    await writeJson(join(targetPath, "model-routing.json"), pack.modelRouting);
  }
  if (pack.memoryStore) {
    await writeJson(join(targetPath, "memory-store.json"), pack.memoryStore);
  }
  if (pack.selfGrowth) {
    await writeJson(join(targetPath, "self-growth.json"), pack.selfGrowth);
  }
  if (pack.growthProposals) {
    await writeJson(join(targetPath, "growth-proposals.json"), pack.growthProposals);
  }
  if (pack.lifeState) {
    await writeJson(join(targetPath, "life-state.json"), pack.lifeState);
  }
  if (pack.companion) {
    await writeJson(join(targetPath, "companion.json"), pack.companion);
  }
  if (pack.runtime) {
    await writeJson(join(targetPath, "runtime.json"), pack.runtime);
  }
  await writeFile(join(targetPath, "prompts", "base-system.md"), `${pack.prompts.baseSystem.trim()}\n`, "utf8");
  await writeFile(join(targetPath, "prompts", "response-style.md"), `${pack.prompts.responseStyle.trim()}\n`, "utf8");

  for (const fileName of ocSoulFileNames) {
    const content = pack.soulFiles?.[fileName];
    if (content !== undefined) {
      await writeFile(join(targetPath, fileName), `${content.trim()}\n`, "utf8");
    }
  }

  for (const skill of pack.skills ?? []) {
    const skillDir = join(targetPath, "skills", skill.id);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), renderSkillMarkdown(skill), "utf8");
  }
}

async function createPackBackup(targetPath: string): Promise<void> {
  try {
    await stat(join(targetPath, "manifest.json"));
  } catch {
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const backupDir = join(targetPath, ".museegg", "backups", stamp);
  await mkdir(backupDir, { recursive: true });
  for (const fileName of [
    "manifest.json",
    "profile.json",
    "lore.json",
    "memories.json",
    "guard-rules.json",
    "reaction-rules.json",
    "awakening-rules.json",
    "autonomy.json",
    "model-routing.json",
    "memory-store.json",
    "self-growth.json",
    "growth-proposals.json",
    "life-state.json",
    "companion.json",
    "runtime.json"
  ]) {
    try {
      await cp(join(targetPath, fileName), join(backupDir, fileName), { force: true });
    } catch {
      // Optional pack files are backed up only when present.
    }
  }
  try {
    await cp(join(targetPath, "prompts"), join(backupDir, "prompts"), { recursive: true, force: true });
  } catch {
    // Optional prompts backup should not block saving.
  }
}

async function copyAssetFolder(sourcePackPath: string, targetPackPath: string, folder: string): Promise<void> {
  const source = join(sourcePackPath, "assets", folder);
  const target = join(targetPackPath, "assets", folder);
  await mkdir(target, { recursive: true });
  try {
    await cp(source, target, { recursive: true, force: true });
  } catch {
    // Empty asset folders are valid for starter OC packs.
  }
}

async function copySkillFolder(sourcePackPath: string, targetPackPath: string): Promise<void> {
  const source = join(sourcePackPath, "skills");
  const target = join(targetPackPath, "skills");
  await mkdir(target, { recursive: true });
  try {
    await cp(source, target, { recursive: true, force: true });
  } catch {
    // OC Packs can be valid without installed skills.
  }
}

async function copyContinuityFolder(sourcePackPath: string, targetPackPath: string): Promise<void> {
  const source = join(sourcePackPath, ".museegg", "continuity");
  const target = join(targetPackPath, ".museegg", "continuity");
  await mkdir(target, { recursive: true });
  try {
    await cp(source, target, { recursive: true, force: true });
  } catch {
    // Continuity logs are created lazily after the OC starts receiving events.
  }
}

async function copyMemoryStoreFolder(sourcePackPath: string, targetPackPath: string): Promise<void> {
  const source = join(sourcePackPath, ".museegg", "memory");
  const target = join(targetPackPath, ".museegg", "memory");
  await mkdir(target, { recursive: true });
  try {
    await cp(source, target, { recursive: true, force: true });
  } catch {
    // SQLite vector memory stores are created lazily after the OC receives events.
  }
}

function renderSkillMarkdown(skill: OCSkill): string {
  return [
    "---",
    `id: ${skill.id}`,
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    `version: ${skill.version}`,
    `enabled: ${skill.enabled}`,
    `triggers: ${skill.triggers.join(", ")}`,
    `permissions: ${skill.permissions.join(", ")}`,
    `platforms: ${skill.platforms.join(", ")}`,
    "---",
    "",
    skill.instructions.trim(),
    ""
  ].join("\n");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(withoutRuntimeFields(value), null, 2)}\n`, "utf8");
}

function withoutRuntimeFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutRuntimeFields);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "path").map(([key, nested]) => [key, withoutRuntimeFields(nested)])
    );
  }
  return value;
}

export function defaultExportName(pack: OCPack): string {
  return basename(pack.manifest.id || "oc-pack");
}
