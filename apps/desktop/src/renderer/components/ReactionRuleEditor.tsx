import { Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@muse-egg/ui";
import type { OCPlatform, OCReactionRule, OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

const platforms: Array<OCReactionRule["platform"]> = [
  "any",
  "desktop",
  "telegram",
  "file_watcher",
  "scheduler",
  "system",
  "custom"
];

export interface ReactionRuleEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function ReactionRuleEditor({ pack, onChange }: ReactionRuleEditorProps) {
  const { t } = useI18n();

  const updateRule = (id: string, patch: Partial<OCReactionRule>) => {
    onChange({
      ...pack,
      reactionRules: pack.reactionRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    });
  };

  const addRule = () => {
    const rule: OCReactionRule = {
      id: `react_${Date.now()}`,
      trigger: "hello",
      response: t("reaction.defaultResponse", { name: "{name}" }),
      expression: pack.profile.defaultExpression,
      platform: "any",
      enabled: true
    };
    onChange({ ...pack, reactionRules: [rule, ...pack.reactionRules] });
  };

  const removeRule = (id: string) => {
    onChange({ ...pack, reactionRules: pack.reactionRules.filter((rule) => rule.id !== id) });
  };

  return (
    <div className="rule-editor">
      <div className="editor-toolbar">
        <strong>{t("reaction.count", { count: pack.reactionRules.length })}</strong>
        <IconActionButton icon={<Plus size={16} />} label={t("reaction.add")} onClick={addRule} />
      </div>
      {pack.reactionRules.map((rule) => (
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
              label={t("reaction.remove")}
              onClick={() => removeRule(rule.id)}
            />
          </div>
          <textarea value={rule.response} onChange={(event) => updateRule(rule.id, { response: event.target.value })} />
          <div className="row-fields">
            <label>
              <span>{t("rules.expression")}</span>
              <input
                value={rule.expression}
                onChange={(event) => updateRule(rule.id, { expression: event.target.value })}
              />
            </label>
            <label>
              <span>{t("rules.platform")}</span>
              <select
                value={rule.platform}
                onChange={(event) =>
                  updateRule(rule.id, { platform: event.target.value as OCPlatform | "any" })
                }
              >
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
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
