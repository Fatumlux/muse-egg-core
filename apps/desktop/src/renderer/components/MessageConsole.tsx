import { CalendarClock, FileSearch, MessageSquareText, Send, Sparkles } from "lucide-react";
import { GlassPanel, IconActionButton } from "@muse-egg/ui";
import type { OCEventInput } from "@muse-egg/core";
import { useState } from "react";
import { useI18n } from "../i18n";

export interface MessageConsoleProps {
  onDispatch(input: OCEventInput): void | Promise<void>;
}

export function MessageConsole({ onDispatch }: MessageConsoleProps) {
  const { t } = useI18n();
  const [text, setText] = useState(() => t("console.defaultText"));

  const send = (input: OCEventInput) => {
    void onDispatch(input);
  };

  return (
    <GlassPanel className="message-console" title={t("console.title")}>
      <textarea value={text} onChange={(event) => setText(event.target.value)} />
      <div className="console-actions">
        <IconActionButton
          icon={<Send size={17} />}
          label={t("console.desktop")}
          onClick={() =>
            send({
              type: "user_message",
              platform: "desktop",
              source: "desktop_event_probe",
              payload: { text }
            })
          }
        />
        <IconActionButton
          icon={<MessageSquareText size={17} />}
          label={t("console.telegram")}
          onClick={() =>
            send({
              type: "telegram_message",
              platform: "telegram",
              source: "desktop_event_probe",
              payload: { text }
            })
          }
        />
        <IconActionButton
          icon={<Sparkles size={17} />}
          label={t("console.finalCandidate")}
          onClick={() =>
            send({
              type: "observed_final_candidate",
              platform: "desktop",
              source: "desktop_event_probe",
              payload: { title: "final candidate", text }
            })
          }
        />
        <IconActionButton
          icon={<FileSearch size={17} />}
          label={t("console.fileChange")}
          onClick={() =>
            send({
              type: "observed_file_change",
              platform: "file_watcher",
              source: "desktop_event_probe",
              payload: { path: "mock/final-design.md", text }
            })
          }
        />
        <IconActionButton
          icon={<CalendarClock size={17} />}
          label={t("console.weekly")}
          onClick={() =>
            send({
              type: "scheduled_weekly_report",
              platform: "scheduler",
              source: "desktop_event_probe",
              payload: { title: "weekly report", text }
            })
          }
        />
      </div>
    </GlassPanel>
  );
}
