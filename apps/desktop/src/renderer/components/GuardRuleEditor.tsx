import { Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@muse-egg/ui";
import type { GuardSeverity, OCGuardRule, OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

const severities: GuardSeverity[] = ["low", "medium", "high", "critical"];

export interface GuardRuleEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function GuardRuleEditor({ pack, onChange }: GuardRuleEditorProps) {
  const { t } = useI18n();

  const updateRule = (id: string, patch: Partial<OCGuardRule>) => {
    onChange({
      ...pack,
      guardRules: pack.guardRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    });
  };

  const addRule = () => {
    const rule: OCGuardRule = {
      id: `guard_${Date.now()}`,
      title: "New guard rule",
      content: "",
      severity: "medium",
      scope: "identity",
      enabled: true
    };
    onChange({ ...pack, guardRules: [rule, ...pack.guardRules] });
  };

  const removeRule = (id: string) => {
    onChange({ ...pack, guardRules: pack.guardRules.filter((rule) => rule.id !== id) });
  };

  return (
    <div className="rule-editor">
      <div className="editor-toolbar">
        <strong>{t("guard.count", { count: pack.guardRules.length })}</strong>
        <IconActionButton icon={<Plus size={16} />} label={t("guard.add")} onClick={addRule} />
      </div>
      {pack.guardRules.map((rule) => (
        <article className="rule-row" key={rule.id}>
          <div className="row-title">
            <input value={rule.title} onChange={(event) => updateRule(rule.id, { title: event.target.value })} />
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
              />
              <span>{t("rules.enabled")}</span>
            </label>
            <IconActionButton
              icon={<Trash2 size={15} />}
              label={t("guard.remove")}
              onClick={() => removeRule(rule.id)}
            />
          </div>
          <textarea value={rule.content} onChange={(event) => updateRule(rule.id, { content: event.target.value })} />
          <div className="row-fields">
            <label>
              <span>{t("rules.severity")}</span>
              <select
                value={rule.severity}
                onChange={(event) => updateRule(rule.id, { severity: event.target.value as GuardSeverity })}
              >
                {severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {t(`guard.severity.${severity}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("rules.scope")}</span>
              <input value={rule.scope} onChange={(event) => updateRule(rule.id, { scope: event.target.value })} />
            </label>
            <label>
              <span>{t("rules.id")}</span>
              <input value={rule.id} onChange={(event) => updateRule(rule.id, { id: event.target.value })} />
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
