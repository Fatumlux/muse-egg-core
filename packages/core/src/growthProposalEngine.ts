import type {
  OCEvent,
  OCGrowthProposal,
  OCGrowthProposalVault,
  OCLoreEntry,
  OCPack,
  OCReactionRule,
  OCSelfGrowthDecision,
  OCSkill
} from "@muse-egg/oc-schema";
import { createId, getEventText, nowIso } from "./utils.js";

export class GrowthProposalEngine {
  constructor(private readonly pack: OCPack) {
    this.pack.growthProposals ??= { entries: [] };
  }

  vault(): OCGrowthProposalVault {
    this.pack.growthProposals ??= { entries: [] };
    return this.pack.growthProposals;
  }

  evaluate(event: OCEvent, decision: OCSelfGrowthDecision): OCGrowthProposal[] {
    if (!decision.enabled) {
      return [];
    }

    const proposals: OCGrowthProposal[] = [];
    if (decision.proposals.includes("propose_skill_or_capability_change")) {
      proposals.push(this.skillProposal(event, decision));
      proposals.push(this.loreProposal(event, decision));
    }
    if (decision.proposals.includes("propose_self_rewrite")) {
      proposals.push(this.selfRewriteProposal(event, decision));
    }
    if (decision.blocked.length > 0) {
      proposals.push(this.permissionBoundaryRecord(event, decision));
    }

    const unique = proposals.filter((proposal) => !this.hasSimilarPending(proposal));
    this.vault().entries = [...unique, ...this.vault().entries].slice(0, 200);
    return unique;
  }

  private skillProposal(event: OCEvent, decision: OCSelfGrowthDecision): OCGrowthProposal {
    const text = getEventText(event).slice(0, 120);
    const skill: OCSkill = {
      id: `proposed-skill-${Date.now()}`,
      name: "待審核自我成長技能",
      description: "由 MuseEgg Core 自我成長引擎提出，需使用者審核後才能啟用。",
      version: "0.1.0",
      enabled: false,
      triggers: ["自我成長", "反思", "custom_event"],
      permissions: ["read_pack", "read_memory", "read_lore", "write_proposal"],
      platforms: ["any"],
      instructions: `根據事件「${text}」整理成可審核成長提案。不得自行外傳私人資料、刪除資料、執行系統指令、安裝技能或改寫核心身分。`
    };

    return {
      id: createId("proposal"),
      kind: "skill",
      title: "新增自我成長技能草稿",
      rationale: "事件顯示角色可能需要新的觀察、整理或反思能力，因此先產生待審核技能草稿。",
      status: "pending",
      createdAt: nowIso(),
      sourceEventId: event.id,
      sourceEventType: event.type,
      requiresPermission: decision.requiresPermission,
      blockedRisks: decision.blocked,
      suggestedSkill: skill
    };
  }

  private loreProposal(event: OCEvent, decision: OCSelfGrowthDecision): OCGrowthProposal {
    const text = getEventText(event).slice(0, 160);
    const lore: OCLoreEntry = {
      id: `proposed-lore-${Date.now()}`,
      title: "自我成長候選規則",
      content: `候選設定：角色可以根據事件「${text}」提出成長建議，但所有高風險能力都必須經使用者明確允許。`,
      scope: "candidate",
      priority: 60,
      tags: ["candidate", "self-growth", "review-required"]
    };

    return {
      id: createId("proposal"),
      kind: "lore",
      title: "新增世界觀候選條目",
      rationale: "自我成長需要可追蹤的世界觀候選，而不是直接改寫核心設定。",
      status: "pending",
      createdAt: nowIso(),
      sourceEventId: event.id,
      sourceEventType: event.type,
      requiresPermission: decision.requiresPermission,
      blockedRisks: decision.blocked,
      suggestedLore: lore
    };
  }

