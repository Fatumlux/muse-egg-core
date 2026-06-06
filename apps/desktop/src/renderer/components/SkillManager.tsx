import { Plus, Trash2 } from "lucide-react";
import { IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCPack, OCSkill } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface SkillManagerProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function SkillManager({ pack, onChange }: SkillManagerProps) {
  const { t } = useI18n();
  const skills = pack.skills ?? [];

  const updateSkill = (id: string, patch: Partial<OCSkill>) => {
    onChange({
      ...pack,
      skills: skills.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill))
    });
  };

  const addSkill = () => {
    const skill: OCSkill = {
      id: `skill-${Date.now()}`,
      name: t("skills.newName"),
      description: t("skills.newDescription"),
      version: "0.1.0",
      enabled: true,
      triggers: ["custom_event"],
      permissions: ["read_event"],
      platforms: ["any"],
      instructions: t("skills.newInstructions")
    };
    onChange({ ...pack, skills: [skill, ...skills] });
  };

  const removeSkill = (id: string) => {
    onChange({ ...pack, skills: skills.filter((skill) => skill.id !== id) });
  };

  return (
    <div className="rule-editor skill-manager">
      <div className="editor-toolbar">
        <div className="inline-heading">
          <strong>{t("skills.count", { count: skills.length })}</strong>
          <StatusPill tone="cyan">SKILL.md</StatusPill>
        </div>
        <IconActionButton icon={<Plus size={16} />} label={t("skills.add")} onClick={addSkill} />
      </div>

      {skills.map((skill) => (
        <article className="rule-row skill-row" key={skill.id}>
          <div className="row-title">
            <input value={skill.name} onChange={(event) => updateSkill(skill.id, { name: event.target.value })} />
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={skill.enabled}
                onChange={(event) => updateSkill(skill.id, { enabled: event.target.checked })}
              />
              <span>{t("rules.enabled")}</span>
            </label>
            <IconActionButton icon={<Trash2 size={15} />} label={t("skills.remove")} onClick={() => removeSkill(skill.id)} />
          </div>

          <label>
            <span>{t("skills.description")}</span>
            <input
              value={skill.description}
              onChange={(event) => updateSkill(skill.id, { description: event.target.value })}
            />
          </label>

          <div className="row-fields">
            <label>
              <span>{t("skills.id")}</span>
              <input value={skill.id} onChange={(event) => updateSkill(skill.id, { id: event.target.value })} />
            </label>
            <label>
              <span>{t("skills.triggers")}</span>
              <input
                value={skill.triggers.join(", ")}
                onChange={(event) => updateSkill(skill.id, { triggers: parseList(event.target.value) })}
              />
            </label>
            <label>
              <span>{t("skills.platform")}</span>
              <input
                value={skill.platforms.join(", ")}
                onChange={(event) =>
                  updateSkill(skill.id, { platforms: parseList(event.target.value) as OCSkill["platforms"] })
                }
              />
            </label>
          </div>

          <label>
            <span>{t("skills.permissions")}</span>
            <input
              value={skill.permissions.join(", ")}
              onChange={(event) => updateSkill(skill.id, { permissions: parseList(event.target.value) })}
            />
          </label>

          <label>
            <span>{t("skills.instructions")}</span>
            <textarea
              value={skill.instructions}
              onChange={(event) => updateSkill(skill.id, { instructions: event.target.value })}
            />
          </label>
        </article>
      ))}
    </div>
  );
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
