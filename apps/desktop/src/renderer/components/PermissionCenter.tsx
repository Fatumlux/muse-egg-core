import { ShieldCheck } from "lucide-react";
import { StatusPill } from "@muse-egg/ui";
import type { OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface PermissionCenterProps {
  pack: OCPack;
}

export function PermissionCenter({ pack }: PermissionCenterProps) {
  const { t } = useI18n();
  const policy = pack.selfGrowth;
  const skills = pack.skills ?? [];

  return (
    <div className="permission-center">
      <section className="growth-card">
        <div className="growth-card-head">
          <ShieldCheck size={17} />
          <div>
            <strong>{t("permissions.core")}</strong>
            <span>{t("permissions.coreDetail")}</span>
          </div>
        </div>
        <div className="permission-grid">
          <PermissionLine label={t("permissions.privateData")} active={policy?.forbiddenActions.includes("private_data_export") ?? true} />
          <PermissionLine label={t("permissions.destructive")} active={policy?.forbiddenActions.includes("destructive_file_action") ?? true} />
          <PermissionLine label={t("permissions.installNeedsApproval")} active={policy?.requireExplicitPermissionFor.includes("install_or_enable_plugin") ?? true} />
          <PermissionLine label={t("permissions.commandNeedsApproval")} active={policy?.requireExplicitPermissionFor.includes("run_system_command") ?? true} />
        </div>
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <ShieldCheck size={17} />
          <div>
            <strong>{t("permissions.skillPermissions")}</strong>
            <span>{t("permissions.skillDetail")}</span>
          </div>
        </div>
        <div className="permission-skill-list">
          {skills.map((skill) => (
            <article key={skill.id}>
              <strong>{skill.name}</strong>
              <span>{skill.enabled ? t("state.enabled") : t("state.disabled")} / {skill.permissions.join(", ") || t("permissions.none")}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PermissionLine({ label, active }: { label: string; active: boolean }) {
  const { t } = useI18n();

  return (
    <div className="permission-line">
      <span>{label}</span>
      <StatusPill tone={active ? "green" : "amber"}>{active ? t("state.protected") : t("state.checkNeeded")}</StatusPill>
    </div>
  );
}
