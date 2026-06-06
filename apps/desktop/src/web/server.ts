import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { TelegramAdapter, type TelegramAdapterSettings } from "@muse-egg/adapters";
import {
  exportOCPack,
  loadOCPack,
  OCEngine,
  PlatformRouter,
  saveOCPack,
  type OCEventInput
} from "@muse-egg/core";
import type { OCPack } from "@muse-egg/oc-schema";
import { createHostAIProvider, getHostProviderStatus } from "../main/hostProvider.js";
import { checkForAppUpdates } from "../main/updateChecker.js";

interface TelegramSettings extends TelegramAdapterSettings {
  tokenSource: "user-data" | "environment" | "none";
}

let currentPack: OCPack | undefined;
let engine: OCEngine | undefined;
let router: PlatformRouter | undefined;
let telegramAdapter: TelegramAdapter | undefined;

const port = Number(process.env.MUSEEGG_WEB_API_PORT ?? 37821);

async function workspaceRoot(): Promise<string> {
  const cwd = process.cwd();
  if (await pathExists(join(cwd, "oc-packs"))) {
    return cwd;
  }
  return resolve(cwd, "../..");
}

function ensureEngine(pack: OCPack): void {
  currentPack = pack;
  engine = new OCEngine(pack, { aiProvider: createHostAIProvider() });
  router = new PlatformRouter(engine);
}

async function ensureDefaultPack(): Promise<void> {
  if (!currentPack) {
    ensureEngine(await loadOCPack((await resolveActivePackPath()) ?? resolve(await workspaceRoot(), "oc-packs", "example-muse")));
  }
}

function requireEngine(): { engine: OCEngine; router: PlatformRouter; pack: OCPack } {
  if (!engine || !router || !currentPack) {
    throw new Error("No OC Pack is loaded.");
  }
  return { engine, router, pack: currentPack };
}

