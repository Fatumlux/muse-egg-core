import { contextBridge, ipcRenderer } from "electron";
import type { OCProcessResult, OCPack } from "@muse-egg/oc-schema";
import type { OCEventInput } from "@muse-egg/core";

export interface TelegramSettingsView {
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

export interface TelegramSettingsUpdate {
  enabled: boolean;
  botToken?: string;
  allowedUserIds: number[];
  allowedChatIds: number[];
}

export interface TelegramRuntimeStatusView {
  running: boolean;
  offset?: number;
  botUsername?: string;
  webhookCleared?: boolean;
  lastPollStartedAt?: string;
  lastPollAt?: string;
  lastUpdateAt?: string;
  lastHandledAt?: string;
  lastSentAt?: string;
  lastTypingAt?: string;
  lastError?: string;
  lastIgnoredReason?: string;
  polledUpdates?: number;
  pollAttempts?: number;
  handledMessages?: number;
  sentMessages?: number;
  typingActions?: number;
  ignoredMessages?: number;
}

export interface HostProviderStatusView {
  providerId: string;
  openAIOAuth: {
    available: boolean;
    source?: string;
    hasRefreshToken?: boolean;
    canRefresh?: boolean;
    accessToken?: TokenExpiryStatusView;
    idToken?: TokenExpiryStatusView;
    lastRefresh?: string;
    refreshed?: boolean;
    refreshError?: string;
  };
  openAICompatible: {
    available: boolean;
    baseUrlSet: boolean;
    apiKeySet: boolean;
  };
  gemini: {
    available: boolean;
    source?: string;
  };
  ollama: {
    baseUrl: string;
  };
  routes: string[];
}

export interface TokenExpiryStatusView {
  present: boolean;
  expiresAt?: string;
  secondsLeft?: number;
  expired?: boolean;
}

export interface AppUpdateStatusView {
  enabled: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  url?: string;
  notes?: string;
  checkedAt: string;
  error?: string;
}

export interface MuseEggDesktopApi {
  loadActivePack(): Promise<OCPack>;
  loadExamplePack(): Promise<OCPack>;
  loadBlankPack(): Promise<OCPack>;
  importPack(): Promise<OCPack | undefined>;
  updateSession(pack: OCPack): Promise<OCPack>;
  savePack(pack: OCPack): Promise<OCPack>;
  exportPack(pack: OCPack): Promise<OCPack | undefined>;
  addCharacterAsset(): Promise<OCPack>;
  removeCharacterAsset(fileName: string): Promise<OCPack>;
  getCharacterAssetPreviews(): Promise<Array<{ name: string; dataUrl: string }>>;
  dispatchEvent(input: OCEventInput): Promise<OCProcessResult>;
  getProviderStatus(): Promise<HostProviderStatusView>;
  checkUpdates(): Promise<AppUpdateStatusView>;
  getTelegramSettings(): Promise<TelegramSettingsView>;
  saveTelegramSettings(update: TelegramSettingsUpdate): Promise<TelegramSettingsView>;
  startTelegram(): Promise<{ running: boolean; reason?: string }>;
  getTelegramStatus(): Promise<TelegramRuntimeStatusView>;
  stopTelegram(): Promise<{ running: boolean }>;
}

const api: MuseEggDesktopApi = {
  loadActivePack: () => ipcRenderer.invoke("pack:load-active") as Promise<OCPack>,
  loadExamplePack: () => ipcRenderer.invoke("pack:load-example") as Promise<OCPack>,
  loadBlankPack: () => ipcRenderer.invoke("pack:load-blank") as Promise<OCPack>,
  importPack: () => ipcRenderer.invoke("pack:import") as Promise<OCPack | undefined>,
  updateSession: (pack) => ipcRenderer.invoke("pack:update-session", pack) as Promise<OCPack>,
  savePack: (pack) => ipcRenderer.invoke("pack:save", pack) as Promise<OCPack>,
  exportPack: (pack) => ipcRenderer.invoke("pack:export", pack) as Promise<OCPack | undefined>,
  addCharacterAsset: () => ipcRenderer.invoke("pack:add-character-asset") as Promise<OCPack>,
  removeCharacterAsset: (fileName) => ipcRenderer.invoke("pack:remove-character-asset", fileName) as Promise<OCPack>,
  getCharacterAssetPreviews: () =>
    ipcRenderer.invoke("pack:get-character-asset-previews") as Promise<Array<{ name: string; dataUrl: string }>>,
  dispatchEvent: (input) => ipcRenderer.invoke("event:dispatch", input) as Promise<OCProcessResult>,
  getProviderStatus: () => ipcRenderer.invoke("provider:get-status") as Promise<HostProviderStatusView>,
  checkUpdates: () => ipcRenderer.invoke("app:check-updates") as Promise<AppUpdateStatusView>,
  getTelegramSettings: () => ipcRenderer.invoke("telegram:get-settings") as Promise<TelegramSettingsView>,
  saveTelegramSettings: (update) =>
    ipcRenderer.invoke("telegram:save-settings", update) as Promise<TelegramSettingsView>,
  startTelegram: () => ipcRenderer.invoke("telegram:start") as Promise<{ running: boolean; reason?: string }>,
  getTelegramStatus: () => ipcRenderer.invoke("telegram:status") as Promise<TelegramRuntimeStatusView>,
  stopTelegram: () => ipcRenderer.invoke("telegram:stop") as Promise<{ running: boolean }>
};

contextBridge.exposeInMainWorld("museEgg", api);
