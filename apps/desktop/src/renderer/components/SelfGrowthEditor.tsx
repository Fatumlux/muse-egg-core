import { ShieldCheck } from "lucide-react";
import { StatusPill } from "@muse-egg/ui";
import type { OCPack, OCSelfGrowthPolicy, OCSelfGrowthRisk } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

const risks: Array<{ id: OCSelfGrowthRisk; labelKey: string; detailKey: string }> = [
  {
    id: "private_data_export",
    labelKey: "risk.privateData",
    detailKey: "risk.privateDataDetail"
  },
  {
    id: "destructive_file_action",
    labelKey: "risk.destructive",
    detailKey: "risk.destructiveDetail"
  },
  {
    id: "external_network_send",
    labelKey: "risk.externalNetwork",
    detailKey: "risk.externalNetworkDetail"
  },
  {
    id: "install_or_enable_plugin",
    labelKey: "risk.installPlugin",
    detailKey: "risk.installPluginDetail"
  },
  {
    id: "modify_identity",
    labelKey: "risk.modifyIdentity",
    detailKey: "risk.modifyIdentityDetail"
  },
  {
    id: "write_outside_pack",
    labelKey: "risk.writeOutside",
    detailKey: "risk.writeOutsideDetail"
  },
  {
    id: "run_system_command",
    labelKey: "risk.runCommand",
    detailKey: "risk.runCommandDetail"
  }
];

export interface SelfGrowthEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function SelfGrowthEditor({ pack, onChange }: SelfGrowthEditorProps) {
  const { t } = useI18n();
  const policy = { ...createDefaultPolicy(), ...(pack.selfGrowth ?? {}) };

  const updatePolicy = (patch: Partial<OCSelfGrowthPolicy>) => {
    onChange({
      ...pack,
      selfGrowth: {
        ...policy,
        ...patch
      }
    });
  };

  const setForbidden = (risk: OCSelfGrowthRisk, enabled: boolean) => {
    const forbiddenActions = enabled
      ? unique([...policy.forbiddenActions, risk])
      : policy.forbiddenActions.filter((item) => item !== risk);
    const requireExplicitPermissionFor = enabled
      ? policy.requireExplicitPermissionFor
      : unique([...policy.requireExplicitPermissionFor, risk]);

    updatePolicy({
      forbiddenActions,
      requireExplicitPermissionFor,
      allowPrivateDataExport: risk === "private_data_export" ? !enabled : policy.allowPrivateDataExport,
      allowDestructiveFileActions:
        risk === "destructive_file_action" ? !enabled : policy.allowDestructiveFileActions
    });
  };

  const setRequiresPermission = (risk: OCSelfGrowthRisk, enabled: boolean) => {
    updatePolicy({
      requireExplicitPermissionFor: enabled
        ? unique([...policy.requireExplicitPermissionFor, risk])
        : policy.requireExplicitPermissionFor.filter((item) => item !== risk)
    });
  };

  return (
    <div className="self-growth-editor">
      <div className="editor-toolbar">
        <div className="inline-heading">
          <strong>{t("growth.title")}</strong>
          <StatusPill tone={policy.enabled ? "green" : "amber"}>{policy.enabled ? t("state.enabled") : t("state.disabled")}</StatusPill>
        </div>
        <label className="toggle-line">
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(event) => updatePolicy({ enabled: event.target.checked })}
          />
          <span>{t("growth.enable")}</span>
        </label>
      </div>

      <section className="growth-card">
        <div className="growth-card-head">
          <ShieldCheck size={17} />
          <div>
            <strong>{t("growth.allowedAuto")}</strong>
            <span>{t("growth.allowedAutoDetail")}</span>
          </div>
        </div>
        <div className="growth-toggle-grid">
          <ToggleLine
            label={t("growth.reflections")}
            checked={policy.autoRecordReflections}
            onChange={(checked) => updatePolicy({ autoRecordReflections: checked })}
          />
          <ToggleLine
            label={t("growth.memories")}
            checked={policy.autoSummarizeMemories}
            onChange={(checked) => updatePolicy({ autoSummarizeMemories: checked })}
          />
          <ToggleLine
            label={t("growth.proposeLore")}
            checked={policy.autoProposeLore}
            onChange={(checked) => updatePolicy({ autoProposeLore: checked })}
          />
          <ToggleLine
            label={t("growth.proposeSkills")}
            checked={policy.autoProposeSkills}
            onChange={(checked) => updatePolicy({ autoProposeSkills: checked })}
          />
          <ToggleLine
            label={t("growth.proposeRewrite")}
            checked={policy.autoProposeSelfRewrite}
            onChange={(checked) => updatePolicy({ autoProposeSelfRewrite: checked })}
          />
          <ToggleLine
            label={t("growth.allowRewrite")}
            checked={policy.allowSelfRewriteAfterApproval}
            onChange={(checked) => updatePolicy({ allowSelfRewriteAfterApproval: checked })}
          />
          <ToggleLine
            label={t("growth.autoModify")}
            checked={policy.autoModifyPack}
            danger
            onChange={(checked) => updatePolicy({ autoModifyPack: checked })}
          />
          <ToggleLine
            label={t("growth.autoInstall")}
            checked={policy.autoInstallSkills}
            danger
            onChange={(checked) => updatePolicy({ autoInstallSkills: checked })}
          />
        </div>
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <ShieldCheck size={17} />
          <div>
            <strong>{t("growth.boundary")}</strong>
            <span>{t("growth.boundaryDetail")}</span>
          </div>
        </div>

        <div className="risk-list">
          {risks.map((risk) => (
            <article className="risk-row" key={risk.id}>
              <div>
                <strong>{t(risk.labelKey)}</strong>
                <span>{t(risk.detailKey)}</span>
              </div>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={policy.forbiddenActions.includes(risk.id)}
                  onChange={(event) => setForbidden(risk.id, event.target.checked)}
                />
                <span>{t("growth.forbid")}</span>
              </label>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={policy.requireExplicitPermissionFor.includes(risk.id)}
                  onChange={(event) => setRequiresPermission(risk.id, event.target.checked)}
                />
                <span>{t("growth.require")}</span>
              </label>
            </article>
          ))}
        </div>
      </section>

      <label>
        <span>{t("growth.logPath")}</span>
        <input
          value={policy.proposalLogPath}
          onChange={(event) => updatePolicy({ proposalLogPath: event.target.value })}
        />
      </label>
    </div>
  );
}

function ToggleLine({
  label,
  checked,
  danger,
  onChange
}: {
  label: string;
  checked: boolean;
  danger?: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className={danger ? "toggle-line danger-toggle" : "toggle-line"}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function createDefaultPolicy(): OCSelfGrowthPolicy {
  return {
    enabled: true,
    autoRecordReflections: true,
    autoSummarizeMemories: true,
    autoProposeLore: true,
    autoProposeSkills: true,
    autoProposeSelfRewrite: true,
    allowSelfRewriteAfterApproval: true,
    autoModifyPack: false,
    autoInstallSkills: false,
    allowPrivateDataExport: false,
    allowDestructiveFileActions: false,
    requireExplicitPermissionFor: [
      "external_network_send",
      "install_or_enable_plugin",
      "modify_identity",
      "write_outside_pack",
      "run_system_command"
    ],
    forbiddenActions: ["private_data_export", "destructive_file_action"],
    proposalLogPath: ".museegg/growth/proposals.jsonl"
  };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
