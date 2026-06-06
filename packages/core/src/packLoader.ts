import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertOCPack,
  ocSoulFileNames,
  type OCCompanionSettings,
  type OCGrowthProposalVault,
  type OCLifeState,
  type OCMemoryStoreConfig,
  type OCModelRouting,
  type OCPack,
  type OCRuntimeSettings,
  type OCSelfGrowthPolicy,
  type OCSkill,
  type OCSoulFiles
} from "@muse-egg/oc-schema";
import { mergeMemories, readMemoryLedger } from "./continuityEngine.js";

export async function loadOCPack(packPath: string): Promise<OCPack> {
  const pack: OCPack = {
    manifest: await readJson(join(packPath, "manifest.json")),
    profile: await readJson(join(packPath, "profile.json")),
    lore: await readJson(join(packPath, "lore.json")),
    memories: await readJson(join(packPath, "memories.json")),
    guardRules: await readJson(join(packPath, "guard-rules.json")),
    reactionRules: await readJson(join(packPath, "reaction-rules.json")),
    awakeningRules: await readJson(join(packPath, "awakening-rules.json")),
    autonomy: await readJson(join(packPath, "autonomy.json")),
    assets: {
      character: await listFiles(join(packPath, "assets", "character")),
      live2d: await listFiles(join(packPath, "assets", "live2d")),
      voice: await listFiles(join(packPath, "assets", "voice"))
    },
    prompts: {
      baseSystem: await readText(join(packPath, "prompts", "base-system.md")),
      responseStyle: await readText(join(packPath, "prompts", "response-style.md"))
    },
    modelRouting: await readOptionalJson<OCModelRouting>(join(packPath, "model-routing.json")),
    memoryStore: await readOptionalJson<OCMemoryStoreConfig>(join(packPath, "memory-store.json")),
    selfGrowth: await readOptionalJson<OCSelfGrowthPolicy>(join(packPath, "self-growth.json")),
    growthProposals: await readOptionalJson<OCGrowthProposalVault>(join(packPath, "growth-proposals.json")),
    lifeState: await readOptionalJson<OCLifeState>(join(packPath, "life-state.json")),
    companion: await readOptionalJson<OCCompanionSettings>(join(packPath, "companion.json")),
    runtime: await readOptionalJson<OCRuntimeSettings>(join(packPath, "runtime.json")),
    soulFiles: await readSoulFiles(packPath),
    skills: await readSkills(packPath),
    path: packPath
  };

  pack.memories.entries = mergeMemories(pack.memories.entries, await readMemoryLedger(packPath));

  assertOCPack(pack);
  return pack;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/u, "")) as T;
}

async function readOptionalJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return await readJson<T>(filePath);
  } catch {
    return undefined;
  }
}

async function readText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readSoulFiles(packPath: string): Promise<OCSoulFiles> {
  const files: OCSoulFiles = {};
  for (const fileName of ocSoulFileNames) {
    const content = await readText(join(packPath, fileName));
    if (content.trim().length > 0) {
      files[fileName] = content;
    }
  }
  return files;
}

async function readSkills(packPath: string): Promise<OCSkill[]> {
  const skillsPath = join(packPath, "skills");
  try {
    await mkdir(skillsPath, { recursive: true });
    const entries = await readdir(skillsPath, { withFileTypes: true });
    const skills = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const skillPath = join(skillsPath, entry.name, "SKILL.md");
          const raw = await readText(skillPath);
          return raw.trim().length > 0 ? parseSkillMarkdown(entry.name, skillPath, raw) : undefined;
        })
    );
    return skills.filter((skill): skill is OCSkill => Boolean(skill));
  } catch {
    return [];
  }
}

function parseSkillMarkdown(folderName: string, skillPath: string, raw: string): OCSkill {
  const { metadata, body } = parseFrontmatter(raw);
  return {
    id: metadata.id ?? folderName,
    name: metadata.name ?? folderName,
    description: metadata.description ?? "",
    version: metadata.version ?? "0.1.0",
    enabled: metadata.enabled !== "false",
    triggers: parseList(metadata.triggers),
    permissions: parseList(metadata.permissions),
    platforms: parseList(metadata.platforms).map((item) => item as OCSkill["platforms"][number]),
    instructions: body.trim(),
    path: skillPath
  };
}

function parseFrontmatter(raw: string): { metadata: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) {
    return { metadata: {}, body: raw };
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { metadata: {}, body: raw };
  }

  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4);
  const metadata: Record<string, string> = {};
  for (const line of block.split(/\r?\n/g)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key.length > 0) {
      metadata[key] = value;
    }
  }
  return { metadata, body };
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function listFiles(dirPath: string): Promise<string[]> {
  await mkdir(dirPath, { recursive: true });
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && isVisibleAssetFile(entry.name)).map((entry) => entry.name).sort();
}

function isVisibleAssetFile(name: string): boolean {
  return !name.startsWith(".") && name !== "Thumbs.db" && name !== "desktop.ini";
}
