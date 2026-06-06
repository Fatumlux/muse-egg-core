import { Activity, Bot, HeartPulse, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GlassPanel, StatusPill } from "@muse-egg/ui";
import type { AwakeningResult, OCPack } from "@muse-egg/oc-schema";
import { museEggApi } from "../api";
import { useI18n } from "../i18n";

export interface CharacterViewProps {
  pack: OCPack;
  awakening?: AwakeningResult;
}

export function CharacterView({ pack, awakening }: CharacterViewProps) {
  const { t } = useI18n();
  const [previews, setPreviews] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const wakeLabel = awakening
    ? `${awakening.score}/100 ${t(`awakening.level.${awakening.level}`)}`
    : t("character.sleeping");
  const life = pack.lifeState;
  const activeExpression = awakening?.expression ?? pack.profile.defaultExpression;
  const activeImage = useMemo(() => {
    const binding = [...(pack.assets.characterBindings ?? [])]
      .filter((item) => item.enabled && item.expression.trim() === activeExpression)
      .sort((a, b) => b.priority - a.priority)[0];
    const fileName = binding?.fileName ?? pack.assets.character.find((item) => item !== ".gitkeep");
    return previews.find((preview) => preview.name === fileName);
  }, [activeExpression, pack.assets.character, pack.assets.characterBindings, previews]);

  useEffect(() => {
    void museEggApi.getCharacterAssetPreviews().then(setPreviews).catch(() => setPreviews([]));
  }, [pack.assets.character]);

  return (
    <GlassPanel className="character-view" title={t("character.title")}>
      <div className="character-stage">
        <div className="starlight-frame">
          <div className={`egg-core ${activeImage ? "egg-core-image" : ""}`}>
            {activeImage ? (
              <img src={activeImage.dataUrl} alt={pack.profile.name} />
            ) : (
              <>
                <Sparkles size={34} />
                <strong>{pack.profile.name.slice(0, 2)}</strong>
              </>
            )}
          </div>
          <div className="expression-band">{activeExpression}</div>
        </div>
        <div className="character-meta">
          <h2>{pack.profile.name}</h2>
          <p>{pack.profile.role}</p>
          <div className="meta-pills">
            <StatusPill tone="cyan">{pack.profile.defaultForm}</StatusPill>
            <StatusPill tone="rose">{shortStyleLabel(pack.profile.speakingStyle, t)}</StatusPill>
          </div>
        </div>
      </div>

      {life && (
        <div className="life-state-strip">
          <div className="life-summary">
            <span>{t("character.lifeState")}</span>
            <strong>{life.mood}</strong>
          </div>
          <LifeMeter label={t("character.energy")} value={life.energy} />
          <LifeMeter label={t("character.trust")} value={life.trust} />
          <LifeMeter label={t("character.bond")} value={life.bond} />
          <LifeMeter label={t("character.wakefulness")} value={life.wakefulness} />
          <LifeMeter label={t("character.stress")} value={life.stress} tone="rose" />
        </div>
      )}

      <div className="core-stats">
        <div>
          <HeartPulse size={18} />
          <span>{t("character.awakeningScore")}</span>
          <strong>{wakeLabel}</strong>
        </div>
        <div>
          <Activity size={18} />
          <span>{t("character.memory")}</span>
          <strong>{pack.memories.entries.length}</strong>
        </div>
        <div>
          <Bot size={18} />
          <span>{t("character.channels")}</span>
          <strong>Desktop / Telegram / File</strong>
        </div>
        <div>
          <Sparkles size={18} />
          <span>{t("character.soulFiles")}</span>
          <strong>{Object.keys(pack.soulFiles ?? {}).length}</strong>
        </div>
        <div>
          <Activity size={18} />
          <span>{t("character.skills")}</span>
          <strong>{pack.skills?.length ?? 0}</strong>
        </div>
        <div>
          <Bot size={18} />
          <span>{t("character.primaryModel")}</span>
          <strong>{pack.modelRouting?.primaryModel ?? t("model.ruleBased")}</strong>
        </div>
      </div>
    </GlassPanel>
  );
}

function LifeMeter({ label, value, tone = "cyan" }: { label: string; value: number; tone?: "cyan" | "rose" }) {
  return (
    <div className={`life-meter life-meter-${tone}`}>
      <span>{label}</span>
      <div aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function shortStyleLabel(value: string, t: (key: string) => string): string {
  if (/繁體中文/u.test(value) && /短|準|可執行/u.test(value)) {
    return t("character.shortTraditional");
  }
  if (/裁定|壞笑|高傲/u.test(value)) {
    return t("character.judgementTone");
  }

  const first = value
    .split(/[，,；;。.\n]/u)
    .map((item) => item.trim())
    .find(Boolean);
  if (!first) {
    return t("character.roleVoice");
  }
  return first.length > 12 ? `${first.slice(0, 12)}...` : first;
}
