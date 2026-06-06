import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  BookOpen,
  BrainCircuit,
  Egg,
  Globe2,
  HeartHandshake,
  Image,
  Inbox,
  MessageCircle,
  Orbit,
  Shield,
  ShieldCheck,
  Sparkles,
  Sprout,
  Wrench,
  Zap
} from "lucide-react";
import { SectionTitle, StatusPill } from "@muse-egg/ui";
import type { OCEventInput } from "@muse-egg/core";
import type { OCGrowthProposal, OCPack } from "@muse-egg/oc-schema";
import { museEggApi } from "./api";
import { AwakeningPanel } from "./components/AwakeningPanel";
import { CharacterView } from "./components/CharacterView";
import { EventTimeline } from "./components/EventTimeline";
import { MessageConsole } from "./components/MessageConsole";
import { OCStudio } from "./components/OCStudio";
import { PackManager } from "./components/PackManager";
import { PlatformSettings } from "./components/PlatformSettings";
import { LanguageSwitcher, useI18n } from "./i18n";
import type { StudioTab, TimelineEntry } from "./types";
import { timelineEntryFromResult } from "./types";
import type { AppUpdateStatusView } from "../main/preload";

const tabItems: Array<{ id: StudioTab; labelKey: string; icon: JSX.Element }> = [
  { id: "profile", labelKey: "nav.profile", icon: <Egg size={16} /> },
  { id: "lore", labelKey: "nav.lore", icon: <BookOpen size={16} /> },
  { id: "guards", labelKey: "nav.guards", icon: <Shield size={16} /> },
  { id: "reactions", labelKey: "nav.reactions", icon: <Zap size={16} /> },
  { id: "awakening", labelKey: "nav.awakening", icon: <BellRing size={16} /> },
  { id: "assets", labelKey: "nav.assets", icon: <Image size={16} /> },
  { id: "growth", labelKey: "nav.growth", icon: <Sprout size={16} /> },
  { id: "proposals", labelKey: "nav.proposals", icon: <Inbox size={16} /> },
  { id: "permissions", labelKey: "nav.permissions", icon: <ShieldCheck size={16} /> },
  { id: "companion", labelKey: "nav.companion", icon: <HeartHandshake size={16} /> },
  { id: "runtime", labelKey: "nav.runtime", icon: <Globe2 size={16} /> },
  { id: "skills", labelKey: "nav.skills", icon: <Wrench size={16} /> },
  { id: "models", labelKey: "nav.models", icon: <BrainCircuit size={16} /> }
];

type AutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type StatusMessage = { key: string; values?: Record<string, string | number | undefined> } | { text: string };

