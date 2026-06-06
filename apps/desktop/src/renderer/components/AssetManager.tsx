import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCPack } from "@muse-egg/oc-schema";
import { museEggApi } from "../api";
import { useI18n } from "../i18n";

export interface AssetManagerProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function AssetManager({ pack, onChange }: AssetManagerProps) {
  const { t } = useI18n();
  const [previews, setPreviews] = useState<Array<{ name: string; dataUrl: string }>>([]);

  const refreshPreviews = async () => {
    setPreviews(await museEggApi.getCharacterAssetPreviews());
  };

  useEffect(() => {
    void refreshPreviews().catch(() => setPreviews([]));
  }, [pack.assets.character]);

  const addCharacterAsset = async () => {
    const updated = await museEggApi.addCharacterAsset();
    onChange(updated);
    await refreshPreviews();
  };

  const removeCharacterAsset = async (fileName: string) => {
    const ok = window.confirm(t("assets.removeConfirm", { name: fileName }));
    if (!ok) {
      return;
    }
    const updated = await museEggApi.removeCharacterAsset(fileName);
    onChange(updated);
    await refreshPreviews();
  };

  return (
    <div className="asset-manager">
      <div className="asset-head">
        <div>
          <strong>{t("assets.title")}</strong>
          <span>{t("assets.description")}</span>
        </div>
        <IconActionButton showLabel icon={<ImagePlus size={17} />} label={t("assets.importSquare")} onClick={() => void addCharacterAsset()} />
      </div>

      <section className="asset-preview-grid">
        {previews.length === 0 ? (
          <div className="asset-empty-preview">
            <ImagePlus size={22} />
            <span>{t("assets.emptySquare")}</span>
          </div>
        ) : (
          previews.map((preview) => (
            <figure key={preview.name}>
              <button
                className="asset-remove-button"
                type="button"
                aria-label={t("assets.remove", { name: preview.name })}
                title={t("assets.remove", { name: preview.name })}
                onClick={() => void removeCharacterAsset(preview.name)}
              >
                <Trash2 size={13} />
              </button>
              <img src={preview.dataUrl} alt={preview.name} />
              <figcaption>{preview.name}</figcaption>
            </figure>
          ))
        )}
      </section>

      <AssetList
        title={t("assets.characterImages")}
        tone="cyan"
        items={pack.assets.character.filter((item) => item !== ".gitkeep")}
        onRemove={removeCharacterAsset}
      />
      <section className="asset-list">
        <div>
          <StatusPill tone="cyan">{t("assets.bindings")}</StatusPill>
          <button type="button" onClick={() => addBinding()}>{t("assets.addBinding")}</button>
        </div>
        {(pack.assets.characterBindings ?? []).length === 0 ? (
          <p className="empty-line">{t("assets.noFiles")}</p>
        ) : (
          <ul>
            {(pack.assets.characterBindings ?? []).map((binding) => (
              <li key={binding.id}>
                <input
                  aria-label={t("assets.bindingExpression")}
                  value={binding.expression}
                  onChange={(event) => updateBinding(binding.id, { expression: event.target.value })}
                />
                <select
                  aria-label={t("assets.bindingImage")}
                  value={binding.fileName}
                  onChange={(event) => updateBinding(binding.id, { fileName: event.target.value })}
                >
                  {pack.assets.character.filter((item) => item !== ".gitkeep").map((fileName) => (
                    <option key={fileName} value={fileName}>{fileName}</option>
                  ))}
                </select>
                <button type="button" aria-label={t("assets.removeBinding")} title={t("assets.removeBinding")} onClick={() => removeBinding(binding.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AssetList title="Live2D" tone="violet" items={pack.assets.live2d.filter((item) => item !== ".gitkeep")} />
      <AssetList title="Voice" tone="rose" items={pack.assets.voice.filter((item) => item !== ".gitkeep")} />
    </div>
  );

  function addBinding() {
    const firstImage = pack.assets.character.find((item) => item !== ".gitkeep") ?? "";
    onChange({
      ...pack,
      assets: {
        ...pack.assets,
        characterBindings: [
          ...(pack.assets.characterBindings ?? []),
          {
            id: `asset-binding-${Date.now()}`,
            expression: pack.profile.defaultExpression,
            fileName: firstImage,
            enabled: true,
            priority: 50
          }
        ]
      }
    });
  }

  function updateBinding(id: string, patch: Partial<NonNullable<OCPack["assets"]["characterBindings"]>[number]>) {
    onChange({
      ...pack,
      assets: {
        ...pack.assets,
        characterBindings: (pack.assets.characterBindings ?? []).map((binding) =>
          binding.id === id ? { ...binding, ...patch } : binding
        )
      }
    });
  }

  function removeBinding(id: string) {
    onChange({
      ...pack,
      assets: {
        ...pack.assets,
        characterBindings: (pack.assets.characterBindings ?? []).filter((binding) => binding.id !== id)
      }
    });
  }
}

function AssetList({
  title,
  tone,
  items,
  onRemove
}: {
  title: string;
  tone: "cyan" | "violet" | "rose";
  items: string[];
  onRemove?(fileName: string): Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <section className="asset-list">
      <div>
        <StatusPill tone={tone}>{title}</StatusPill>
        <span>{t("assets.fileCount", { count: items.length })}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-line">{t("assets.noFiles")}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              {onRemove ? (
                <button type="button" aria-label={t("assets.remove", { name: item })} title={t("assets.remove", { name: item })} onClick={() => void onRemove(item)}>
                  <Trash2 size={13} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
