import { BellRing, Moon, Radio, Sparkles } from "lucide-react";
import { GlassPanel, StatusPill } from "@muse-egg/ui";
import type { AwakeningResult, OCPack } from "@muse-egg/oc-schema";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n";

export interface AwakeningPanelProps {
  pack: OCPack;
  latest?: AwakeningResult;
}

export function AwakeningPanel({ pack, latest }: AwakeningPanelProps) {
  const { t } = useI18n();
  const score = latest?.score ?? 0;

  return (
    <GlassPanel className="awakening-panel" title={t("awakening.title")}>
      <div className="awakening-score">
        <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}>
          <strong>{score}</strong>
          <span>/100</span>
        </div>
        <div>
          <StatusPill tone={score >= 80 ? "rose" : score >= 60 ? "amber" : score >= 30 ? "cyan" : "violet"}>
            {t(`awakening.level.${latest?.level ?? "sleep"}`)}
          </StatusPill>
          <p>{latest?.dialogue ?? t("awakening.waiting")}</p>
        </div>
      </div>

      <div className="threshold-grid">
        <span>
          <Moon size={15} /> 0-29
        </span>
        <span>
          <Sparkles size={15} /> 30-59
        </span>
        <span>
          <BellRing size={15} /> 60-79
        </span>
        <span>
          <Radio size={15} /> 80-100
        </span>
      </div>

      <div className="autonomy-line">
        <span>{t("awakening.quietHours")}</span>
        <strong>
          {pack.autonomy.quietHours.start} - {pack.autonomy.quietHours.end}
        </strong>
        <span>{t("awakening.dailyLimit")}</span>
        <strong>{pack.autonomy.maxWakeupsPerDay}</strong>
      </div>
    </GlassPanel>
  );
}
