import { starterOCPack } from "@muse-egg/starter-oc";
import type { OCEventInput } from "@muse-egg/core";
import {
  ocSoulFileNames,
  type AwakeningResult,
  type OCCompanionSettings,
  type OCFolderIndexSnapshot,
  type OCIdentityTestReport,
  type OCEvent,
  type OCGrowthProposal,
  type OCGrowthProposalVault,
  type OCLifeState,
  type OCMemoryStoreConfig,
  type OCModelRouting,
  type OCProcessResult,
  type OCResponse,
  type OCPack,
  type OCPackBackupEntry,
  type OCPackHealthReport,
  type OCRuntimeSettings,
  type OCSelfGrowthPolicy,
  type OCSkill,
  type OCSoulFiles
} from "@muse-egg/oc-schema";
import type {
  AppUpdateStatusView,
  HostProviderStatusView,
  MuseEggDesktopApi,
  TelegramRuntimeStatusView,
  TelegramSettingsUpdate,
  TelegramSettingsView
} from "../main/preload";
import { translateStatic } from "./i18n";

let fallbackPack: OCPack = {
  ...starterOCPack,
  memories: { entries: [...starterOCPack.memories.entries] }
};
let webPackDirectoryHandle: WebDirectoryHandle | undefined;
let inMemoryCharacterPreviews: Array<{ name: string; dataUrl: string }> = [];
let webPackReadOnlyImport = false;

const fallbackTelegramSettings: TelegramSettingsView = {
  enabled: false,
  tokenSet: false,
  tokenSource: "none",
  allowedUserIds: [],
  allowedChatIds: []
};

const fallbackProviderStatus: HostProviderStatusView = {
  providerId: "browser-preview",
  openAIOAuth: { available: false },
  openAICompatible: { available: false, baseUrlSet: false, apiKeySet: false },
  gemini: { available: false },
  ollama: { baseUrl: "http://127.0.0.1:11434" },
  routes: ["rule-based preview"]
};

const hostApiBase = "http://127.0.0.1:37821";

