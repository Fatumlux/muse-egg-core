import type { OCPack, OCProfile } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface ProfileEditorProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function ProfileEditor({ pack, onChange }: ProfileEditorProps) {
  const { t } = useI18n();

  const update = (field: keyof OCProfile, value: string | string[]) => {
    onChange({
      ...pack,
      profile: {
        ...pack.profile,
        [field]: value
      }
    });
  };

  return (
    <div className="editor-grid">
      <label>
        <span>{t("profile.name")}</span>
        <input value={pack.profile.name} onChange={(event) => update("name", event.target.value)} />
      </label>
      <label>
        <span>{t("profile.aliases")}</span>
        <input
          value={pack.profile.aliases.join(", ")}
          onChange={(event) =>
            update(
              "aliases",
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            )
          }
        />
      </label>
      <label>
        <span>{t("profile.role")}</span>
        <input value={pack.profile.role} onChange={(event) => update("role", event.target.value)} />
      </label>
      <label>
        <span>{t("profile.defaultExpression")}</span>
        <input
          value={pack.profile.defaultExpression}
          onChange={(event) => update("defaultExpression", event.target.value)}
        />
      </label>
      <label>
        <span>{t("profile.defaultForm")}</span>
        <input value={pack.profile.defaultForm} onChange={(event) => update("defaultForm", event.target.value)} />
      </label>
      <label className="wide">
        <span>{t("profile.personality")}</span>
        <textarea value={pack.profile.personality} onChange={(event) => update("personality", event.target.value)} />
      </label>
      <label className="wide">
        <span>{t("profile.speakingStyle")}</span>
        <textarea value={pack.profile.speakingStyle} onChange={(event) => update("speakingStyle", event.target.value)} />
      </label>
    </div>
  );
}
