import { Check, PackageCheck, X } from "lucide-react";
import { IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCGrowthProposal, OCPack } from "@muse-egg/oc-schema";
import { useI18n } from "../i18n";

export interface GrowthProposalInboxProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function GrowthProposalInbox({ pack, onChange }: GrowthProposalInboxProps) {
  const { t } = useI18n();
  const entries = pack.growthProposals?.entries ?? [];

  const updateProposal = (id: string, patch: Partial<OCGrowthProposal>) => {
    onChange({
      ...pack,
      growthProposals: {
        entries: entries.map((proposal) =>
          proposal.id === id ? { ...proposal, ...patch, updatedAt: new Date().toISOString() } : proposal
        )
      }
    });
  };

  const applyProposal = (proposal: OCGrowthProposal) => {
    let next: OCPack = pack;
    if (proposal.suggestedSkill && !pack.skills?.some((skill) => skill.id === proposal.suggestedSkill?.id)) {
      next = { ...next, skills: [proposal.suggestedSkill, ...(pack.skills ?? [])] };
    }
    if (proposal.suggestedLore && !pack.lore.entries.some((entry) => entry.id === proposal.suggestedLore?.id)) {
      next = { ...next, lore: { entries: [proposal.suggestedLore, ...pack.lore.entries] } };
    }
    if (proposal.suggestedSelfRewrite) {
      next = applySelfRewrite(next, proposal);
    }
    onChange({
      ...next,
      growthProposals: {
        entries: entries.map((entry) =>
          entry.id === proposal.id ? { ...entry, status: "applied", updatedAt: new Date().toISOString() } : entry
        )
      }
    });
  };

  return (
    <div className="proposal-inbox">
      <div className="editor-toolbar">
        <div className="inline-heading">
          <strong>{t("proposal.count", { count: entries.length })}</strong>
          <StatusPill tone="cyan">{t("proposal.pendingList")}</StatusPill>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">{t("proposal.empty")}</div>
      ) : (
        entries.map((proposal) => (
          <article className="proposal-row" key={proposal.id}>
            <div className="proposal-head">
              <div>
                <strong>{proposal.title}</strong>
                <span>{proposal.kind} / {proposal.status}</span>
              </div>
              <StatusPill tone={proposal.status === "blocked" ? "rose" : proposal.status === "pending" ? "amber" : "green"}>
                {proposal.status}
              </StatusPill>
            </div>
            <p>{proposal.rationale}</p>
            {proposal.requiresPermission.length > 0 && (
              <p className="proposal-risk">{t("proposal.needsPermission", { risks: proposal.requiresPermission.join(", ") })}</p>
            )}
            {proposal.blockedRisks.length > 0 && <p className="proposal-risk">{t("proposal.blocked", { risks: proposal.blockedRisks.join(", ") })}</p>}
            {proposal.suggestedSelfRewrite && (
              <div className="proposal-preview">
                {proposal.suggestedSelfRewrite.profile ? <span>Profile</span> : null}
                {proposal.suggestedSelfRewrite.prompts ? <span>Prompt</span> : null}
                {proposal.suggestedSelfRewrite.reactionRules?.length ? <span>Reaction</span> : null}
                {proposal.suggestedSelfRewrite.loreEntries?.length ? <span>Lore</span> : null}
              </div>
            )}
            <div className="proposal-actions">
              <IconActionButton showLabel icon={<Check size={15} />} label={t("proposal.approve")} onClick={() => updateProposal(proposal.id, { status: "approved" })} />
              <IconActionButton showLabel icon={<PackageCheck size={15} />} label={t("proposal.apply")} onClick={() => applyProposal(proposal)} />
              <IconActionButton showLabel icon={<X size={15} />} label={t("proposal.reject")} onClick={() => updateProposal(proposal.id, { status: "rejected" })} />
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function applySelfRewrite(pack: OCPack, proposal: OCGrowthProposal): OCPack {
  const rewrite = proposal.suggestedSelfRewrite;
  if (!rewrite) {
    return pack;
  }

  let next = {
    ...pack,
    profile: rewrite.profile ? { ...pack.profile, ...rewrite.profile } : pack.profile,
    prompts: rewrite.prompts ? { ...pack.prompts, ...rewrite.prompts } : pack.prompts
  };

  if (rewrite.loreEntries?.length) {
    const existingLoreIds = new Set(next.lore.entries.map((entry) => entry.id));
    next = {
      ...next,
      lore: {
        entries: [
          ...rewrite.loreEntries.filter((entry) => !existingLoreIds.has(entry.id)),
          ...next.lore.entries
        ]
      }
    };
  }

  if (rewrite.reactionRules?.length) {
    const patchById = new Map(rewrite.reactionRules.map((rule) => [rule.id, rule]));
    const updated = next.reactionRules.map((rule) => patchById.get(rule.id) ?? rule);
    const existingReactionIds = new Set(updated.map((rule) => rule.id));
    next = {
      ...next,
      reactionRules: [
        ...updated,
        ...rewrite.reactionRules.filter((rule) => !existingReactionIds.has(rule.id))
      ]
    };
  }

  return next;
}
