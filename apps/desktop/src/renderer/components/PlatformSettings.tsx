import { Bot, Power, Save, Square } from "lucide-react";
import { GlassPanel, IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCPack } from "@muse-egg/oc-schema";
import { useEffect, useState } from "react";
import { museEggApi } from "../api";
import type { TelegramRuntimeStatusView } from "../../main/preload";
import { useI18n } from "../i18n";

export interface PlatformSettingsProps {
  pack: OCPack;
  onSyncSession(): Promise<void>;
}

export function PlatformSettings({ pack, onSyncSession }: PlatformSettingsProps) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [tokenSet, setTokenSet] = useState(false);
  const [tokenSource, setTokenSource] = useState<"user-data" | "environment" | "none">("none");
  const [botToken, setBotToken] = useState("");
  const [allowedUserIds, setAllowedUserIds] = useState("");
  const [allowedChatIds, setAllowedChatIds] = useState("");
  const [botUsername, setBotUsername] = useState(defaultBotUsername(pack));
  const [mentionPatterns, setMentionPatterns] = useState<string[]>(defaultMentionPatterns(pack));
  const [requireMentionInGroups, setRequireMentionInGroups] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(() => t("platform.idle"));

  useEffect(() => {
    void museEggApi.getTelegramSettings().then((settings) => {
      setEnabled(settings.enabled);
      setTokenSet(settings.tokenSet);
      setTokenSource(settings.tokenSource);
      setAllowedUserIds(settings.allowedUserIds.join(", "));
      setAllowedChatIds(settings.allowedChatIds.join(", "));
      setBotUsername(settings.botUsername ?? defaultBotUsername(pack));
      setMentionPatterns((settings.mentionPatterns?.length ?? 0) > 0 ? settings.mentionPatterns! : defaultMentionPatterns(pack));
      setRequireMentionInGroups(settings.requireMentionInGroups ?? true);
    });
    void museEggApi.getTelegramStatus().then((result) => {
      setRunning(result.running);
      setStatus(telegramRuntimeText(result, t));
    });
  }, [pack, t]);

  const saveSettings = async () => {
    const saved = await museEggApi.saveTelegramSettings({
      enabled,
      botToken: botToken.trim().length > 0 ? botToken.trim() : undefined,
      allowedUserIds: parseIds(allowedUserIds),
      allowedChatIds: parseIds(allowedChatIds)
    });
    setTokenSet(saved.tokenSet);
    setTokenSource(saved.tokenSource);
    setBotUsername(saved.botUsername ?? defaultBotUsername(pack));
    setMentionPatterns((saved.mentionPatterns?.length ?? 0) > 0 ? saved.mentionPatterns! : defaultMentionPatterns(pack));
    setRequireMentionInGroups(saved.requireMentionInGroups ?? true);
    setBotToken("");
    setStatus(t("platform.settingsSaved"));
  };

  const start = async () => {
    await onSyncSession();
    await saveSettings();
    const result = await museEggApi.startTelegram();
    setRunning(result.running);
    setStatus(result.running ? t("platform.pollingStarted") : t("platform.missingToken"));
  };

  const stop = async () => {
    const result = await museEggApi.stopTelegram();
    setRunning(result.running);
    setStatus(t("platform.stopped"));
  };

  return (
    <GlassPanel className="platform-settings" title={t("platform.title")}>
      <div className="platform-head">
        <div>
          <Bot size={18} />
          <strong>{t("platform.telegramPolling")}</strong>
        </div>
        <StatusPill tone={running ? "green" : tokenSet ? "cyan" : "amber"}>
          {running ? t("state.running") : telegramTokenText(tokenSet, tokenSource, t)}
        </StatusPill>
      </div>

      <label className="toggle-line platform-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>{t("platform.enableFor", { name: pack.profile.name })}</span>
      </label>

      <label>
        <span>{t("platform.token")}</span>
        <input
          type="password"
          value={botToken}
          placeholder={tokenSet ? t("platform.tokenSet") : t("platform.pasteToken")}
          onChange={(event) => setBotToken(event.target.value)}
        />
      </label>
      <label>
        <span>{t("platform.allowedUsers")}</span>
        <input value={allowedUserIds} onChange={(event) => setAllowedUserIds(event.target.value)} />
      </label>
      <label>
        <span>{t("platform.allowedChats")}</span>
        <input value={allowedChatIds} onChange={(event) => setAllowedChatIds(event.target.value)} />
      </label>

      <div className="platform-gate">
        <StatusPill tone={requireMentionInGroups ? "violet" : "amber"}>
          {requireMentionInGroups ? t("platform.groupMentionRequired") : t("platform.groupDirectWake")}
        </StatusPill>
        <span>{telegramGateText(botUsername, mentionPatterns, pack, t)}</span>
      </div>

      <div className="platform-actions">
        <IconActionButton icon={<Save size={16} />} label={t("platform.saveTelegram")} onClick={() => void saveSettings()} />
        <IconActionButton icon={<Power size={16} />} label={t("platform.startTelegram")} onClick={() => void start()} />
        <IconActionButton icon={<Square size={16} />} label={t("platform.stopTelegram")} onClick={() => void stop()} />
      </div>
      <p className="platform-status">{status}</p>
    </GlassPanel>
  );
}