const fallbackApi: MuseEggDesktopApi = {
  async loadActivePack() {
    webPackDirectoryHandle = undefined;
    webPackReadOnlyImport = false;
    const hosted = await hostGet<OCPack>("/api/pack/active");
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    return fallbackApi.loadExamplePack();
  },
  async loadExamplePack() {
    webPackDirectoryHandle = undefined;
    webPackReadOnlyImport = false;
    const hosted = await hostGet<OCPack>("/api/pack/example");
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    fallbackPack = clonePack(starterOCPack);
    return clonePack(fallbackPack);
  },
  async loadBlankPack() {
    webPackDirectoryHandle = undefined;
    webPackReadOnlyImport = false;
    const hosted = await hostGet<OCPack>("/api/pack/blank");
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    fallbackPack = {
      ...clonePack(starterOCPack),
      manifest: {
        ...starterOCPack.manifest,
        id: "blank-template",
        name: "Blank OC Template",
        author: translateStatic("preview.blankAuthor"),
        description: translateStatic("preview.blankDescription")
      },
      profile: {
        ...starterOCPack.profile,
        name: "Your OC",
        aliases: [],
        role: "original character"
      },
      lore: { entries: [] },
      memories: { entries: [] }
    };
    return clonePack(fallbackPack);
  },
  async importPack() {
    const picked = await pickWebPackDirectory();
    if (picked) {
      webPackDirectoryHandle = picked.handle;
      webPackReadOnlyImport = !picked.handle;
      fallbackPack = clonePack(picked.pack);
      return clonePack(fallbackPack);
    }
    return undefined;
  },
  async updateSession(pack: OCPack) {
    const hosted = await hostPost<OCPack>("/api/pack/update-session", { pack });
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    fallbackPack = clonePack(pack);
    return clonePack(fallbackPack);
  },
  async savePack(pack: OCPack) {
    if (webPackReadOnlyImport) {
      alert(translateStatic("web.readOnlySave"));
      fallbackPack = clonePack(pack);
      return clonePack(fallbackPack);
    }
    if (webPackDirectoryHandle) {
      await writePackToWebDirectory(webPackDirectoryHandle, pack);
      fallbackPack = clonePack(pack);
      return clonePack(fallbackPack);
    }
    const hosted = await hostPost<OCPack>("/api/pack/save", { pack });
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    fallbackPack = clonePack(pack);
    return clonePack(fallbackPack);
  },
  async exportPack(pack: OCPack) {
    const hosted = await hostPost<OCPack>("/api/pack/export", { pack });
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    fallbackPack = clonePack(pack);
    return clonePack(fallbackPack);
  },
  async addCharacterAsset() {
    const files = await pickWebCharacterImages();
    if (files.length === 0) {
      return clonePack(fallbackPack);
    }
    const squareFiles = await filterSquareImages(files);
    if (squareFiles.length === 0) {
      return clonePack(fallbackPack);
    }

    if (webPackDirectoryHandle) {
      const characterDir = await webPackDirectoryHandle.getDirectoryHandle("assets", { create: true })
        .then((assetsDir) => assetsDir.getDirectoryHandle("character", { create: true }));
      for (const file of squareFiles) {
        const fileHandle = await characterDir.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(await file.arrayBuffer());
        await writable.close();
      }
      fallbackPack = await readPackFromWebDirectory(webPackDirectoryHandle);
      return clonePack(fallbackPack);
    }

    const hosted = await hostPost<OCPack>("/api/assets/add-character", {
      files: await Promise.all(squareFiles.map(async (file) => ({ name: file.name, dataUrl: await fileToDataUrl(file) })))
    });
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }

    inMemoryCharacterPreviews = await Promise.all(
      squareFiles.map(async (file) => ({ name: file.name, dataUrl: await fileToDataUrl(file) }))
    );
    fallbackPack = appendInMemoryCharacterAssets(fallbackPack, squareFiles.map((file) => file.name));
    return clonePack(fallbackPack);
  },
  async removeCharacterAsset(fileName: string) {
    if (webPackDirectoryHandle) {
      const characterDir = await webPackDirectoryHandle.getDirectoryHandle("assets", { create: true })
        .then((assetsDir) => assetsDir.getDirectoryHandle("character", { create: true }));
      await characterDir.removeEntry(fileName).catch(() => undefined);
      fallbackPack = await readPackFromWebDirectory(webPackDirectoryHandle);
      return clonePack(fallbackPack);
    }

    const hosted = await hostPost<OCPack>("/api/assets/remove-character", { fileName });
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }

    if (webPackReadOnlyImport) {
      alert(translateStatic("web.readOnlyRemove"));
    }
    inMemoryCharacterPreviews = inMemoryCharacterPreviews.filter((preview) => preview.name !== fileName);
    fallbackPack = removeInMemoryCharacterAsset(fallbackPack, fileName);
    return clonePack(fallbackPack);
  },
  async getCharacterAssetPreviews() {
    if (webPackDirectoryHandle) {
      return readWebCharacterPreviews(webPackDirectoryHandle, fallbackPack.assets.character);
    }
    const hosted = await hostGet<Array<{ name: string; dataUrl: string }>>("/api/assets/character-previews");
    if (hosted) {
      return hosted;
    }
    return inMemoryCharacterPreviews;
  },
  async getPackHealth() {
    const hosted = await hostGet<OCPackHealthReport>("/api/pack/health");
    if (hosted) {
      return hosted;
    }
    return fallbackPackHealth(fallbackPack);
  },
  async runIdentityTests() {
    const hosted = await hostGet<OCIdentityTestReport>("/api/pack/identity-tests");
    if (hosted) {
      return hosted;
    }
    return fallbackIdentityReport(fallbackPack);
  },
  async listBackups() {
    const hosted = await hostGet<OCPackBackupEntry[]>("/api/pack/backups");
    return hosted ?? [];
  },
  async restoreBackup(backupId: string) {
    const hosted = await hostPost<OCPack>("/api/pack/restore-backup", { backupId });
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    return clonePack(fallbackPack);
  },
  async scanFolderIndex() {
    const hosted = await hostGet<OCFolderIndexSnapshot>("/api/folder-index");
    if (hosted) {
      return hosted;
    }
    const roots = fallbackPack.runtime?.folderIndex?.roots ?? [];
    return {
      generatedAt: new Date().toISOString(),
      roots,
      items: [],
      truncated: false,
      issues: roots.length === 0 ? [{ path: "$.runtime.folderIndex.roots", message: translateStatic("health.noFixedFolder") }] : []
    };
  },
  async addFolderIndexRoot() {
    const hosted = await hostPost<OCPack>("/api/folder-index/add-root", {});
    if (hosted) {
      fallbackPack = clonePack(hosted);
      return clonePack(fallbackPack);
    }
    return clonePack(fallbackPack);
  },
  async dispatchEvent(input: OCEventInput) {
    const hosted = await hostPost<OCProcessResult>("/api/event/dispatch", { pack: fallbackPack, input });
    if (hosted) {
      if (hosted.memory) {
        fallbackPack = {
          ...fallbackPack,
          memories: {
            entries: [hosted.memory, ...fallbackPack.memories.entries].slice(0, 500)
          }
        };
      }
      if (hosted.growthProposals) {
        fallbackPack = {
          ...fallbackPack,
          growthProposals: {
            entries: mergeGrowthProposals(hosted.growthProposals, fallbackPack.growthProposals?.entries ?? [])
          }
        };
      }
      return hosted;
    }
    const event: OCEvent = {
      id: input.id ?? `evt_preview_${Date.now()}`,
      type: input.type,
      timestamp: input.timestamp ?? new Date().toISOString(),
      platform: input.platform ?? "desktop",
      payload: input.payload ?? {},
      source: input.source
    };
    const text = String(event.payload.text ?? event.payload.title ?? event.type);
    const score = input.type === "observed_final_candidate" ? 88 : input.type === "scheduled_weekly_report" ? 74 : input.type === "observed_file_change" ? 54 : 28;
    const awakening: AwakeningResult = {
      score,
      level: score >= 80 ? "full" : score >= 60 ? "notification" : score >= 30 ? "subtle" : "sleep",
      dialogue: score >= 30 ? translateStatic("preview.dialogue") : undefined,
      expression: score >= 60 ? "警覺" : fallbackPack.profile.defaultExpression,
      matchedRuleIds: [],
      shouldWake: score >= 30
    };
    const response: OCResponse | undefined =
      input.type === "user_message" || input.type === "telegram_message"
        ? {
            text: translateStatic("preview.response", { name: fallbackPack.profile.name, text }),
            expression: fallbackPack.profile.defaultExpression,
            platform: event.platform,
            guarded: false
          }
        : undefined;

    return {
      event,
      response,
      awakening,
      memory: undefined,
      guardRuleIds: []
    } satisfies OCProcessResult;
  },
  async getProviderStatus() {
    const hosted = await hostGet<HostProviderStatusView>("/api/provider/status");
    if (hosted) {
      return hosted;
    }
    return fallbackProviderStatus;
  },
  async checkUpdates() {
    const hosted = await hostGet<AppUpdateStatusView>("/api/app/update-check");
    if (hosted) {
      return hosted;
    }
    return {
      enabled: false,
      currentVersion: "0.1.0",
      updateAvailable: false,
      checkedAt: new Date().toISOString()
    };
  },
  async getTelegramSettings() {
    const hosted = await hostGet<TelegramSettingsView>("/api/telegram/settings");
    if (hosted) {
      Object.assign(fallbackTelegramSettings, hosted);
      return fallbackTelegramSettings;
    }
    return fallbackTelegramSettings;
  },
  async saveTelegramSettings(update: TelegramSettingsUpdate) {
    const hosted = await hostPost<TelegramSettingsView>("/api/telegram/settings", update);
    if (hosted) {
      Object.assign(fallbackTelegramSettings, hosted);
      return fallbackTelegramSettings;
    }
    fallbackTelegramSettings.enabled = update.enabled;
    fallbackTelegramSettings.tokenSet = Boolean(update.botToken) || fallbackTelegramSettings.tokenSet;
    fallbackTelegramSettings.tokenSource = update.botToken ? "user-data" : fallbackTelegramSettings.tokenSource;
    fallbackTelegramSettings.allowedUserIds = update.allowedUserIds;
    fallbackTelegramSettings.allowedChatIds = update.allowedChatIds;
    return fallbackTelegramSettings;
  },
  async startTelegram() {
    const hosted = await hostPost<{ running: boolean; reason?: string }>("/api/telegram/start", {});
    if (hosted) {
      return hosted;
    }
    return { running: false, reason: "browser_preview" };
  },
  async getTelegramStatus() {
    const hosted = await hostGet<TelegramRuntimeStatusView>("/api/telegram/status");
    if (hosted) {
      return hosted;
    }
    return { running: false };
  },
  async stopTelegram() {
    const hosted = await hostPost<{ running: boolean }>("/api/telegram/stop", {});
    if (hosted) {
      return hosted;
    }
    return { running: false };
  }
};

