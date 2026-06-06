import { Clock3 } from "lucide-react";
import { GlassPanel, StatusPill } from "@muse-egg/ui";
import type { TimelineEntry } from "../types";
import { useI18n } from "../i18n";

export interface EventTimelineProps {
  entries: TimelineEntry[];
}

export function EventTimeline({ entries }: EventTimelineProps) {
  const { t } = useI18n();

  return (
    <GlassPanel className="event-timeline" title={t("timeline.title")}>
      {entries.length === 0 ? (
        <div className="empty-state">
          <Clock3 size={22} />
          <span>{t("timeline.empty")}</span>
        </div>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className="timeline-top">
                <StatusPill tone={entry.awakening.score >= 60 ? "rose" : "cyan"}>{entry.type}</StatusPill>
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              <p>{entry.payloadText}</p>
              {entry.responseText && <blockquote>{entry.responseText}</blockquote>}
              <div className="wake-meter">
                <span style={{ width: `${entry.awakening.score}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </GlassPanel>
  );
}
