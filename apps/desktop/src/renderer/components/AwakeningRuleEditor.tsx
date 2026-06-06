import { Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@muse-egg/ui";
import type { OCAwakeningRule, OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface AwakeningRuleEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function AwakeningRuleEditor({ pack, onChange }: AwakeningRuleEditorProps) {
  const { t } = useI18n();

  const updateRule = (id: string, patch: Partial<OCAwakeningRule>) => {
    onChange({
      ...pack,
      awakeningRules: pack.awakeningRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    });
  };

  const addRule = () => {
    const rule: OCAwakeningRule = {
      id: `wake_${Date.now()}`,
      trigger: "custom_event",
      score: 30,
      dialogue: t("awakeningRules.defaultDialogue"),
      expression: pack.profile.defaultExpression,
      enabled: true
    };
    onChange({ ...pack, awakeningRules: [rule, ...pack.awakeningRules] });
  };

  const removeRule = (id: string) => {
    onChange({ ...pack, awakeningRules: pack.awakeningRules.filter((rule) => rule.id !== id) });
  };

  return (
    <div className="rule-editor">
      <div className="editor-toolbar">
        <strong>{t("awakeningRules.count", { count: pack.awakeningRules.length })}</strong>
        <IconActionButton icon={<Plus size={16} />} label={t("awakeningRules.add")} onClick={addRule} />
      </div>
      {pack.awakeningRules.map((rule) => (
        <article className="rule-row" key={rule.id}>
          <div className="row-title">
            <input value={rule.trigger} onChange={(event) => updateRule(rule.id, { trigger: event.target.value })} />
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
              label={t("awakeningRules.remove")}
              onClick={() => removeRule(rule.id)}
            />
          </div>
          <textarea value={rule.dialogue} onChange={(event) => updateRule(rule.id, { dialogue: event.target.value })} />
          <div className="row-fields">
            <label>
              <span>{t("rules.score")}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={rule.score}
                onChange={(event) => updateRule(rule.id, { score: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>{t("rules.expression")}</span>
              <input
                value={rule.expression}
                onChange={(event) => updateRule(rule.id, { expression: event.target.value })}
              />
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