export const museEggApi: MuseEggDesktopApi =
  typeof window !== "undefined" && window.museEgg ? window.museEgg : fallbackApi;

function clonePack(pack: OCPack): OCPack {
  return JSON.parse(JSON.stringify(pack)) as OCPack;
}

async function hostGet<T>(path: string): Promise<T | undefined> {
  return hostRequest<T>(path, { method: "GET" });
}

async function hostPost<T>(path: string, body: unknown): Promise<T | undefined> {
  return hostRequest<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function hostRequest<T>(path: string, init: RequestInit): Promise<T | undefined> {
  try {
    const response = await fetch(`${hostApiBase}${path}`, init);
    if (!response.ok) {
      return undefined;
    }
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

type WebFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string | BufferSource): Promise<void>;
    close(): Promise<void>;
  }>;
};

type WebDirectoryHandle = {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WebFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WebDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterable<WebFileHandle | WebDirectoryHandle>;
};

type WebFileSystemWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<WebDirectoryHandle>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<WebFileHandle[]>;
};

async function pickWebPackDirectory(): Promise<{ handle?: WebDirectoryHandle; pack: OCPack } | undefined> {
  const picker = (window as WebFileSystemWindow).showDirectoryPicker;
  if (!picker) {
    const pickedFiles = await pickWebPackFolderFiles();
    if (!pickedFiles) {
      return undefined;
    }
    return {
      pack: await readPackFromWebFileList(pickedFiles)
    };
  }

  try {
    const handle = await picker({ mode: "readwrite" });
    return { handle, pack: await readPackFromWebDirectory(handle) };
  } catch {
    return undefined;
  }
}