function telegramGateText(botUsername: string, mentionPatterns: string[], pack: OCPack, t: Translate): string {
  const patterns = mentionPatterns.length > 0 ? mentionPatterns : botUsername ? [`@${botUsername}`] : defaultMentionPatterns(pack);
  return patterns.length > 0 ? t("platform.trigger", { patterns: patterns.join(", ") }) : t("platform.waitGate");
}

function telegramRuntimeText(status: TelegramRuntimeStatusView, t: Translate): string {
  if (!status.running) {
    return t("platform.notRunning");
  }
  if (status.lastError) {
    return t("platform.runningError", { error: status.lastError });
  }
  if (status.lastIgnoredReason) {
    return t("platform.runningIgnored", {
      updates: status.polledUpdates ?? 0,
      typing: status.typingActions ?? 0,
      sent: status.sentMessages ?? 0,
      reason: ignoredReasonText(status.lastIgnoredReason, t)
    });
  }
  return t("platform.runningSummary", {
    updates: status.polledUpdates ?? 0,
    typing: status.typingActions ?? 0,
    sent: status.sentMessages ?? 0
  });
}

function ignoredReasonText(reason: string, t: Translate): string {
  switch (reason) {
    case "chat_not_allowed":
      return t("platform.ignore.chat");
    case "user_not_allowed":
      return t("platform.ignore.user");
    case "group_without_mention":
      return t("platform.ignore.group");
    case "from_bot":
      return t("platform.ignore.bot");
    case "no_text_message":
      return t("platform.ignore.noText");
    case "core_returned_no_telegram_text":
      return t("platform.ignore.noCoreText");
    default:
      return reason;
  }
}

function defaultBotUsername(pack: OCPack): string {
  const botAlias = pack.profile.aliases.find((alias) => /^[A-Za-z0-9_]+_bot$/u.test(alias));
  if (botAlias) {
    return botAlias;
  }
  const mentionAlias = pack.profile.aliases.find((alias) => /^@[A-Za-z0-9_]+$/u.test(alias));
  return mentionAlias ? mentionAlias.slice(1) : "";
}

function defaultMentionPatterns(pack: OCPack): string[] {
  return Array.from(
    new Set(
      pack.profile.aliases
        .filter((alias) => /^@?[A-Za-z0-9_]+_bot$/u.test(alias))
        .flatMap((alias) => {
          const normalized = alias.replace(/^@/u, "");
          return [`@${normalized}`, normalized];
        })
    )
  );
}

function parseIds(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function telegramTokenText(tokenSet: boolean, source: "user-data" | "environment" | "none", t: Translate): string {
  if (!tokenSet) {
    return t("platform.noToken");
  }
  return source === "environment" ? t("platform.envToken") : t("platform.localToken");
}

type Translate = (key: string, values?: Record<string, string | number | undefined>) => string;
