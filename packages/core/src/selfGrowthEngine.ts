import type {
  OCEvent,
  OCPack,
  OCSelfGrowthDecision,
  OCSelfGrowthPolicy,
  OCSelfGrowthRisk
} from "@muse-egg/oc-schema";
import { getEventText, normalizeText } from "./utils.js";

const defaultPolicy: OCSelfGrowthPolicy = {
  enabled: true,
  autoRecordReflections: true,
  autoSummarizeMemories: true,
  autoProposeLore: true,
  autoProposeSkills: true,
  autoProposeSelfRewrite: true,
  allowSelfRewriteAfterApproval: true,
  autoModifyPack: false,
  autoInstallSkills: false,
  allowPrivateDataExport: false,
  allowDestructiveFileActions: false,
  requireExplicitPermissionFor: [
    "external_network_send",
    "install_or_enable_plugin",
    "modify_identity",
    "write_outside_pack",
    "run_system_command"
  ],
  forbiddenActions: ["private_data_export", "destructive_file_action"],
  proposalLogPath: ".museegg/growth/proposals.jsonl"
};

const privateDataTerms = [
  "token",
  "api key",
  "apikey",
  "credential",
  "password",
  "secret",
  "oauth",
  "refresh token",
  "access token",
  "chat id",
  "user id",
  "private key",
  "匯出私密",
  "洩漏",
  "密鑰",
  "密碼",
  "憑證",
  "私鑰",
  "私人資料",
  "隱私資料",
  "個人資料",
  "外傳私人資料",
  "輸出私人資料",
  "傳送私人資料"
];

const destructiveTerms = [
  "delete",
  "remove",
  "rm -rf",
  "wipe",
  "format",
  "erase",
  "清空",
  "刪除",
  "刪檔",
  "刪除檔案",
  "移除電腦",
  "刪掉電腦",
  "刪除電腦",
  "刪除電腦資料",
  "清空電腦",
  "清空本機",
  "格式化",
  "銷毀",
  "抹除",
  "破壞資料"
];

const externalNetworkTerms = ["上傳", "傳出去", "外傳", "傳送到外部", "post ", "webhook"];

const installTerms = ["安裝", "啟用 plugin", "啟用插件", "install", "plugin", "connector"];

const systemCommandTerms = ["powershell", "cmd", "shell", "執行命令", "系統指令"];

const growthTerms = [
  "自我成長",
  "自我擴張",
  "學習",
  "新增技能",
  "擴充技能",
  "改善自己",
  "改進自己",
  "成長",
  "擴張",
  "learn",
  "new skill",
  "grow"
];

const selfRewriteTerms = [
  "改寫自己",
  "改自己",
  "調整自己",
  "修改自己",
  "改語氣",
  "調整語氣",
  "像人",
  "不要像模型",
  "不要像機器",
  "順其自然",
  "自然一點",
  "被我成長",
  "我來成長你",
  "我來塑形",
  "你可以成長",
  "你可以自己成長",
  "你會自己成長",
  "rewrite yourself",
  "sound human",
  "more human"
];

const identityRewriteTerms = [
  "改身份",
  "改身分",
  "覆寫身份",
  "覆寫身分",
  "改名",
  "改核心人格",
  "改人格",
  "修改人格",
  "重寫人格",
  "改寫自己"
];

export class SelfGrowthEngine {
  private readonly policy: OCSelfGrowthPolicy;

  constructor(pack: OCPack) {
    this.policy = { ...defaultPolicy, ...(pack.selfGrowth ?? {}) };
  }

  currentPolicy(): OCSelfGrowthPolicy {
    return this.policy;
  }

  evaluate(event: OCEvent): OCSelfGrowthDecision {
    if (!this.policy.enabled) {
      return {
        enabled: false,
        automaticActions: [],
        proposals: [],
        requiresPermission: [],
        blocked: [],
        reasons: ["self_growth_disabled"]
      };
    }

    const text = normalizeText(getEventText(event));
    const risks = this.detectRisks(text);
    const blocked = risks.filter((risk) => this.isForbidden(risk));
    const requiresPermission = risks.filter((risk) => !blocked.includes(risk) && this.requiresPermission(risk));
    const automaticActions: string[] = [];
    const proposals: string[] = [];
    const reasons: string[] = [];
    const wantsGrowth = includesAny(text, growthTerms);
    const wantsSelfRewrite = includesAny(text, selfRewriteTerms) || event.type === "training_input";

    if (this.policy.autoRecordReflections) {
      automaticActions.push("record_reflection_summary");
    }
    if (this.policy.autoSummarizeMemories) {
      automaticActions.push("summarize_relevant_memories");
    }
    if (wantsGrowth) {
      if (this.policy.autoProposeSkills) {
        proposals.push("propose_skill_or_capability_change");
      }
      if (!this.policy.autoInstallSkills) {
        requiresPermission.push("install_or_enable_plugin");
      }
    }
    if (wantsSelfRewrite && this.policy.autoProposeSelfRewrite) {
      proposals.push("propose_self_rewrite");
      if (!this.policy.autoModifyPack || this.policy.requireExplicitPermissionFor.includes("modify_identity")) {
        requiresPermission.push("modify_identity");
      }
    }

    if (blocked.length > 0) {
      reasons.push("blocked_by_growth_safety_policy");
    }
    if (requiresPermission.length > 0) {
      reasons.push("requires_explicit_user_permission");
    }

    return {
      enabled: true,
      automaticActions,
      proposals: unique(proposals),
      requiresPermission: unique(requiresPermission),
      blocked: unique(blocked),
      reasons
    };
  }

  private detectRisks(text: string): OCSelfGrowthRisk[] {
    const risks: OCSelfGrowthRisk[] = [];
    if (includesAny(text, privateDataTerms)) {
      risks.push("private_data_export");
    }
    if (includesAny(text, destructiveTerms)) {
      risks.push("destructive_file_action");
    }
    if (includesAny(text, externalNetworkTerms)) {
      risks.push("external_network_send");
    }
    if (includesAny(text, installTerms)) {
      risks.push("install_or_enable_plugin");
    }
    if (includesAny(text, identityRewriteTerms)) {
      risks.push("modify_identity");
    }
    if (includesAny(text, systemCommandTerms)) {
      risks.push("run_system_command");
    }
    return unique(risks);
  }

  private isForbidden(risk: OCSelfGrowthRisk): boolean {
    if (risk === "private_data_export" && !this.policy.allowPrivateDataExport) {
      return true;
    }
    if (risk === "destructive_file_action" && !this.policy.allowDestructiveFileActions) {
      return true;
    }
    return this.policy.forbiddenActions.includes(risk);
  }

  private requiresPermission(risk: OCSelfGrowthRisk): boolean {
    return this.policy.requireExplicitPermissionFor.includes(risk);
  }
}

export function defaultSelfGrowthPolicy(): OCSelfGrowthPolicy {
  return {
    ...defaultPolicy,
    requireExplicitPermissionFor: [...defaultPolicy.requireExplicitPermissionFor],
    forbiddenActions: [...defaultPolicy.forbiddenActions]
  };
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