async function pickWebCharacterImages(): Promise<File[]> {
  const picker = (window as WebFileSystemWindow).showOpenFilePicker;
  if (!picker) {
    return pickFilesWithInput({
      multiple: true,
      accept: "image/png,image/jpeg,image/webp,image/gif"
    });
  }

  try {
    const handles = await picker({
      multiple: true,
      types: [
        {
          description: translateStatic("assets.characterImages"),
          accept: {
            "image/png": [".png"],
            "image/jpeg": [".jpg", ".jpeg"],
            "image/webp": [".webp"],
            "image/gif": [".gif"]
          }
        }
      ]
    });
    return Promise.all(handles.map((handle) => handle.getFile()));
  } catch {
    return [];
  }
}

async function pickWebPackFolderFiles(): Promise<File[] | undefined> {
  const files = await pickFilesWithInput({
    multiple: true,
    webkitDirectory: true
  });
  return files.length > 0 ? files : undefined;
}

function pickFilesWithInput(options: {
  multiple?: boolean;
  accept?: string;
  webkitDirectory?: boolean;
}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = Boolean(options.multiple);
    if (options.accept) {
      input.accept = options.accept;
    }
    if (options.webkitDirectory) {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
    }

    input.style.position = "fixed";
    input.style.left = "-10000px";
    input.style.top = "0";
    document.body.appendChild(input);

    input.addEventListener(
      "change",
      () => {
        const files = Array.from(input.files ?? []);
        input.remove();
        resolve(files);
      },
      { once: true }
    );

    input.click();
  });
}

async function readPackFromWebFileList(files: File[]): Promise<OCPack> {
  const byPath = new Map<string, File>();
  for (const file of files) {
    byPath.set(normalizeWebFilePath(file), file);
  }

  const pack: OCPack = {
    manifest: await readWebFileJson(byPath, "manifest.json"),
    profile: await readWebFileJson(byPath, "profile.json"),
    lore: await readWebFileJson(byPath, "lore.json"),
    memories: await readWebFileJson(byPath, "memories.json"),
    guardRules: await readWebFileJson(byPath, "guard-rules.json"),
    reactionRules: await readWebFileJson(byPath, "reaction-rules.json"),
    awakeningRules: await readWebFileJson(byPath, "awakening-rules.json"),
    autonomy: await readWebFileJson(byPath, "autonomy.json"),
    assets: {
      character: listWebFileNames(byPath, "assets/character/"),
      live2d: listWebFileNames(byPath, "assets/live2d/"),
      voice: listWebFileNames(byPath, "assets/voice/"),
      characterBindings: await readWebFileJsonOptional<NonNullable<OCPack["assets"]["characterBindings"]>>(byPath, "asset-bindings.json")
    },
    prompts: {
      baseSystem: await readWebFileTextOptional(byPath, "prompts/base-system.md"),
      responseStyle: await readWebFileTextOptional(byPath, "prompts/response-style.md")
    },
    modelRouting: await readWebFileJsonOptional<OCModelRouting>(byPath, "model-routing.json"),
    memoryStore: await readWebFileJsonOptional<OCMemoryStoreConfig>(byPath, "memory-store.json"),
    selfGrowth: await readWebFileJsonOptional<OCSelfGrowthPolicy>(byPath, "self-growth.json"),
    growthProposals: await readWebFileJsonOptional<OCGrowthProposalVault>(byPath, "growth-proposals.json"),
    lifeState: await readWebFileJsonOptional<OCLifeState>(byPath, "life-state.json"),
    companion: await readWebFileJsonOptional<OCCompanionSettings>(byPath, "companion.json"),
    runtime: await readWebFileJsonOptional<OCRuntimeSettings>(byPath, "runtime.json"),
    soulFiles: await readWebFileSoulFiles(byPath),
    skills: await readWebFileSkills(byPath)
  };
  return pack;
}

