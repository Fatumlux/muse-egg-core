import { HeartHandshake } from "lucide-react";
import { StatusPill } from "@muse-egg/ui";
import type { OCCompanionSettings, OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface CompanionSettingsEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function CompanionSettingsEditor({ pack, onChange }: CompanionSettingsEditorProps) {
  const { t } = useI18n();
  const settings = pack.companion ?? defaultCompanion();
  const update = (patch: Partial<OCCompanionSettings>) => onChange({ ...pack, companion: { ...settings, ...patch } });

  return (
    <div className="companion-editor">
      <div className="editor-toolbar">
        <div className="inline-heading">
          <strong>{t("companion.title")}</strong>
          <StatusPill tone={settings.enabled ? "green" : "amber"}>{settings.enabled ? t("state.enabled") : t("state.disabled")}</StatusPill>
        </div>
      </div>

      <section className="growth-card">
        <div className="growth-card-head">
          <HeartHandshake size={17} />
          <div>
            <strong>{t("companion.relationship")}</strong>
            <span>{t("companion.detail")}</span>
          </div>
        </div>
        <div className="growth-toggle-grid">
          <Toggle label={t("companion.enable")} checked={settings.enabled} onChange={(checked) => update({ enabled: checked })} />
          <Toggle label={t("companion.desktopPet")} checked={settings.desktopPet} onChange={(checked) => update({ desktopPet: checked })} />
          <Toggle label={t("companion.websiteSync")} checked={settings.websiteSync} onChange={(checked) => update({ websiteSync: checked })} />
          <Toggle label={t("companion.launch")} checked={settings.launchOnStartup} onChange={(checked) => update({ launchOnStartup: checked })} />
          <Toggle label={t("companion.ambient")} checked={settings.allowAmbientWakeups} onChange={(checked) => update({ allowAmbientWakeups: checked })} />
          <Toggle label={t("companion.alwaysOnTop")} checked={settings.smallWindowAlwaysOnTop} onChange={(checked) => update({ smallWindowAlwaysOnTop: checked })} />
        </div>
        <div className="editor-grid">
          <label>
            <span>{t("companion.relationshipMode")}</span>
            <select value={settings.relationshipMode} onChange={(event) => update({ relationshipMode: event.target.value as OCCompanionSettings["relationshipMode"] })}>
              <option value="friend">{t("companion.friend")}</option>
              <option value="lover">{t("companion.lover")}</option>
              <option value="family">{t("companion.family")}</option>
              <option value="guardian">{t("companion.guardian")}</option>
              <option value="custom">{t("companion.custom")}</option>
            </select>
          </label>
          <label>
            <span>{t("companion.notification")}</span>
            <select value={settings.notificationLevel} onChange={(event) => update({ notificationLevel: event.target.value as OCCompanionSettings["notificationLevel"] })}>
              <option value="quiet">{t("companion.quiet")}</option>
              <option value="balanced">{t("companion.balanced")}</option>
              <option value="expressive">{t("companion.expressive")}</option>
            </select>
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

function defaultCompanion(): OCCompanionSettings {
  return {
    enabled: true,
    desktopPet: true,
    websiteSync: true,
    launchOnStartup: true,
    relationshipMode: "friend",
    notificationLevel: "balanced",
    allowAmbientWakeups: true,
    smallWindowAlwaysOnTop: false
  };
}