export default function App() {
  const { t } = useI18n();
  const [pack, setPack] = useState<OCPack | undefined>();
  const [activeTab, setActiveTab] = useState<StudioTab>("profile");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<StatusMessage>({ key: "app.loading" });
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatusView | undefined>();
  const autoSaveRun = useRef(0);
  const dirtyRef = useRef(false);
  const statusText = "text" in status ? status.text : t(status.key, status.values);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    void museEggApi
      .loadActivePack()
      .then((loaded) => {
        setPack(loaded);
        setStatus({ key: "app.loaded", values: { name: loaded.manifest.name } });
        setAutoSaveState("saved");
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? { text: error.message } : { key: "app.load.failed" }));
  }, []);

  useEffect(() => {
    void museEggApi
      .checkUpdates()
      .then((next) => setUpdateStatus(next))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pack || !dirty) {
      return;
    }

    setAutoSaveState("dirty");
    const runId = autoSaveRun.current + 1;
    autoSaveRun.current = runId;

    const timer = window.setTimeout(() => {
      setAutoSaveState("saving");
      void museEggApi
        .savePack(pack)
        .then((saved) => {
          if (autoSaveRun.current !== runId) {
            return;
          }
          setPack(saved);
          setDirty(false);
          setAutoSaveState("saved");
          setStatus({ key: "app.autoSavedStatus" });
        })
        .catch((error: unknown) => {
          if (autoSaveRun.current !== runId) {
            return;
          }
          setAutoSaveState("error");
          setStatus(error instanceof Error ? { text: error.message } : { key: "app.saveFailed" });
        });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [dirty, pack]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyRef.current) {
        return;
      }

      void museEggApi
        .loadActivePack()
        .then((loaded) => {
          setPack(loaded);
          setStatus({ key: "app.syncedLatest", values: { name: loaded.manifest.name } });
          setAutoSaveState("saved");
        })
        .catch(() => undefined);
    }, 10 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const updatePack = useCallback((next: OCPack) => {
    setPack(next);
    setDirty(true);
  }, []);

  const replacePack = useCallback((next: OCPack | undefined, message: StatusMessage) => {
    if (!next) {
      return;
    }
    setPack(next);
    setDirty(false);
    setTimeline([]);
    setStatus(message);
    setAutoSaveState("saved");
  }, []);

  const syncSession = useCallback(async () => {
    if (!pack) {
      return;
    }
    const synced = await museEggApi.updateSession(pack);
    setPack(synced);
  }, [pack]);

  const dispatchEvent = useCallback(
    async (input: OCEventInput) => {
      if (!pack) {
        return;
      }

      await museEggApi.updateSession(pack);
      const result = await museEggApi.dispatchEvent(input);
      const entry = timelineEntryFromResult(result);
      setTimeline((items) => [entry, ...items].slice(0, 80));

      if (result.memory || result.growthProposals || result.lifeState) {
        setPack((current) =>
          current
            ? {
                ...current,
                memories: result.memory
                  ? {
                      entries: [result.memory, ...current.memories.entries].slice(0, 500)
                    }
                  : current.memories,
                growthProposals: result.growthProposals
                  ? {
                      entries: mergeGrowthProposals(
                        result.growthProposals,
                        current.growthProposals?.entries ?? []
                      )
                    }
                  : current.growthProposals,
                lifeState: result.lifeState ?? current.lifeState
              }
            : current
        );
        setDirty(true);
      }
      setStatus({ key: "app.processed", values: { type: result.event.type } });
    },
    [pack]
  );

  const latestAwakening = useMemo(() => timeline[0]?.awakening, [timeline]);
  const themeClass = useMemo(() => (pack ? deriveThemeClass(pack) : "theme-starlit"), [pack]);

  if (!pack) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-core">
          <Orbit size={42} />
          <span>{statusText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${themeClass}`}>
      <aside className="left-rail">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Egg size={24} />
          </div>
          <div>
            <strong>MuseEgg Core</strong>
            <span>{t("brand.subtitle")}</span>
          </div>
        </div>

        <PackManager
          pack={pack}
          dirty={dirty}
          status={statusText}
          onLoadActive={async () => replacePack(await museEggApi.loadActivePack(), { key: "app.loadedLocal" })}
          onLoadExample={async () => replacePack(await museEggApi.loadExamplePack(), { key: "app.loadedExample" })}
          onLoadBlank={async () => replacePack(await museEggApi.loadBlankPack(), { key: "app.loadedBlank" })}
          onImport={async () => replacePack(await museEggApi.importPack(), { key: "app.imported" })}
          onSave={async () => {
            const saved = await museEggApi.savePack(pack);
            replacePack(saved, { key: "app.saved" });
          }}
          onExport={async () => replacePack(await museEggApi.exportPack(pack), { key: "app.exported" })}
        />

        <nav className="studio-nav" aria-label={t("studio.title")}>
          {tabItems.map((item) => (
            <button
              key={item.id}
              className={activeTab === item.id ? "active" : ""}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="rail-footer">
          <LanguageSwitcher />
          {updateStatus?.enabled ? (
            <StatusPill tone={updateTone(updateStatus)}>{updateText(updateStatus, t)}</StatusPill>
          ) : null}
          <StatusPill tone={autoSaveTone(autoSaveState)}>{autoSaveText(autoSaveState, t)}</StatusPill>
          <StatusPill tone="violet">{pack.modelRouting?.primaryModel ?? t("model.ruleBased")}</StatusPill>
        </div>
      </aside>

      <main className="workspace">
        <div className="workspace-head">
          <SectionTitle eyebrow={t("studio.eyebrow")} title={pack.manifest.name} />
          <div className="head-badges">
            <StatusPill tone="cyan">{pack.profile.name}</StatusPill>
            <StatusPill tone="rose">{pack.profile.defaultExpression}</StatusPill>
            <StatusPill tone="green">{pack.autonomy.enabled ? t("workspace.awakeningOn") : t("workspace.awakeningOff")}</StatusPill>
          </div>
        </div>

        <div className="dashboard-grid">
          <CharacterView pack={pack} awakening={latestAwakening} />
          <OCStudio pack={pack} activeTab={activeTab} onTabChange={setActiveTab} onChange={updatePack} />
          <AwakeningPanel pack={pack} latest={latestAwakening} />
          <MessageConsole onDispatch={dispatchEvent} />
          <PlatformSettings pack={pack} onSyncSession={syncSession} />
          <EventTimeline entries={timeline} />
        </div>

        <div className="sparkline-strip" aria-hidden="true">
          <Sparkles size={16} />
          <span />
          <MessageCircle size={16} />
        </div>
      </main>
    </div>
  );
}

function updateText(status: AppUpdateStatusView, t: (key: string, values?: Record<string, string | number | undefined>) => string): string {
  if (status.updateAvailable) {
    return t("updates.available", { version: status.latestVersion });
  }
  if (status.error) {
    return t("updates.failed");
  }
  return t("updates.latest");
}

function updateTone(status: AppUpdateStatusView): "cyan" | "violet" | "rose" | "amber" | "green" {
  if (status.updateAvailable) {
    return "amber";
  }
  if (status.error) {
    return "rose";
  }
  return "green";
}

function autoSaveText(state: AutoSaveState, t: (key: string) => string): string {
  switch (state) {
    case "dirty":
      return t("autosave.dirty");
    case "saving":
      return t("autosave.saving");
    case "saved":
      return t("autosave.saved");
    case "error":
      return t("autosave.error");
    default:
      return t("autosave.idle");
  }
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

function autoSaveTone(state: AutoSaveState): "cyan" | "violet" | "rose" | "amber" | "green" {
  switch (state) {
    case "dirty":
      return "amber";
    case "saving":
      return "cyan";
    case "saved":
      return "green";
    case "error":
      return "rose";
    default:
      return "violet";
  }
}

function deriveThemeClass(pack: OCPack): string {
  const text = [
    pack.profile.personality,
    pack.profile.speakingStyle,
    pack.profile.defaultExpression,
    pack.profile.defaultForm,
    pack.soulFiles?.["SOUL.md"] ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("警覺") || text.includes("火") || text.includes("激烈") || text.includes("alert")) {
    return "theme-alert";
  }
  if (text.includes("安靜") || text.includes("冷") || text.includes("月") || text.includes("calm")) {
    return "theme-calm";
  }
  return "theme-starlit";
}