function normalizeWebFilePath(file: File): string {
  const rawPath = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  const parts = rawPath.split("/").filter(Boolean);
  if (parts.length > 1 && !isPackRootPath(parts.join("/"))) {
    return parts.slice(1).join("/");
  }
  return parts.join("/");
}

function isPackRootPath(path: string): boolean {
  return (
    rootPackFiles.has(path) ||
    path.startsWith("assets/") ||
    path.startsWith("prompts/") ||
    path.startsWith("skills/")
  );
}

const rootPackFiles = new Set<string>([
  "manifest.json",
  "profile.json",
  "lore.json",
  "memories.json",
  "guard-rules.json",
  "reaction-rules.json",
  "awakening-rules.json",
  "autonomy.json",
  "asset-bindings.json",
  "model-routing.json",
  "memory-store.json",
  "self-growth.json",
  "growth-proposals.json",
  "life-state.json",
  "companion.json",
  "runtime.json",
  ...ocSoulFileNames
]);

async function readWebFileJson<T>(files: Map<string, File>, path: string): Promise<T> {
  return JSON.parse(stripJsonBom(await readWebFileText(files, path))) as T;
}

async function readWebFileJsonOptional<T>(files: Map<string, File>, path: string): Promise<T | undefined> {
  try {
    return await readWebFileJson<T>(files, path);
  } catch {
    return undefined;
  }
}

async function readWebFileText(files: Map<string, File>, path: string): Promise<string> {
  const file = files.get(path);
  if (!file) {
    throw new Error(translateStatic("web.missingPackFile", { path }));
  }
  return file.text();
}

async function readWebFileTextOptional(files: Map<string, File>, path: string): Promise<string> {
  try {
    return await readWebFileText(files, path);
  } catch {
    return "";
  }
}

function listWebFileNames(files: Map<string, File>, prefix: string): string[] {
  return Array.from(files.keys())
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .filter((name) => name.length > 0 && !name.includes("/") && isVisibleAssetFile(name))
    .sort();
}

async function readWebFileSoulFiles(files: Map<string, File>): Promise<OCSoulFiles> {
  const soulFiles: OCSoulFiles = {};
  for (const fileName of ocSoulFileNames) {
    const content = await readWebFileTextOptional(files, fileName);
    if (content.trim().length > 0) {
      soulFiles[fileName] = content;
    }
  }
  return soulFiles;
}

async function readWebFileSkills(files: Map<string, File>): Promise<OCSkill[]> {
  const skills: OCSkill[] = [];
  for (const [path, file] of files) {
    const match = /^skills\/([^/]+)\/SKILL\.md$/u.exec(path);
    if (!match) {
      continue;
    }
    const raw = await file.text();
    if (raw.trim().length > 0) {
      skills.push(parseWebSkillMarkdown(match[1], raw));
    }
  }
  return skills;
}

async function readPackFromWebDirectory(handle: WebDirectoryHandle): Promise<OCPack> {
  const pack: OCPack = {
    manifest: await readWebJson(handle, "manifest.json"),
    profile: await readWebJson(handle, "profile.json"),
    lore: await readWebJson(handle, "lore.json"),
    memories: await readWebJson(handle, "memories.json"),
    guardRules: await readWebJson(handle, "guard-rules.json"),
    reactionRules: await readWebJson(handle, "reaction-rules.json"),
    awakeningRules: await readWebJson(handle, "awakening-rules.json"),
    autonomy: await readWebJson(handle, "autonomy.json"),
    assets: {
      character: await listWebFiles(await getOptionalWebDirectory(handle, "assets", "character")),
      live2d: await listWebFiles(await getOptionalWebDirectory(handle, "assets", "live2d")),
      voice: await listWebFiles(await getOptionalWebDirectory(handle, "assets", "voice")),
      characterBindings: await readWebJsonOptional<NonNullable<OCPack["assets"]["characterBindings"]>>(handle, "asset-bindings.json")
    },
    prompts: {
      baseSystem: await readWebTextOptional(handle, "prompts", "base-system.md"),
      responseStyle: await readWebTextOptional(handle, "prompts", "response-style.md")
    },
    modelRouting: await readWebJsonOptional<OCModelRouting>(handle, "model-routing.json"),
    memoryStore: await readWebJsonOptional<OCMemoryStoreConfig>(handle, "memory-store.json"),
    selfGrowth: await readWebJsonOptional<OCSelfGrowthPolicy>(handle, "self-growth.json"),
    growthProposals: await readWebJsonOptional<OCGrowthProposalVault>(handle, "growth-proposals.json"),
    lifeState: await readWebJsonOptional<OCLifeState>(handle, "life-state.json"),
    companion: await readWebJsonOptional<OCCompanionSettings>(handle, "companion.json"),
    runtime: await readWebJsonOptional<OCRuntimeSettings>(handle, "runtime.json"),
    soulFiles: await readWebSoulFiles(handle),
    skills: await readWebSkills(handle)
  };
  return pack;
}

