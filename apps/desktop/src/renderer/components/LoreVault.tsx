import { Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@muse-egg/ui";
import type { OCLoreEntry, OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface LoreVaultProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function LoreVault({ pack, onChange }: LoreVaultProps) {
  const { t } = useI18n();

  const updateEntry = (id: string, patch: Partial<OCLoreEntry>) => {
    onChange({
      ...pack,
      lore: {
        entries: pack.lore.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
      }
    });
  };

  const addEntry = () => {
    const entry: OCLoreEntry = {
      id: `lore_${Date.now()}`,
      title: "New lore entry",
      content: "",
      scope: "world",
      priority: 50,
      tags: []
    };
    onChange({ ...pack, lore: { entries: [entry, ...pack.lore.entries] } });
  };

  const removeEntry = (id: string) => {
    onChange({ ...pack, lore: { entries: pack.lore.entries.filter((entry) => entry.id !== id) } });
  };

  return (
    <div className="rule-editor">
      <div className="editor-toolbar">
        <strong>{t("lore.count", { count: pack.lore.entries.length })}</strong>
        <IconActionButton icon={<Plus size={16} />} label={t("lore.add")} onClick={addEntry} />
      </div>
      {pack.lore.entries.map((entry) => (
        <article className="rule-row" key={entry.id}>
          <div className="row-title">
            <input value={entry.title} onChange={(event) => updateEntry(entry.id, { title: event.target.value })} />
            <IconActionButton icon={<Trash2 size={15} />} label={t("lore.remove")} onClick={() => removeEntry(entry.id)} />
          </div>
          <textarea value={entry.content} onChange={(event) => updateEntry(entry.id, { content: event.target.value })} />
          <div className="row-fields">
            <label>
              <span>{t("rules.scope")}</span>
              <input value={entry.scope} onChange={(event) => updateEntry(entry.id, { scope: event.target.value })} />
            </label>
            <label>
              <span>{t("rules.priority")}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={entry.priority}
                onChange={(event) => updateEntry(entry.id, { priority: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>{t("rules.tags")}</span>
              <input
                value={entry.tags.join(", ")}
                onChange={(event) =>
                  updateEntry(entry.id, {
                    tags: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  })
                }
              />
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
