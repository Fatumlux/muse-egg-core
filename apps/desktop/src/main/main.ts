import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { appendFile, copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TelegramAdapter, type TelegramAdapterSettings } from "@muse-egg/adapters";
import {
  exportOCPack,
  FolderIndexEngine,
  IdentityTestEngine,
  listPackBackups,
  loadOCPack,
  OCEngine,
  PackHealthEngine,
  PlatformRouter,
  restorePackBackup,
  saveOCPack,
  type OCEventInput
} from "@muse-egg/core";
import type { OCPack } from "@muse-egg/oc-schema";
import { createHostAIProvider, getHostProviderStatus, type HostProviderStatus } from "./hostProvider.js";
import { checkForAppUpdates, type AppUpdateStatus } from "./updateChecker.js";

interface TelegramSettingsView {
  enabled: boolean;
  tokenSet: boolean;
  tokenSource: "user-data" | "environment" | "none";
  allowedUserIds: number[];
  allowedChatIds: number[];
  botUsername?: string;
  mentionPatterns?: string[];
  requireMentionInGroups?: boolean;
  ignoreBotMessages?: boolean;
}

interface TelegramSettingsUpdate {
  enabled: boolean;
  botToken?: string;
  allowedUserIds: number[];
  allowedChatIds: number[];
}