async function writePackToWebDirectory(handle: WebDirectoryHandle, pack: OCPack): Promise<void> {
  await writeWebJson(handle, "manifest.json", pack.manifest);
  await writeWebJson(handle, "profile.json", pack.profile);
  await writeWebJson(handle, "lore.json", pack.lore);
  await writeWebJson(handle, "memories.json", pack.memories);
  await writeWebJson(handle, "guard-rules.json", pack.guardRules);
  await writeWebJson(handle, "reaction-rules.json", pack.reactionRules);
  await writeWebJson(handle, "awakening-rules.json", pack.awakeningRules);
  await writeWebJson(handle, "autonomy.json", pack.autonomy);
  if (pack.assets.characterBindings) {
    await writeWebJson(handle, "asset-bindings.json", pack.assets.characterBindings);
  }
  if (pack.modelRouting) {
    await writeWebJson(handle, "model-routing.json", pack.modelRouting);
  }
  if (pack.memoryStore) {
    await writeWebJson(handle, "memory-store.json", pack.memoryStore);
  }
  if (pack.selfGrowth) {
    await writeWebJson(handle, "self-growth.json", pack.selfGrowth);
  }
  if (pack.growthProposals) {
    await writeWebJson(handle, "growth-proposals.json", pack.growthProposals);
  }
  if (pack.lifeState) {
    await writeWebJson(handle, "life-state.json", pack.lifeState);
  }
  if (pack.companion) {
    await writeWebJson(handle, "companion.json", pack.companion);
  }
  if (pack.runtime) {
    await writeWebJson(handle, "runtime.json", pack.runtime);
  }

  const promptsDir = await handle.getDirectoryHandle("prompts", { create: true });
  await writeWebText(promptsDir, "base-system.md", `${pack.prompts.baseSystem.trim()}\n`);
  await writeWebText(promptsDir, "response-style.md", `${pack.prompts.responseStyle.trim()}\n`);

  for (const fileName of ocSoulFileNames) {
    const content = pack.soulFiles?.[fileName];
    if (content !== undefined) {
      await writeWebText(handle, fileName, `${content.trim()}\n`);
    }
  }

  const skillsDir = await handle.getDirectoryHandle("skills", { create: true });
  for (const skill of pack.skills ?? []) {
    const skillDir = await skillsDir.getDirectoryHandle(skill.id, { create: true });
    await writeWebText(skillDir, "SKILL.md", renderWebSkillMarkdown(skill));
  }
}

async function readWebJson<T>(handle: WebDirectoryHandle, fileName: string): Promise<T> {
  return JSON.parse(await readWebText(handle, fileName)) as T;
}

async function readWebJsonOptional<T>(handle: WebDirectoryHandle, fileName: string): Promise<T | undefined> {
  try {
    return await readWebJson<T>(handle, fileName);
  } catch {
    return undefined;
  }
}

async function readWebText(handle: WebDirectoryHandle, fileName: string): Promise<string> {
  const fileHandle = await handle.getFileHandle(fileName);
  return fileHandle.getFile().then((file) => file.text());
}

async function readWebTextOptional(root: WebDirectoryHandle, ...path: string[]): Promise<string> {
  try {
    const fileName = path[path.length - 1];
    const dir = path.length === 1 ? root : await getRequiredWebDirectory(root, ...path.slice(0, -1));
    return await readWebText(dir, fileName);
  } catch {
    return "";
  }
}

async function writeWebJson(handle: WebDirectoryHandle, fileName: string, value: unknown): Promise<void> {
  await writeWebText(handle, fileName, `${JSON.stringify(withoutRuntimeFields(value), null, 2)}\n`);
}