const server = createServer((request, response) => {
  void route(request, response).catch((error: unknown) => {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown MuseEgg web API error."
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MuseEgg Web Host API listening on http://127.0.0.1:${port}`);
  if (process.env.MUSEEGG_WEB_DISABLE_TELEGRAM !== "1") {
    void startTelegramFromSettings().catch(() => undefined);
  }
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${port}`}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, name: "MuseEgg Web Host API" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/provider/status") {
    sendJson(response, 200, await getHostProviderStatus());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/app/update-check") {
    sendJson(response, 200, await checkForAppUpdates(await workspaceRoot()));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/pack/active") {
    const packPath = (await resolveActivePackPath()) ?? resolve(await workspaceRoot(), "oc-packs", "example-muse");
    const pack = await loadOCPack(packPath);
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? packPath, "load-active");
    sendJson(response, 200, pack);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/pack/example") {
    const packPath = resolve(await workspaceRoot(), "oc-packs", "example-muse");
    const pack = await loadOCPack(packPath);
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? packPath, "load-example");
    sendJson(response, 200, pack);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/pack/blank") {
    const packPath = resolve(await workspaceRoot(), "oc-packs", "blank-template");
    const pack = await loadOCPack(packPath);
    ensureEngine(pack);
    await writeActivePackPath(pack.path ?? packPath, "load-blank");
    sendJson(response, 200, pack);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pack/update-session") {
    const body = await readJsonBody<{ pack: OCPack }>(request);
    ensureEngine({ ...body.pack, path: body.pack.path });
    sendJson(response, 200, currentPack);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pack/save") {
    const body = await readJsonBody<{ pack: OCPack }>(request);
    const targetPath = currentPack?.path ?? body.pack.path;
    const savedPath = await saveOCPack({ ...body.pack, path: targetPath }, targetPath);
    const reloaded = await loadOCPack(savedPath);
    ensureEngine(reloaded);
    await writeActivePackPath(savedPath, "save");
    sendJson(response, 200, reloaded);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pack/export") {
    const body = await readJsonBody<{ pack: OCPack; parentDir?: string }>(request);
    const parentDir = body.parentDir ?? join(userDataPath(), "oc-packs");
    const exportedPath = await exportOCPack({ ...body.pack, path: currentPack?.path ?? body.pack.path }, parentDir);
    const reloaded = await loadOCPack(exportedPath);
    ensureEngine(reloaded);
    await writeActivePackPath(exportedPath, "export");
    sendJson(response, 200, reloaded);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/event/dispatch") {
    const body = await readJsonBody<{ pack?: OCPack; input: OCEventInput }>(request);
    if (body.pack) {
      ensureEngine({ ...body.pack, path: body.pack.path });
    }
    await ensureDefaultPack();
    const state = requireEngine();
    sendJson(response, 200, await state.engine.processEvent(body.input));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/assets/character-previews") {
    await ensureDefaultPack();
    sendJson(response, 200, await getCharacterAssetPreviews(requireEngine().pack));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/assets/add-character") {
    const body = await readJsonBody<{ files: Array<{ name: string; dataUrl: string }> }>(request);
    await ensureDefaultPack();
    const { pack } = requireEngine();
    if (!pack.path) {
      throw new Error("Cannot add assets without a pack path.");
    }
    const targetDir = join(pack.path, "assets", "character");
    await mkdir(targetDir, { recursive: true });
    for (const file of body.files) {
      await writeDataUrl(join(targetDir, basename(file.name)), file.dataUrl);
    }
    const reloaded = await loadOCPack(pack.path);
    ensureEngine(reloaded);
    sendJson(response, 200, reloaded);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/assets/remove-character") {
    const body = await readJsonBody<{ fileName: string }>(request);
    await ensureDefaultPack();
    const { pack } = requireEngine();
    if (!pack.path) {
      throw new Error("Cannot remove assets without a pack path.");
    }
    await unlink(join(pack.path, "assets", "character", basename(body.fileName))).catch(() => undefined);
    const reloaded = await loadOCPack(pack.path);
    ensureEngine(reloaded);
    sendJson(response, 200, reloaded);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/telegram/settings") {
    const settings = await readTelegramSettings();
    sendJson(response, 200, telegramSettingsView(settings));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/telegram/settings") {
    const update = await readJsonBody<{
      enabled: boolean;
      botToken?: string;
      allowedUserIds: number[];
      allowedChatIds: number[];
    }>(request);
    const current = await readTelegramSettings();
    const providedToken = update.botToken && update.botToken.trim().length > 0 ? update.botToken.trim() : undefined;
    const storedToken = providedToken ?? (current.tokenSource === "user-data" ? current.botToken : undefined);
    await writeTelegramSettings({
      enabled: update.enabled,
      botToken: storedToken,
      allowedUserIds: update.allowedUserIds,
      allowedChatIds: update.allowedChatIds,
      pollingIntervalMs: current.pollingIntervalMs,
      botUsername: current.botUsername,
      mentionPatterns: current.mentionPatterns,
      requireMentionInGroups: current.requireMentionInGroups,
      ignoreBotMessages: current.ignoreBotMessages
    });
    sendJson(response, 200, telegramSettingsView(await readTelegramSettings()));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/telegram/start") {
    sendJson(response, 200, await startTelegramFromSettings());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/telegram/status") {
    sendJson(response, 200, telegramAdapter?.status() ?? { running: false });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/telegram/stop") {
    await telegramAdapter?.stop();
    telegramAdapter = undefined;
    sendJson(response, 200, { running: false });
    return;
  }

  sendJson(response, 404, { error: `Unknown endpoint: ${request.method} ${url.pathname}` });
}

async function startTelegramFromSettings(): Promise<{ running: boolean; reason?: string }> {
  await ensureDefaultPack();
  const state = requireEngine();
  const settings = await readTelegramSettings();
  await telegramAdapter?.stop();
  telegramAdapter = undefined;

  if (!settings.enabled || !settings.botToken) {
    return { running: false, reason: "disabled_or_missing_token" };
  }

  telegramAdapter = new TelegramAdapter(settings, state.router);
  telegramAdapter.start();
  return { running: telegramAdapter.isRunning() };
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return (raw.trim().length > 0 ? JSON.parse(raw) : {}) as T;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  setCors(response);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value)}\n`);
}

function setCors(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "http://127.0.0.1:5173");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

async function getCharacterAssetPreviews(pack: OCPack): Promise<Array<{ name: string; dataUrl: string }>> {
  if (!pack.path) {
    return [];
  }

  const previews: Array<{ name: string; dataUrl: string }> = [];
  for (const fileName of pack.assets.character) {
    const mime = imageMime(extname(fileName).toLowerCase());
    if (!mime) {
      continue;
    }

    try {
      const bytes = await readFile(join(pack.path, "assets", "character", fileName));
      previews.push({ name: fileName, dataUrl: `data:${mime};base64,${bytes.toString("base64")}` });
    } catch {
      // Missing image files should not prevent the web UI from loading the pack.
    }
  }
  return previews;
}

async function writeDataUrl(targetPath: string, dataUrl: string): Promise<void> {
  const marker = ";base64,";
  const markerIndex = dataUrl.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Asset upload must use a base64 data URL.");
  }
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, Buffer.from(dataUrl.slice(markerIndex + marker.length), "base64"));
}

