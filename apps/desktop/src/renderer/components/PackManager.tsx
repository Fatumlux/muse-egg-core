import { Download, HardDrive, Save } from "lucide-react";
import { GlassPanel, IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface PackManagerProps {
  pack: OCPack;
  dirty: boolean;
  status: string;
  onLoadActive(): void | Promise<void>;
  onSave(): void | Promise<void>;
  onExport(): void | Promise<void>;
}

export function PackManager({
  pack,
  dirty,
  status,
  onLoadActive,
  onSave,
  onExport
}: PackManagerProps) {
  const { t } = useI18n();

  return (
    <GlassPanel as="div" className="pack-manager" title="OC Pack">
      <div className="pack-id">
        <strong>{pack.manifest.id}</strong>
        <span>{pack.manifest.version}</span>
      </div>
      <p>{pack.manifest.description}</p>
      <div className="pack-actions">
        <IconActionButton showLabel icon={<HardDrive size={17} />} label={t("pack.local")} onClick={() => void onLoadActive()} />
        <IconActionButton showLabel icon={<Save size={17} />} label={t("pack.save")} onClick={() => void onSave()} />
        <IconActionButton showLabel icon={<Download size={17} />} label={t("pack.export")} onClick={() => void onExport()} />
      </div>
      <div className="pack-status">
        <StatusPill tone={dirty ? "amber" : "green"}>{dirty ? t("state.unsaved") : t("state.saved")}</StatusPill>
        <span>{status}</span>
      </div>
    </GlassPanel>
  );
}