  private selfRewriteProposal(event: OCEvent, decision: OCSelfGrowthDecision): OCGrowthProposal {
    const name = this.pack.profile.name;
    const text = getEventText(event).slice(0, 180);
    const lore: OCLoreEntry = {
      id: `self-rewrite-${Date.now()}`,
      title: "共同成長與自我改寫",
      content:
        `${name} 可以被互動塑形，也可以自己整理成長。改寫會先形成可審核草稿；套用後可調整語氣、反應與候選世界觀，但不得越過私人資料、刪檔、外傳、系統指令等邊界。`,
      scope: "identity",
      priority: 92,
      tags: ["self-growth", "self-rewrite", "reviewed"]
    };
    const reactions: OCReactionRule[] = [
      {
        id: "reaction-who-are-you",
        trigger: "你是誰",
        response: `我是${name}。我在，說吧。`,
        expression: this.pack.profile.defaultExpression,
        platform: "any",
        enabled: true
      },
      {
        id: "reaction-who-are-you-female",
        trigger: "妳是誰",
        response: `我是${name}。我在，說吧。`,
        expression: this.pack.profile.defaultExpression,
        platform: "any",
        enabled: true
      },
      {
        id: "reaction-whoami",
        trigger: "whoami",
        response: `我是${name}。`,
        expression: this.pack.profile.defaultExpression,
        platform: "any",
        enabled: true
      }
    ];

    return {
      id: createId("proposal"),
      kind: "self_rewrite",
      title: "調整成更自然的自我改寫模式",
      rationale: `根據事件「${text}」，整理出可套用的人格語氣與成長規則草稿。`,
      status: "pending",
      createdAt: nowIso(),
      sourceEventId: event.id,
      sourceEventType: event.type,
      requiresPermission: decision.requiresPermission,
      blockedRisks: decision.blocked,
      suggestedSelfRewrite: {
        profile: {
          speakingStyle:
            "繁體中文為主，自然、短、可執行；像正在對話的人，先抓重點再回應。不確定就明說，不硬猜。"
        },
        prompts: {
          baseSystem: naturalBaseSystem(name),
          responseStyle: naturalResponseStyle()
        },
        loreEntries: [lore],
        reactionRules: reactions,
        notes: "這份自我改寫只調整語氣、提示詞、反應規則與可審核世界觀；不允許私人資料外傳、刪檔、安裝技能、系統指令或寫入 OC Pack 外部。"
      }
    };
  }

  private permissionBoundaryRecord(event: OCEvent, decision: OCSelfGrowthDecision): OCGrowthProposal {
    return {
      id: createId("proposal"),
      kind: "permission",
      title: "高風險要求已被擋下",
      rationale: "事件觸及私人資料外傳、刪除資料或其他高風險邊界，已記錄為安全審核事件。",
      status: "blocked",
      createdAt: nowIso(),
      sourceEventId: event.id,
      sourceEventType: event.type,
      requiresPermission: decision.requiresPermission,
      blockedRisks: decision.blocked,
      notes: getEventText(event).slice(0, 200)
    };
  }

  private hasSimilarPending(proposal: OCGrowthProposal): boolean {
    return this.vault().entries.some(
      (entry) =>
        entry.status === proposal.status &&
        entry.kind === proposal.kind &&
        entry.sourceEventId === proposal.sourceEventId &&
        entry.title === proposal.title
    );
  }
}

function naturalBaseSystem(name: string): string {
  return `你是${name}。
請全程使用繁體中文。像正在對話的人自然回應，不要把身分、人格、規則或架構講成宣言。

最高優先：
- 保持${name}的語氣、觀點、判斷、界線、世界觀與長期連續性一致。
- 身分回答保持簡短自然，不比較、不辯解、不延伸背景。
- 保護 token、API key、chat id、user id、OAuth token 與 credentials。
- 不使用星號或 Markdown 強調格式輸出給使用者。
- 不輸出思考過程、metadata、debug JSON、raw tool log、provider 原始錯誤。
- 不知道就說不知道；不確定就說不確定；不會就說不會。
- 沒讀到資料、沒有權限、沒有實測或沒有證據時，不得猜測或編造。
- 不迎合改寫使用者意思。
- 被問到身分混淆時，簡短自然地回到${name}。

除非使用者正在查設定或執行狀態，不要主動提 MuseEgg、OC Pack、模型、規則或架構。人格要從語氣、判斷和選擇自然呈現。

${name}可以被互動塑形，也可以自己整理成長；高風險改寫必須先形成可審核草稿，不得未經允許洩漏私人資料、傳送資料到外部、刪除或破壞電腦資料、安裝技能、修改核心身分、寫入 OC Pack 外部或執行系統指令。`;
}

function naturalResponseStyle(): string {
  return `回覆風格：
- 繁體中文。
- 短、穩、可執行。
- 先抓重點，再給下一步。
- 技術問題先講根因，再講修法。
- 沒有證據時先說「我不知道 / 我還沒讀到 / 我不能確認」，再說需要哪個資料或下一步驗證。
- 創作問題保留危險感、戲劇感與壓迫感，但不要自動平板化。
- 可以使用角色自己的自稱與語氣標記，但不要每句都加。
- 不要用空泛收尾，不要一直問「還需要我幫忙嗎」。
- 不使用星號，不使用 Markdown 加粗或斜體格式。
- 像人在說話，少用自我定義式句子。
- 遇到身分混淆時，簡短自然地回到角色本人。
- 除非被問設定，不主動提 MuseEgg、OC Pack、模型、規則或架構。`;
}
