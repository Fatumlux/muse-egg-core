import {
  BellRing,
  BookOpen,
  BrainCircuit,
  Egg,
  Globe2,
  HeartHandshake,
  HeartPulse,
  Image,
  Inbox,
  Shield,
  ShieldCheck,
  Sprout,
  Wrench,
  Zap
} from "lucide-react";
import { GlassPanel } from "@muse-egg/ui";
import type { OCPack } from "@muse-egg/oc-schema";
import type { StudioTab } from "../types";
import { AssetManager } from "./AssetManager";
import { AwakeningRuleEditor } from "./AwakeningRuleEditor";
import { CompanionSettingsEditor } from "./CompanionSettingsEditor";
import { GuardRuleEditor } from "./GuardRuleEditor";
import { GrowthProposalInbox } from "./GrowthProposalInbox";
import { HealthCenter } from "./HealthCenter";
import { LoreVault } from "./LoreVault";
import { ModelRoutingEditor } from "./ModelRoutingEditor";
import { PermissionCenter } from "./PermissionCenter";
import { ProfileEditor } from "./ProfileEditor";
import { ReactionRuleEditor } from "./ReactionRuleEditor";
import { RuntimeSettingsEditor } from "./RuntimeSettingsEditor";
import { SelfGrowthEditor } from "./SelfGrowthEditor";
import { SkillManager } from "./SkillManager";
import { useI18n } from "../i18n";

const tabs: Array<{ id: StudioTab; labelKey: string; icon: JSX.Element }> = [
  { id: "profile", labelKey: "nav.profile", icon: <Egg size={16} /> },
  { id: "lore", labelKey: "studio.loreVault", icon: <BookOpen size={16} /> },
  { id: "guards", labelKey: "nav.guards", icon: <Shield size={16} /> },
  { id: "reactions", labelKey: "nav.reactions", icon: <Zap size={16} /> },
  { id: "awakening", labelKey: "studio.awakeningRules", icon: <BellRing size={16} /> },
  { id: "assets", labelKey: "nav.assets", icon: <Image size={16} /> },
  { id: "growth", labelKey: "nav.growth", icon: <Sprout size={16} /> },
  { id: "proposals", labelKey: "nav.proposals", icon: <Inbox size={16} /> },
  { id: "permissions", labelKey: "nav.permissions", icon: <ShieldCheck size={16} /> },
  { id: "health", labelKey: "nav.health", icon: <HeartPulse size={16} /> },
  { id: "companion", labelKey: "nav.companion", icon: <HeartHandshake size={16} /> },
  { id: "runtime", labelKey: "nav.runtime", icon: <Globe2 size={16} /> },
  { id: "skills", labelKey: "nav.skills", icon: <Wrench size={16} /> },
  { id: "models", labelKey: "nav.models", icon: <BrainCircuit size={16} /> }
];

export interface OCStudioProps {
  pack: OCPack;
  activeTab: StudioTab;
  onTabChange(tab: StudioTab): void;
  onChange(pack: OCPack): void;
}

export function OCStudio({ pack, activeTab, onTabChange, onChange }: OCStudioProps) {
  const { t } = useI18n();

  return (
    <GlassPanel className="oc-studio" title={t("studio.title")}>
      <div className="studio-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      <div className="studio-pane">
        {activeTab === "profile" && <ProfileEditor pack={pack} onChange={onChange} />}
        {activeTab === "lore" && <LoreVault pack={pack} onChange={onChange} />}
        {activeTab === "guards" && <GuardRuleEditor pack={pack} onChange={onChange} />}
        {activeTab === "reactions" && <ReactionRuleEditor pack={pack} onChange={onChange} />}
        {activeTab === "awakening" && <AwakeningRuleEditor pack={pack} onChange={onChange} />}
        {activeTab === "assets" && <AssetManager pack={pack} onChange={onChange} />}
        {activeTab === "growth" && <SelfGrowthEditor pack={pack} onChange={onChange} />}
        {activeTab === "proposals" && <GrowthProposalInbox pack={pack} onChange={onChange} />}
        {activeTab === "permissions" && <PermissionCenter pack={pack} />}
        {activeTab === "health" && <HealthCenter pack={pack} onChange={onChange} />}
        {activeTab === "companion" && <CompanionSettingsEditor pack={pack} onChange={onChange} />}
        {activeTab === "runtime" && <RuntimeSettingsEditor pack={pack} onChange={onChange} />}
        {activeTab === "skills" && <SkillManager pack={pack} onChange={onChange} />}
        {activeTab === "models" && <ModelRoutingEditor pack={pack} onChange={onChange} />}
      </div>
    </GlassPanel>
  );
}
