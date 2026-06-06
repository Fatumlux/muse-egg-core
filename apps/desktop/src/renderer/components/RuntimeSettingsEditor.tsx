import { BrainCircuit, HardDrive, Network } from "lucide-react";
import { StatusPill } from "@muse-egg/ui";
import type { OCPack, OCRuntimeSettings } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface RuntimeSettingsEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function RuntimeSettingsEditor({ pack, onChange }: RuntimeSettingsEditorProps) {
  const { t } = useI18n();
  const runtime = normalizeRuntime(pack.runtime);
  const update = (patch: Partial<OCRuntimeSettings>) => onChange({ ...pack, runtime: { ...runtime, ...patch } });
  const updateLocal = (patch: Partial<OCRuntimeSettings["local"]>) =>
    update({ local: { ...runtime.local, ...patch } });
  const updateNetwork = (patch: Partial<OCRuntimeSettings["network"]>) =>
    update({ network: { ...runtime.network, ...patch } });
  const updateContext = (patch: Partial<OCRuntimeSettings["context"]>) =>
    update({ context: { ...runtime.context, ...patch } });

  return (
    <div className="runtime-editor">
      <div className="editor-toolbar">
        <div className="inline-heading">
          <strong>{t("runtime.title")}</strong>
          <StatusPill tone={runtime.local.enabled ? "green" : "amber"}>{t("runtime.localBadge")}</StatusPill>
          <StatusPill tone={runtime.network.enabled ? "cyan" : "amber"}>{t("runtime.networkBadge")}</StatusPill>
        </div>
      </div>

      <section className="growth-card">
        <div className="growth-card-head">
          <HardDrive size={17} />
          <div>
            <strong>{t("runtime.localCore")}</strong>
            <span>{t("runtime.localDetail")}</span>
          </div>
        </div>
        <div className="growth-toggle-grid">
          <Toggle label={t("runtime.localEnable")} checked={runtime.local.enabled} onChange={(checked) => updateLocal({ enabled: checked })} />
          <Toggle label={t("runtime.localTime")} checked={runtime.local.exposeLocalTime} onChange={(checked) => updateLocal({ exposeLocalTime: checked })} />
          <Toggle label={t("runtime.packPath")} checked={runtime.local.exposePackPath} onChange={(checked) => updateLocal({ exposePackPath: checked })} />
          <Toggle label={t("runtime.readInside")} checked={runtime.local.allowReadInsidePack} onChange={(checked) => updateLocal({ allowReadInsidePack: checked })} />
          <Toggle label={t("runtime.readOutside")} checked={runtime.local.allowReadOutsidePack} onChange={(checked) => updateLocal({ allowReadOutsidePack: checked })} />
          <Toggle label={t("runtime.shell")} checked={runtime.local.allowShellCommands} onChange={(checked) => updateLocal({ allowShellCommands: checked })} />
        </div>
        <div className="editor-grid">
          <label>
            <span>{t("runtime.timezone")}</span>
            <input value={runtime.local.timezone} onChange={(event) => updateLocal({ timezone: event.target.value })} />
          </label>
          <label>
            <span>{t("runtime.locale")}</span>
            <input value={runtime.local.locale} onChange={(event) => updateLocal({ locale: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <Network size={17} />
          <div>
            <strong>{t("runtime.networkCore")}</strong>
            <span>{t("runtime.networkDetail")}</span>
          </div>
        </div>
        <div className="growth-toggle-grid">
          <Toggle label={t("runtime.networkEnable")} checked={runtime.network.enabled} onChange={(checked) => updateNetwork({ enabled: checked })} />
          <Toggle label={t("runtime.outbound")} checked={runtime.network.allowOutboundRequests} onChange={(checked) => updateNetwork({ allowOutboundRequests: checked })} />
          <Toggle label={t("runtime.hostApproval")} checked={runtime.network.requirePermissionForExternalHosts} onChange={(checked) => updateNetwork({ requirePermissionForExternalHosts: checked })} />
          <Toggle label={t("runtime.webSearch")} checked={runtime.network.webSearchEnabled} onChange={(checked) => updateNetwork({ webSearchEnabled: checked })} />
        </div>
        <div className="editor-grid">
          <label>
            <span>{t("runtime.allowedHosts")}</span>
            <input value={runtime.network.allowedHosts.join(", ")} onChange={(event) => updateNetwork({ allowedHosts: splitList(event.target.value) })} />
          </label>
          <label>
            <span>{t("runtime.blockedHosts")}</span>
            <input value={runtime.network.blockedHosts.join(", ")} onChange={(event) => updateNetwork({ blockedHosts: splitList(event.target.value) })} />
          </label>
          <label>
            <span>{t("runtime.maxBytes")}</span>
            <input
              type="number"
              value={runtime.network.maxResponseBytes}
              onChange={(event) => updateNetwork({ maxResponseBytes: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            <span>User Agent</span>
            <input value={runtime.network.userAgent} onChange={(event) => updateNetwork({ userAgent: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <BrainCircuit size={17} />
          <div>
            <strong>{t("runtime.contextCore")}</strong>
            <span>{t("runtime.contextDetail")}</span>
          </div>
        </div>
        <div className="growth-toggle-grid">
          <Toggle label={t("runtime.contextEnable")} checked={runtime.context.enabled} onChange={(checked) => updateContext({ enabled: checked })} />
          <Toggle
            label={t("runtime.contextEnvironment")}
            checked={runtime.context.includeRuntimeEnvironment}
            onChange={(checked) => updateContext({ includeRuntimeEnvironment: checked })}
          />
          <Toggle
            label={t("runtime.contextLife")}
            checked={runtime.context.includeLifeState}
            onChange={(checked) => updateContext({ includeLifeState: checked })}
          />
        </div>
        <div className="editor-grid">
          <label>
            <span>{t("runtime.contextRecent")}</span>
            <input
              type="number"
              min={2}
              value={runtime.context.maxRecentEvents}
              onChange={(event) => updateContext({ maxRecentEvents: Number(event.target.value) || 2 })}
            />
          </label>
          <label>
            <span>{t("runtime.contextChars")}</span>
            <input
              type="number"
              min={500}
              value={runtime.context.maxPromptChars}
              onChange={(event) => updateContext({ maxPromptChars: Number(event.target.value) || 500 })}
            />
          </label>
        </div>
      </section>

    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <label className="toggle-line">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultRuntime(): OCRuntimeSettings {
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

function normalizeRuntime(runtime: OCRuntimeSettings | undefined): OCRuntimeSettings {
  const defaults = defaultRuntime();
  return {
    local: { ...defaults.local, ...(runtime?.local ?? {}) },
    network: { ...defaults.network, ...(runtime?.network ?? {}) },
    context: { ...defaults.context, ...(runtime?.context ?? {}) },
    folderIndex: {
      ...defaults.folderIndex,
      ...(runtime?.folderIndex ?? {}),
      roots: runtime?.folderIndex?.roots ?? defaults.folderIndex.roots,
      includeExtensions: runtime?.folderIndex?.includeExtensions ?? defaults.folderIndex.includeExtensions,
      excludePatterns: runtime?.folderIndex?.excludePatterns ?? defaults.folderIndex.excludePatterns
    },
    quality: { ...defaults.quality, ...(runtime?.quality ?? {}) },
    updates: { ...defaults.updates, ...(runtime?.updates ?? {}) }
  };
}