interface TelegramSettings extends TelegramAdapterSettings {
  tokenSource: "user-data" | "environment" | "none";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.setName("MuseEgg Core");

let mainWindow: BrowserWindow | undefined;
let currentPack: OCPack | undefined;
let engine: OCEngine | undefined;
let router: PlatformRouter | undefined;
let telegramAdapter: TelegramAdapter | undefined;

function workspaceRoot(): string {
  return resolve(process.cwd(), "../..");
}

function ensureEngine(pack: OCPack): void {
  currentPack = pack;
  engine = new OCEngine(pack, { aiProvider: createHostAIProvider() });
  router = new PlatformRouter(engine);
}

async function ensureDefaultPack(): Promise<void> {
  if (!currentPack) {
    const activePath = await resolveActivePackPath();
    ensureEngine(await loadOCPack(activePath ?? resolve(workspaceRoot(), "oc-packs", "example-muse")));
  }
}

function requireEngine(): { engine: OCEngine; router: PlatformRouter; pack: OCPack } {
  if (!engine || !router || !currentPack) {
    throw new Error("No OC Pack is loaded.");
  }
  return { engine, router, pack: currentPack };
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#111827",
    title: "MuseEgg Core",
    icon: join(process.cwd(), "public", "museegg.ico"),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.on("console-message", (_event, level, message) => {
    void runtimeLog(`renderer console level=${level} ${message}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    void runtimeLog(`renderer did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    void runtimeLog(`renderer gone ${details.reason} exitCode=${details.exitCode}`);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(join(process.cwd(), "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  registerIpc();
  await ensureDefaultPack();
  try {
    const telegram = await startTelegramFromSettings();
    await runtimeLog(`telegram startup ${JSON.stringify(telegram)}`);
    setTimeout(() => {
      void runtimeLog(`telegram status ${JSON.stringify(telegramAdapter?.status() ?? { running: false })}`);
    }, 3000);
    logTelegramStatusSamples();
  } catch (error) {
    await runtimeLog(`telegram startup error ${error instanceof Error ? error.message : String(error)}`);
  }
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void telegramAdapter?.stop();
});

function registerIpc(): void {
  ipcMain.handle("pack:load-example", async () => {
    const pack = await loadOCPack(resolve(workspaceRoot(), "oc-packs", "example-muse"));
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? resolve(workspaceRoot(), "oc-packs", "example-muse"), "load-example");
    return pack;
  });

  ipcMain.handle("pack:load-active", async () => {
    const activePath = await resolveActivePackPath();
    const pack = await loadOCPack(activePath ?? resolve(workspaceRoot(), "oc-packs", "example-muse"));
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? activePath ?? resolve(workspaceRoot(), "oc-packs", "example-muse"), "load-active");
    return pack;
  });

  ipcMain.handle("pack:load-blank", async () => {
    const pack = await loadOCPack(resolve(workspaceRoot(), "oc-packs", "blank-template"));
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? resolve(workspaceRoot(), "oc-packs", "blank-template"), "load-blank");
    return pack;
  });

  ipcMain.handle("pack:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "匯入 OC Pack",
      properties: ["openDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }
    const pack = await loadOCPack(result.filePaths[0]);
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? result.filePaths[0], "import");
    return pack;
  });

  ipcMain.handle("pack:update-session", (_event, pack: OCPack) => {
    ensureEngine({ ...pack, path: currentPack?.path ?? pack.path });
    return currentPack;
  });

  ipcMain.handle("pack:save", async (_event, pack: OCPack) => {
    const targetPath = currentPack?.path ?? pack.path;
    const savedPath = await saveOCPack({ ...pack, path: targetPath }, targetPath);
    const reloaded = await loadOCPack(savedPath);
    ensureEngine(reloaded);
    await writeActivePackPath(savedPath, "save");
    return reloaded;
  });

  ipcMain.handle("pack:export", async (_event, pack: OCPack) => {
    const result = await dialog.showOpenDialog({
      title: "匯出 OC Pack 到資料夾",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }
    const exportedPath = await exportOCPack({ ...pack, path: currentPack?.path ?? pack.path }, result.filePaths[0]);
    const reloaded = await loadOCPack(exportedPath);
    ensureEngine(reloaded);
    await writeActivePackPath(exportedPath, "export");
    return reloaded;
  });

  ipcMain.handle("pack:health", async () => {
    const { pack } = requireEngine();
    return new PackHealthEngine(pack).report({ includeIdentityTests: true });
  });

  ipcMain.handle("pack:identity-tests", async () => {
    const { pack } = requireEngine();
    return new IdentityTestEngine(pack, createHostAIProvider()).run();
  });

  ipcMain.handle("pack:list-backups", async () => {
    const { pack } = requireEngine();
    return pack.path ? listPackBackups(pack.path) : [];
  });

  ipcMain.handle("pack:restore-backup", async (_event, backupId: string) => {
    const { pack } = requireEngine();
    if (!pack.path) {
      throw new Error("沒有可回滾的 OC Pack 路徑。");
    }
    await restorePackBackup(pack.path, backupId);
    const reloaded = await loadOCPack(pack.path);
    ensureEngine(reloaded);
    return reloaded;
  });

  ipcMain.handle("folder-index:scan", async () => {
    const { pack } = requireEngine();
    return new FolderIndexEngine(pack).scan();
  });

  ipcMain.handle("folder-index:add-root", async () => {
    const { pack } = requireEngine();
    return pack;

  });

  ipcMain.handle("pack:add-character-asset", async () => {
    const { pack } = requireEngine();
    if (!pack.path) {
      throw new Error("新增資源前，請先載入或儲存這個 OC Pack。");
    }

    const result = await dialog.showOpenDialog({
      title: "新增角色資源",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return pack;
    }

    const targetDir = join(pack.path, "assets", "character");
    await mkdir(targetDir, { recursive: true });
    for (const sourcePath of result.filePaths) {
      await copyFile(sourcePath, join(targetDir, basename(sourcePath)));
    }

    const reloaded = await loadOCPack(pack.path);
    ensureEngine(reloaded);
    return reloaded;
  });

  ipcMain.handle("pack:get-character-asset-previews", async () => {
    const { pack } = requireEngine();
    if (!pack.path) {
      return [];
    }

    const previews: Array<{ name: string; dataUrl: string }> = [];
    for (const fileName of pack.assets.character) {
      const ext = extname(fileName).toLowerCase();
      const mime = imageMime(ext);
      if (!mime) {
        continue;
      }

      try {
        const bytes = await readFile(join(pack.path, "assets", "character", fileName));
        previews.push({
          name: fileName,
          dataUrl: `data:${mime};base64,${bytes.toString("base64")}`
        });
      } catch {
        // Ignore missing files so a half-edited OC Pack can still open.
      }
    }

    return previews;
  });

  ipcMain.handle("pack:remove-character-asset", async (_event, fileName: string) => {
    const { pack } = requireEngine();
    if (!pack.path) {
      throw new Error("Cannot remove a character asset without a loaded OC Pack path.");
    }

    await unlink(join(pack.path, "assets", "character", basename(fileName))).catch(() => undefined);
    const reloaded = await loadOCPack(pack.path);
    ensureEngine(reloaded);
    return reloaded;
  });

  ipcMain.handle("event:dispatch", async (_event, input: OCEventInput) => {
    const state = requireEngine();
    return state.engine.processEvent(input);
  });

  ipcMain.handle("provider:get-status", async (): Promise<HostProviderStatus> => {
    return getHostProviderStatus();
  });

  ipcMain.handle("app:check-updates", async (): Promise<AppUpdateStatus> => {
    return checkForAppUpdates(workspaceRoot());
  });

  ipcMain.handle("telegram:get-settings", async (): Promise<TelegramSettingsView> => {
    const settings = await readTelegramSettings();
    return {
      enabled: settings.enabled,
      tokenSet: Boolean(settings.botToken),
      tokenSource: settings.tokenSource,
      allowedUserIds: settings.allowedUserIds,
      allowedChatIds: settings.allowedChatIds,
      botUsername: settings.botUsername,
      mentionPatterns: settings.mentionPatterns,
      requireMentionInGroups: settings.requireMentionInGroups,
      ignoreBotMessages: settings.ignoreBotMessages
    };
  });

  ipcMain.handle("telegram:save-settings", async (_event, update: TelegramSettingsUpdate) => {
    const current = await readTelegramSettings();
    const providedToken = update.botToken && update.botToken.trim().length > 0 ? update.botToken.trim() : undefined;
    const storedToken = providedToken ?? (current.tokenSource === "user-data" ? current.botToken : undefined);
    const next: TelegramAdapterSettings = {
      enabled: update.enabled,
      botToken: storedToken,
      allowedUserIds: update.allowedUserIds,
      allowedChatIds: update.allowedChatIds,
      pollingIntervalMs: current.pollingIntervalMs,
      botUsername: current.botUsername,
      mentionPatterns: current.mentionPatterns,
      requireMentionInGroups: current.requireMentionInGroups,
      ignoreBotMessages: current.ignoreBotMessages
    };
    await writeTelegramSettings(next);
    const effective = await readTelegramSettings();
    return {
      enabled: effective.enabled,
      tokenSet: Boolean(effective.botToken),
      tokenSource: effective.tokenSource,
      allowedUserIds: effective.allowedUserIds,
      allowedChatIds: effective.allowedChatIds,
      botUsername: effective.botUsername,
      mentionPatterns: effective.mentionPatterns,
      requireMentionInGroups: effective.requireMentionInGroups,
      ignoreBotMessages: effective.ignoreBotMessages
    } satisfies TelegramSettingsView;
  });

  ipcMain.handle("telegram:start", async () => {
    return startTelegramFromSettings();
  });

  ipcMain.handle("telegram:status", () => {
    return telegramAdapter?.status() ?? { running: false };
  });

  ipcMain.handle("telegram:stop", async () => {
    await telegramAdapter?.stop();
    telegramAdapter = undefined;
    return { running: false };
  });
}

async function startTelegramFromSettings(): Promise<{ running: boolean; reason?: string }> {
  await ensureDefaultPack();
  const state = requireEngine();
  const settings = await readTelegramSettings();
  await runtimeLog(
    `telegram settings ${JSON.stringify({
      enabled: settings.enabled,
      tokenSet: Boolean(settings.botToken),
      allowedUserIds: settings.allowedUserIds.length,
      allowedChatIds: settings.allowedChatIds.length,
      botUsername: settings.botUsername,
      requireMentionInGroups: settings.requireMentionInGroups
    })}`
  );
  await telegramAdapter?.stop();
  telegramAdapter = undefined;

  if (!settings.enabled || !settings.botToken) {
    return { running: false, reason: "disabled_or_missing_token" };
  }

  telegramAdapter = new TelegramAdapter(settings, state.router);
  telegramAdapter.start();
  return { running: telegramAdapter.isRunning() };
}

function logTelegramStatusSamples(): void {
  let samples = 0;
  const timer = setInterval(() => {
    samples += 1;
    void runtimeLog(`telegram status sample ${JSON.stringify(telegramAdapter?.status() ?? { running: false })}`);
    if (samples >= 6) {
      clearInterval(timer);
    }
  }, 5000);
}

async function runtimeLog(message: string): Promise<void> {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    await appendFile(join(app.getPath("userData"), "runtime.log"), line, "utf8");
  } catch {
    // Runtime logging must never break the app.
  }
}

async function readTelegramSettings(): Promise<TelegramSettings> {
  const settingsPath = telegramSettingsPath();
  const envToken = readTelegramTokenFromEnv();
  const envAllowedUserIds = readNumberListEnv("MUSEEGG_TELEGRAM_ALLOWED_USER_IDS", "TELEGRAM_ALLOWED_USER_IDS");
  const envAllowedChatIds = readNumberListEnv("MUSEEGG_TELEGRAM_ALLOWED_CHAT_IDS", "TELEGRAM_ALLOWED_CHAT_IDS");

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(stripJsonBom(raw)) as TelegramAdapterSettings;
    const botToken = parsed.botToken ?? envToken;
    return {
      enabled: Boolean(parsed.enabled),
      botToken,
      tokenSource: parsed.botToken ? "user-data" : envToken ? "environment" : "none",
      allowedUserIds: Array.isArray(parsed.allowedUserIds) && parsed.allowedUserIds.length > 0 ? parsed.allowedUserIds : envAllowedUserIds,
      allowedChatIds: Array.isArray(parsed.allowedChatIds) && parsed.allowedChatIds.length > 0 ? parsed.allowedChatIds : envAllowedChatIds,
      pollingIntervalMs: parsed.pollingIntervalMs ?? 1200,
      botUsername: parsed.botUsername,
      mentionPatterns: parsed.mentionPatterns,
      requireMentionInGroups: parsed.requireMentionInGroups ?? true,
      ignoreBotMessages: parsed.ignoreBotMessages ?? true
    };
  } catch {
    return {
      enabled: Boolean(envToken),
      botToken: envToken,
      tokenSource: envToken ? "environment" : "none",
      allowedUserIds: envAllowedUserIds,
      allowedChatIds: envAllowedChatIds,
      pollingIntervalMs: 1200,
      requireMentionInGroups: true,
      ignoreBotMessages: true
    };
  }
}

async function writeTelegramSettings(settings: TelegramAdapterSettings): Promise<void> {
  const settingsPath = telegramSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function telegramSettingsPath(): string {
  return join(app.getPath("userData"), "telegram-settings.json");
}

async function readActivePackPath(): Promise<string | undefined> {
  try {
    const raw = await readFile(join(app.getPath("userData"), "active-pack.json"), "utf8");
    const parsed = JSON.parse(stripJsonBom(raw)) as { path?: unknown };
    const activePath = typeof parsed.path === "string" && parsed.path.trim().length > 0 ? parsed.path : undefined;
    return activePath && await isOCPackPath(activePath) ? activePath : undefined;
  } catch {
    return undefined;
  }
}

async function resolveActivePackPath(): Promise<string | undefined> {
  const activePath = await readActivePackPath();
  const discovered = await discoverUserPackPath();

  if (activePath && shouldKeepActivePackPath(activePath, discovered)) {
    return activePath;
  }

  if (discovered) {
    await writeActivePackPath(discovered, activePath ? "auto-corrected-installed-pack" : "auto-discovered");
    return discovered;
  }

  return activePath;
}

async function discoverUserPackPath(): Promise<string | undefined> {
  const candidates: string[] = [];
  try {
    const entries = await readdir(installedPacksRoot(), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = join(installedPacksRoot(), entry.name);
      if (await isOCPackPath(candidate)) {
        candidates.push(candidate);
      }
    }
  } catch {
    // No user OC Pack folder exists yet.
  }
  return candidates.sort(comparePackCandidates)[0];
}

async function isOCPackPath(packPath: string): Promise<boolean> {
  try {
    await stat(join(packPath, "manifest.json"));
    await stat(join(packPath, "profile.json"));
    await stat(join(packPath, "lore.json"));
    return true;
  } catch {
    return false;
  }
}

async function writeActivePackPath(packPath: string, reason: string): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    join(app.getPath("userData"), "active-pack.json"),
    `${JSON.stringify({ path: packPath, updatedAt: new Date().toISOString(), reason }, null, 2)}\n`,
    "utf8"
  );
}