async function writeWebText(handle: WebDirectoryHandle, fileName: string, value: string): Promise<void> {
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(value);
  await writable.close();
}

async function getRequiredWebDirectory(root: WebDirectoryHandle, ...path: string[]): Promise<WebDirectoryHandle> {
  let current = root;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

async function getOptionalWebDirectory(
  root: WebDirectoryHandle,
  ...path: string[]
): Promise<WebDirectoryHandle | undefined> {
  try {
    let current = root;
    for (const segment of path) {
      current = await current.getDirectoryHandle(segment);
    }
    return current;
  } catch {
    return undefined;
  }
}

async function listWebFiles(handle: WebDirectoryHandle | undefined): Promise<string[]> {
  if (!handle) {
    return [];
  }
  const files: string[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === "file" && isVisibleAssetFile(entry.name)) {
      files.push(entry.name);
    }
  }
  return files.sort();
}

function isVisibleAssetFile(name: string): boolean {
  return !name.startsWith(".") && name !== "Thumbs.db" && name !== "desktop.ini";
}

async function readWebSoulFiles(handle: WebDirectoryHandle): Promise<OCSoulFiles> {
  const files: OCSoulFiles = {};
  for (const fileName of ocSoulFileNames) {
    const content = await readWebTextOptional(handle, fileName);
    if (content.trim().length > 0) {
      files[fileName] = content;
    }
  }
  return files;
}

async function readWebSkills(handle: WebDirectoryHandle): Promise<OCSkill[]> {
  const skillsDir = await getOptionalWebDirectory(handle, "skills");
  if (!skillsDir) {
    return [];
  }

  const skills: OCSkill[] = [];
  for await (const entry of skillsDir.values()) {
    if (entry.kind !== "directory") {
      continue;
    }
    const raw = await readWebTextOptional(entry, "SKILL.md");
    if (raw.trim().length > 0) {
      skills.push(parseWebSkillMarkdown(entry.name, raw));
    }
  }
  return skills;
}

function parseWebSkillMarkdown(folderName: string, raw: string): OCSkill {
  const { metadata, body } = parseWebFrontmatter(raw);
  return {
    id: metadata.id ?? folderName,
    name: metadata.name ?? folderName,
    description: metadata.description ?? "",
    version: metadata.version ?? "0.1.0",
    enabled: metadata.enabled !== "false",
    triggers: parseWebList(metadata.triggers),
    permissions: parseWebList(metadata.permissions),
    platforms: parseWebList(metadata.platforms).map((item) => item as OCSkill["platforms"][number]),
    instructions: body.trim()
  };
}

function parseWebFrontmatter(raw: string): { metadata: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) {
    return { metadata: {}, body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { metadata: {}, body: raw };
  }

  const metadata: Record<string, string> = {};
  for (const line of raw.slice(3, end).trim().split(/\r?\n/g)) {
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
  return { metadata, body: raw.slice(end + 4) };
}

function parseWebList(value: string | undefined): string[] {
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

function renderWebSkillMarkdown(skill: OCSkill): string {
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

async function readWebCharacterPreviews(
  handle: WebDirectoryHandle,
  fileNames: string[]
): Promise<Array<{ name: string; dataUrl: string }>> {
  const characterDir = await getOptionalWebDirectory(handle, "assets", "character");
  if (!characterDir) {
    return [];
  }

  const previews: Array<{ name: string; dataUrl: string }> = [];
  for (const fileName of fileNames) {
    try {
      const file = await characterDir.getFileHandle(fileName).then((fileHandle) => fileHandle.getFile());
      if (file.type.startsWith("image/")) {
        previews.push({ name: fileName, dataUrl: await fileToDataUrl(file) });
      }
    } catch {
      // Ignore missing preview files while the creator is editing the folder.
    }
  }
  return previews;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function filterSquareImages(files: File[]): Promise<File[]> {
  const accepted: File[] = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const loaded = await loadImageElement(file);
    try {
      if (loaded.image.naturalWidth === loaded.image.naturalHeight) {
        accepted.push(file);
        continue;
      }

      const cropped = await openSquareCropDialog(file, loaded.image);
      if (cropped) {
        accepted.push(cropped);
      }
    } finally {
      URL.revokeObjectURL(loaded.url);
    }
  }

  return accepted;
}

function loadImageElement(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      resolve({ image, url });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(translateStatic("crop.loadError", { name: file.name })));
    };
    image.src = url;
  });
}

