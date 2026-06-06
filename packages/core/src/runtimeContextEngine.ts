import type { OCEvent, OCPack, OCRuntimeSettings } from "@muse-egg/oc-schema";

export class RuntimeContextEngine {
  constructor(private readonly pack: OCPack) {
    this.pack.runtime = normalizeRuntimeSettings(this.pack.runtime);
  }

  settings(): OCRuntimeSettings {
    this.pack.runtime = normalizeRuntimeSettings(this.pack.runtime);
    return this.pack.runtime;
  }

  timezone(): string {
    return this.settings().local.timezone || "Asia/Taipei";
  }

  locale(): string {
    return this.settings().local.locale || "zh-TW";
  }

  localTime(timestamp: string): string {
    return formatLocalTime(timestamp, this.timezone(), this.locale());
  }

  promptSection(event: OCEvent): string {
    const runtime = this.settings();
    const lines = [
      `本機執行環境：${runtime.local.enabled ? "啟用" : "停用"}`,
      `時區：${runtime.local.timezone}`,
      `事件時間：${this.localTime(event.timestamp)}`,
      `可暴露本機時間：${runtime.local.exposeLocalTime ? "是" : "否"}`,
      `可暴露 Pack 路徑：${runtime.local.exposePackPath ? "是" : "否"}`,
      `可讀 Pack 內檔案：${runtime.local.allowReadInsidePack ? "是" : "否"}`,
      `可讀 Pack 外檔案：${runtime.local.allowReadOutsidePack ? "是" : "否"}`,
      `可執行系統命令：${runtime.local.allowShellCommands ? "是" : "否"}`,
      `網路執行環境：${runtime.network.enabled ? "啟用" : "停用"}`,
      `可對外請求：${runtime.network.allowOutboundRequests ? "是" : "否"}`,
      `外部 host 需明確允許：${runtime.network.requirePermissionForExternalHosts ? "是" : "否"}`,
      `允許 host：${runtime.network.allowedHosts.join(", ") || "未設定"}`,
      `封鎖 host：${runtime.network.blockedHosts.join(", ") || "未設定"}`,
      `網頁搜尋：${runtime.network.webSearchEnabled ? "啟用" : "停用"}`,
      `上下文視窗：${runtime.context.enabled ? "啟用" : "停用"}`,
      `最近事件上限：${runtime.context.maxRecentEvents}`,
      `上下文 prompt 字數上限：${runtime.context.maxPromptChars}`,
      `固定資料夾索引：${runtime.folderIndex.enabled ? "啟用" : "停用"}`,
      `固定資料夾：${this.pack.path || "未設定，目前 OC Pack 尚未安裝到資料夾"}`,
      `回應品質檢查：${runtime.quality.enabled ? "啟用" : "停用"}`
    ];
    return lines.join("\n");
  }
}

export function normalizeRuntimeSettings(value?: Partial<OCRuntimeSettings>): OCRuntimeSettings {
  const defaults = defaultRuntimeSettings();
  return {
    local: {
      ...defaults.local,
      ...(value?.local ?? {})
    },
    network: {
      ...defaults.network,
      ...(value?.network ?? {})
    },
    context: {
      ...defaults.context,
      ...(value?.context ?? {})
    },
    folderIndex: {
      ...defaults.folderIndex,
      ...(value?.folderIndex ?? {}),
      roots: value?.folderIndex?.roots ?? defaults.folderIndex.roots,
      includeExtensions: value?.folderIndex?.includeExtensions ?? defaults.folderIndex.includeExtensions,
      excludePatterns: value?.folderIndex?.excludePatterns ?? defaults.folderIndex.excludePatterns
    },
    quality: {
      ...defaults.quality,
      ...(value?.quality ?? {})
    },
    updates: {
      ...defaults.updates,
      ...(value?.updates ?? {})
    }
  };
}

export function defaultRuntimeSettings(): OCRuntimeSettings {
  return {
    local: {
      enabled: true,
      timezone: "Asia/Taipei",
      locale: "zh-TW",
      exposeLocalTime: true,
      exposePackPath: false,
      allowReadInsidePack: true,
      allowReadOutsidePack: false,
      allowShellCommands: false
    },
    network: {
      enabled: true,
      allowOutboundRequests: true,
      requirePermissionForExternalHosts: true,
      allowedHosts: ["api.openai.com", "generativelanguage.googleapis.com", "127.0.0.1", "localhost"],
      blockedHosts: [],
      maxResponseBytes: 524288,
      userAgent: "MuseEgg-Core/0.1",
      webSearchEnabled: false
    },
    context: {
      enabled: true,
      maxRecentEvents: 12,
      maxPromptChars: 6000,
      includeRuntimeEnvironment: true,
      includeLifeState: true
    },
    folderIndex: {
      enabled: true,
      roots: [],
      maxFiles: 2000,
      includeExtensions: [".md", ".txt", ".json", ".png", ".jpg", ".jpeg", ".webp"],
      excludePatterns: ["node_modules", ".git", ".museegg/backups", ".museegg/memory"],
      refreshIntervalMinutes: 60
    },
    quality: {
      enabled: true,
      blockIdentityDrift: true,
      blockPrivateDataLeak: true,
      blockIncompleteResponse: true,
      recordReports: true
    },
    updates: {
      enabled: true,
      checkOnStartup: true,
      checkIntervalHours: 24
    }
  };
}

export function formatLocalTime(timestamp: string, timezone = "Asia/Taipei", locale = "zh-TW"): string {
  const date = new Date(timestamp);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .formatToParts(safeDate)
    .reduce<Record<string, string>>((items, part) => {
      items[part.type] = part.value;
      return items;
    }, {});
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}