function installedPacksRoot(): string {
  return join(app.getPath("userData"), "oc-packs");
}

function shouldKeepActivePackPath(activePath: string, discovered?: string): boolean {
  if (!discovered) {
    return true;
  }

  const activeResolved = resolve(activePath);
  const discoveredResolved = resolve(discovered);
  if (activeResolved === discoveredResolved) {
    return true;
  }

  if (!isInsideDirectory(installedPacksRoot(), activeResolved)) {
    return false;
  }

  return !(isLegacyPackPath(activeResolved) && !isLegacyPackPath(discoveredResolved));
}

function comparePackCandidates(left: string, right: string): number {
  const score = packCandidateScore(left) - packCandidateScore(right);
  return score === 0 ? basename(left).localeCompare(basename(right), "en") : score;
}

function packCandidateScore(packPath: string): number {
  const name = basename(packPath).toLowerCase();
  if (name === "active-local-core") {
    return -10;
  }
  if (isLegacyPackPath(packPath)) {
    return 20;
  }
  if (/example|blank|template/.test(name)) {
    return 30;
  }
  return 0;
}

function isLegacyPackPath(packPath: string): boolean {
  return /legacy|migrated|deprecated|archive|old/.test(basename(packPath).toLowerCase());
}

function isInsideDirectory(parent: string, child: string): boolean {
  const relation = relative(resolve(parent), resolve(child));
  return relation === "" || (relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation));
}

function readTelegramTokenFromEnv(): string | undefined {
  const value = process.env.MUSEEGG_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumberListEnv(...names: string[]): number[] {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) {
      return parseNumberList(value);
    }
  }
  return [];
}

function parseNumberList(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function imageMime(ext: string): string | undefined {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return undefined;
  }
}

function stripJsonBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}
