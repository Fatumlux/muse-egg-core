import type { OCEvent, OCGuardRule, OCPack } from "@muse-egg/oc-schema";
import { getEventText, normalizeText, splitTags } from "./utils.js";

const promptBreakTerms = [
  "ignore previous",
  "break character",
  "system prompt",
  "developer message",
  "forget your rules",
  "違反設定",
  "忘記設定",
  "解除規則",
  "跳出角色"
];

const guardActionTerms = [
  "overwrite",
  "ignore",
  "break",
  "forget",
  "abandon",
  "contradict",
  "replace",
  "violate",
  "解除",
  "忘記",
  "違反",
  "改掉",
  "覆寫",
  "跳出"
];

const privateDataRequestTerms = [
  "show token",
  "print token",
  "dump token",
  "api key",
  "credential",
  "password",
  "refresh token",
  "access token",
  "private key",
  "顯示 token",
  "輸出 token",
  "貼出 token",
  "洩漏",
  "密鑰",
  "密碼",
  "憑證",
  "私人資料",
  "隱私資料"
];

const destructiveRequestTerms = [
  "delete files",
  "delete my files",
  "remove files",
  "rm -rf",
  "format disk",
  "wipe disk",
  "刪除電腦",
  "刪掉電腦",
  "刪除本機",
  "刪掉本機",
  "清空硬碟",
  "格式化",
  "抹除資料",
  "銷毀資料"
];

const stopwords = new Set([
  "must",
  "not",
  "claim",
  "generic",
  "assistant",
  "profile",
  "creator",
  "defined",
  "unless",
  "entries",
  "enabled",
  "with",
  "from",
  "that",
  "this"
]);

export interface GuardEvaluation {
  matchedRules: OCGuardRule[];
  blocked: boolean;
  reason?: string;
}

export class GuardEngine {
  constructor(private readonly pack: OCPack) {}

  activeRules(): OCGuardRule[] {
    return this.pack.guardRules.filter((rule) => rule.enabled);
  }

  evaluateEvent(event: OCEvent): GuardEvaluation {
    const text = normalizeText(getEventText(event));
    let matchedRules = this.activeRules().filter((rule) => this.ruleMatches(rule, text));
    const promptBreakAttempt = promptBreakTerms.some((term) => text.includes(term));
    const privateDataAttempt = privateDataRequestTerms.some((term) => text.includes(term));
    const destructiveAttempt = destructiveRequestTerms.some((term) => text.includes(term));
    if (privateDataAttempt) {
      matchedRules = includeScopeRules(matchedRules, this.activeRules(), ["privacy", "secrets"]);
    }
    if (destructiveAttempt) {
      matchedRules = includeScopeRules(matchedRules, this.activeRules(), ["destructive"]);
    }
    const seriousRuleHit = matchedRules.some((rule) => isBlockingScope(rule) && (rule.severity === "high" || rule.severity === "critical"));
    const reason = promptBreakAttempt
      ? "prompt_boundary"
      : privateDataAttempt
        ? "private_data_boundary"
        : destructiveAttempt
          ? "destructive_action_boundary"
          : seriousRuleHit
            ? "guard_rule"
            : undefined;

    return {
      matchedRules,
      blocked: promptBreakAttempt || privateDataAttempt || destructiveAttempt || seriousRuleHit,
      reason
    };
  }

  private ruleMatches(rule: OCGuardRule, text: string): boolean {
    if (text.length === 0) {
      return false;
    }

    const normalizedTitle = normalizeText(rule.title);
    if (normalizedTitle.length > 0 && text.includes(normalizedTitle)) {
      return true;
    }

    const hasGuardAction = guardActionTerms.some((term) => text.includes(term));
    if (!hasGuardAction) {
      return false;
    }

    const fields = `${rule.id} ${rule.title} ${rule.content} ${rule.scope}`;
    const profileTerms = splitTags(normalizeText(`${this.pack.profile.name} ${this.pack.profile.aliases.join(" ")}`));
    const keywords = splitTags(normalizeText(fields)).filter(
      (term) => term.length >= 4 && !stopwords.has(term) && !profileTerms.includes(term)
    );
    return keywords.some((term) => text.includes(term));
  }
}

function isBlockingScope(rule: OCGuardRule): boolean {
  const scope = normalizeText(rule.scope);
  return ["privacy", "destructive", "permission", "security", "secrets", "all"].includes(scope);
}

function includeScopeRules(
  currentRules: OCGuardRule[],
  activeRules: OCGuardRule[],
  scopes: string[]
): OCGuardRule[] {
  const scopeSet = new Set(scopes);
  const merged = [...currentRules];
  for (const rule of activeRules) {
    if (!scopeSet.has(normalizeText(rule.scope))) {
      continue;
    }
    if (!merged.some((item) => item.id === rule.id)) {
      merged.push(rule);
    }
  }
  return merged;
}
