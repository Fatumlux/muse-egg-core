import type { OCGrowthProposal, OCGrowthProposalStatus, OCPack } from "@muse-egg/oc-schema";
import { nowIso } from "./utils.js";

export class ProposalReviewEngine {
  constructor(private readonly pack: OCPack) {
    this.pack.growthProposals ??= { entries: [] };
  }

  mark(id: string, status: OCGrowthProposalStatus): OCPack {
    return {
      ...this.pack,
      growthProposals: {
        entries: (this.pack.growthProposals?.entries ?? []).map((proposal) =>
          proposal.id === id ? { ...proposal, status, updatedAt: nowIso() } : proposal
        )
      }
    };
  }

  apply(id: string): OCPack {
    const proposal = this.pack.growthProposals?.entries.find((entry) => entry.id === id);
    if (!proposal || proposal.status === "blocked" || proposal.status === "rejected") {
      return this.pack;
    }
    return markApplied(applyProposal(this.pack, proposal), id);
  }
}

export function applyProposal(pack: OCPack, proposal: OCGrowthProposal): OCPack {
  let next = pack;
  if (proposal.suggestedSkill && !next.skills?.some((skill) => skill.id === proposal.suggestedSkill?.id)) {
    next = { ...next, skills: [proposal.suggestedSkill, ...(next.skills ?? [])] };
  }
  if (proposal.suggestedLore && !next.lore.entries.some((entry) => entry.id === proposal.suggestedLore?.id)) {
    next = { ...next, lore: { entries: [proposal.suggestedLore, ...next.lore.entries] } };
  }
  if (proposal.suggestedSelfRewrite) {
    next = applySelfRewrite(next, proposal);
  }
  return next;
}

function applySelfRewrite(pack: OCPack, proposal: OCGrowthProposal): OCPack {
  const rewrite = proposal.suggestedSelfRewrite;
  if (!rewrite) {
    return pack;
  }

  let next: OCPack = {
    ...pack,
    profile: rewrite.profile ? { ...pack.profile, ...rewrite.profile } : pack.profile,
    prompts: rewrite.prompts ? { ...pack.prompts, ...rewrite.prompts } : pack.prompts
  };

  if (rewrite.loreEntries?.length) {
    const existingLoreIds = new Set(next.lore.entries.map((entry) => entry.id));
    next = {
      ...next,
      lore: {
        entries: [...rewrite.loreEntries.filter((entry) => !existingLoreIds.has(entry.id)), ...next.lore.entries]
      }
    };
  }

  if (rewrite.reactionRules?.length) {
    const patchById = new Map(rewrite.reactionRules.map((rule) => [rule.id, rule]));
    const updated = next.reactionRules.map((rule) => patchById.get(rule.id) ?? rule);
    const existingReactionIds = new Set(updated.map((rule) => rule.id));
    next = {
      ...next,
      reactionRules: [...updated, ...rewrite.reactionRules.filter((rule) => !existingReactionIds.has(rule.id))]
    };
  }

  return next;
}

function markApplied(pack: OCPack, id: string): OCPack {
  return {
    ...pack,
    growthProposals: {
      entries: (pack.growthProposals?.entries ?? []).map((proposal) =>
        proposal.id === id ? { ...proposal, status: "applied", updatedAt: nowIso() } : proposal
      )
    }
  };
}
