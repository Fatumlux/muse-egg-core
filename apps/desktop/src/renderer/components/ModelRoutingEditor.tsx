import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCModelRouting, OCPack } from "@muse-egg/oc-schema";
import type { HostProviderStatusView } from "../../main/preload";
import { museEggApi } from "../api";
import { useI18n } from "../i18n";

const defaultModels = [
  "openai-oauth-gpt-5.4-mini",
  "openai-oauth-gpt-5.4",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-2.5-flash",
  "openai-oauth-gpt-5.5"
];

export interface ModelRoutingEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function ModelRoutingEditor({ pack, onChange }: ModelRoutingEditorProps) {
  const { t } = useI18n();
  const routing = pack.modelRouting ?? createDefaultRouting();
  const [providerStatus, setProviderStatus] = useState<HostProviderStatusView | undefined>();
  const browserPreview = providerStatus?.providerId === "browser-preview";
  const oauthBadge = providerStatus ? openAIOAuthBadge(providerStatus, browserPreview, t) : undefined;

  useEffect(() => {
    void museEggApi.getProviderStatus().then(setProviderStatus);
  }, []);

  const updateRouting = (patch: Partial<OCModelRouting>) => {
    onChange({
      ...pack,
      modelRouting: {
        ...routing,
        ...patch
      }
    });
  };

  const updateFallback = (index: number, value: string) => {
    updateRouting({
      fallbackModels: routing.fallbackModels.map((model, itemIndex) => (itemIndex === index ? value : model))
    });
  };

  const addFallback = () => {
    updateRouting({ fallbackModels: [...routing.fallbackModels, ""] });
  };

  const removeFallback = (index: number) => {
    updateRouting({ fallbackModels: routing.fallbackModels.filter((_model, itemIndex) => itemIndex !== index) });
  };

  return (
    <div className="model-routing-editor">
      <div className="editor-toolbar">
        <div className="inline-heading">
          <strong>{t("models.title")}</strong>
          <StatusPill tone={routing.enabled ? "green" : "amber"}>{routing.enabled ? t("state.enabled") : t("state.disabled")}</StatusPill>
        </div>
        <label className="toggle-line">
          <input
            type="checkbox"
            checked={routing.enabled}
            onChange={(event) => updateRouting({ enabled: event.target.checked })}
          />
          <span>{t("models.enableRouting")}</span>
        </label>
      </div>

      {providerStatus ? (
        <div className="provider-status">
          <StatusPill tone={oauthBadge?.tone ?? "amber"}>{oauthBadge?.label ?? t("models.oauthChecking")}</StatusPill>
          <StatusPill tone={browserPreview ? "violet" : providerStatus.gemini.available ? "green" : "amber"}>
            {browserPreview ? t("models.geminiNeedApi") : providerStatus.gemini.available ? t("models.geminiConnected") : t("models.geminiUnset")}
          </StatusPill>
          <StatusPill tone="cyan">{`Ollama ${providerStatus.ollama.baseUrl}`}</StatusPill>
        </div>
      ) : null}

      <div className="editor-grid">
        <label>
          <span>{t("models.primary")}</span>
          <select value={routing.primaryModel} onChange={(event) => updateRouting({ primaryModel: event.target.value })}>
            {Array.from(new Set([routing.primaryModel, ...defaultModels])).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("models.retry")}</span>
          <input
            type="number"
            min={1}
            max={5}
            value={routing.retryPerModel}
            onChange={(event) => updateRouting({ retryPerModel: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>{t("models.timeout")}</span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={routing.timeoutMs}
            onChange={(event) => updateRouting({ timeoutMs: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="fallback-list">
        <div className="editor-toolbar">
          <strong>{t("models.fallbackOrder")}</strong>
          <IconActionButton icon={<Plus size={16} />} label={t("models.addFallback")} onClick={addFallback} />
        </div>
        {routing.fallbackModels.map((model, index) => (
          <div className="fallback-row" key={`${model}-${index}`}>
            <span>{index + 1}</span>
            <input value={model} onChange={(event) => updateFallback(index, event.target.value)} />
            <IconActionButton icon={<Trash2 size={15} />} label={t("models.removeFallback")} onClick={() => removeFallback(index)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function openAIOAuthBadge(
  providerStatus: HostProviderStatusView,
  browserPreview: boolean,
  t: (key: string) => string
): { tone: "green" | "amber" | "violet"; label: string } {
  if (browserPreview) {
    return { tone: "violet", label: t("models.oauthNeedApi") };
  }

  const oauth = providerStatus.openAIOAuth;
  if (!oauth.available) {
    return oauth.hasRefreshToken
      ? { tone: "amber", label: t("models.oauthExpiredRefresh") }
      : { tone: "amber", label: t("models.oauthMissing") };
  }

  if (oauth.refreshed) {
    return { tone: "green", label: t("models.oauthRefreshed") };
  }

  if (oauth.accessToken?.expired) {
    return oauth.hasRefreshToken
      ? { tone: "amber", label: t("models.oauthWaitingRefresh") }
      : { tone: "amber", label: t("models.oauthAccessExpired") };
  }

  if (oauth.idToken?.expired && oauth.hasRefreshToken) {
    return { tone: "green", label: t("models.oauthReadyAuto") };
  }

  return oauth.hasRefreshToken
    ? { tone: "green", label: t("models.oauthReadyAuto") }
    : { tone: "green", label: t("models.oauthReady") };
}

function createDefaultRouting(): OCModelRouting {
  return {
    enabled: true,
    primaryModel: "openai-oauth-gpt-5.4-mini",
    fallbackModels: [
      "openai-oauth-gpt-5.4",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
      "gemini-2.5-flash",
      "openai-oauth-gpt-5.5"
    ],
    retryPerModel: 1,
    timeoutMs: 30000
  };
}