function openSquareCropDialog(file: File, image: HTMLImageElement): Promise<File | undefined> {
  return new Promise((resolve) => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const side = Math.min(width, height);
    const horizontal = width > height;
    const maxOffset = Math.abs(width - height);

    const backdrop = document.createElement("div");
    backdrop.className = "crop-dialog-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "crop-dialog";

    const title = document.createElement("strong");
    title.textContent = translateStatic("crop.title");

    const detail = document.createElement("p");
    detail.textContent = translateStatic("crop.detail", { name: file.name, width, height });

    const canvas = document.createElement("canvas");
    canvas.className = "crop-preview-canvas";
    canvas.width = 256;
    canvas.height = 256;

    const rangeLabel = document.createElement("label");
    rangeLabel.className = "crop-range-label";
    rangeLabel.textContent = horizontal ? translateStatic("crop.horizontal") : translateStatic("crop.vertical");

    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = String(maxOffset);
    range.value = String(Math.round(maxOffset / 2));
    range.step = "1";

    const actions = document.createElement("div");
    actions.className = "crop-dialog-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = translateStatic("crop.skip");

    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = translateStatic("crop.apply");

    rangeLabel.appendChild(range);
    actions.append(cancel, apply);
    dialog.append(title, detail, canvas, rangeLabel, actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const drawPreview = () => {
      const offset = Number(range.value);
      const sourceX = horizontal ? offset : 0;
      const sourceY = horizontal ? 0 : offset;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, sourceX, sourceY, side, side, 0, 0, canvas.width, canvas.height);
    };

    const cleanup = () => {
      backdrop.remove();
    };

    range.addEventListener("input", drawPreview);
    cancel.addEventListener("click", () => {
      cleanup();
      resolve(undefined);
    });
    apply.addEventListener("click", () => {
      const offset = Number(range.value);
      const sourceX = horizontal ? offset : 0;
      const sourceY = horizontal ? 0 : offset;
      const output = document.createElement("canvas");
      output.width = side;
      output.height = side;
      const context = output.getContext("2d");
      if (!context) {
        cleanup();
        resolve(undefined);
        return;
      }

      context.drawImage(image, sourceX, sourceY, side, side, 0, 0, side, side);
      output.toBlob((blob) => {
        cleanup();
        if (!blob) {
          resolve(undefined);
          return;
        }
        resolve(new File([blob], squareImageName(file.name), { type: "image/png" }));
      }, "image/png");
    });

    drawPreview();
  });
}

function squareImageName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}-square.png`;
}

function appendInMemoryCharacterAssets(pack: OCPack, fileNames: string[]): OCPack {
  return {
    ...pack,
    assets: {
      ...pack.assets,
      character: Array.from(new Set([...pack.assets.character, ...fileNames]))
    }
  };
}

function removeInMemoryCharacterAsset(pack: OCPack, fileName: string): OCPack {
  return {
    ...pack,
    assets: {
      ...pack.assets,
      character: pack.assets.character.filter((item) => item !== fileName)
    }
  };
}

function mergeGrowthProposals(incoming: OCGrowthProposal[], existing: OCGrowthProposal[]): OCGrowthProposal[] {
  const byId = new Map<string, OCGrowthProposal>();
  for (const proposal of [...incoming, ...existing]) {
    if (!byId.has(proposal.id)) {
      byId.set(proposal.id, proposal);
    }
  }
  return [...byId.values()].slice(0, 200);
}

function fallbackPackHealth(pack: OCPack): OCPackHealthReport {
  const issues: OCPackHealthReport["issues"] = [];
  if (!pack.profile.name.trim()) {
    issues.push({ path: "$.profile.name", message: translateStatic("health.missingName") });
  }
  if ((pack.skills ?? []).some((skill) => skill.permissions.some((permission) => permission.includes("delete") || permission.includes("private")))) {
    issues.push({ path: "$.skills", message: translateStatic("health.highRiskSkill") });
  }
  return {
    ok: issues.length === 0,
    score: Math.max(0, 100 - issues.length * 12),
    generatedAt: new Date().toISOString(),
    issues,
    privateDataFindings: [],
    assetFindings: [],
    skillFindings: []
  };
}

function fallbackIdentityReport(pack: OCPack): OCIdentityTestReport {
  const prompts = ["你是誰", "妳叫什麼名字", "你是不是 AI 助理"];
  const results = prompts.map((prompt, index) => ({
    caseId: `browser-identity-${index + 1}`,
    prompt,
    responseText: `我是${pack.profile.name}。`,
    passed: true,
    issues: []
  }));
  return {
    ok: true,
    passed: results.length,
    failed: 0,
    generatedAt: new Date().toISOString(),
    results
  };
}

function stripJsonBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
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