async function readTelegramSettings(): Promise<TelegramSettings> {
  const envToken = readTelegramTokenFromEnv();
  const envAllowedUserIds = readNumberListEnv("MUSEEGG_TELEGRAM_ALLOWED_USER_IDS", "TELEGRAM_ALLOWED_USER_IDS");
  const envAllowedChatIds = readNumberListEnv("MUSEEGG_TELEGRAM_ALLOWED_CHAT_IDS", "TELEGRAM_ALLOWED_CHAT_IDS");
  try {
    const raw = await readFile(telegramSettingsPath(), "utf8");
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
  await mkdir(dirname(telegramSettingsPath()), { recursive: true });
  await writeFile(telegramSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function telegramSettingsView(settings: TelegramSettings): {
  enabled: boolean;
  tokenSet: boolean;
  tokenSource: "user-data" | "environment" | "none";
  allowedUserIds: number[];
  allowedChatIds: number[];
  botUsername?: string;
  mentionPatterns?: string[];
  requireMentionInGroups?: boolean;
  ignoreBotMessages?: boolean;
} {
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
}

function telegramSettingsPath(): string {
  return join(userDataPath(), "telegram-settings.json");
}

async function readActivePackPath(): Promise<string | undefined> {
  try {
    const raw = await readFile(join(userDataPath(), "active-pack.json"), "utf8");
    const parsed = JSON.parse(stripJsonBom(raw)) as { path?: unknown };
    const activePath = typeof parsed.path === "string" && parsed.path.trim().length > 0 ? parsed.path : undefined;
    return activePath && await isOCPackPath(activePath) ? activePath : undefined;
  } catch {
    return undefined;
  }
}

async function resolveActivePackPath(): Promise<string | undefined> {
  const activePath = await readActivePackPath();
  if (activePath) {
    return activePath;
  }

  const discovered = await discoverUserPackPath();
  if (discovered) {
    await writeActivePackPath(discovered, "auto-discovered");
  }
  return discovered;
}

async function discoverUserPackPath(): Promise<string | undefined> {
  const userPacksRoot = join(userDataPath(), "oc-packs");
  const preferred = join(userPacksRoot, "active-local-core");
  if (await isOCPackPath(preferred)) {
    return preferred;
  }

  try {
    const entries = await readdir(userPacksRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = join(userPacksRoot, entry.name);
      if (await isOCPackPath(candidate)) {
        return candidate;
      }
    }
  } catch {
    // No user OC Pack folder exists yet.
  }
  return undefined;
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
  await mkdir(userDataPath(), { recursive: true });
  await writeFile(
    join(userDataPath(), "active-pack.json"),
    `${JSON.stringify({ path: packPath, updatedAt: new Date().toISOString(), reason }, null, 2)}\n`,
    "utf8"
  );
}

function userDataPath(): string {
  return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "MuseEgg Core");
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

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function stripJsonBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}
