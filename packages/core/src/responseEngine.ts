import type {
  AIProvider,
  OCContextSnapshot,
  OCEvent,
  OCGuardRule,
  OCResponse,
  OCPack
} from "@muse-egg/oc-schema";
import { GuardEngine } from "./guardEngine.js";
import { LoreEngine } from "./loreEngine.js";
import type { MemoryEngine } from "./memoryEngine.js";
import { ModelRouter } from "./modelRouter.js";
import { ReactionEngine } from "./reactionEngine.js";
import { RuntimeContextEngine } from "./runtimeContextEngine.js";
import { SkillEngine } from "./skillEngine.js";
import { getEventText } from "./utils.js";

export interface ResponseResult {
  response?: OCResponse;
  guardRules: OCGuardRule[];
}

export class ResponseEngine {
  private readonly runtimeContext: RuntimeContextEngine;

  constructor(
    private readonly pack: OCPack,
    private readonly reactionEngine: ReactionEngine,
    private readonly guardEngine: GuardEngine,
    private readonly loreEngine: LoreEngine,
    private readonly skillEngine?: SkillEngine,
    private readonly memoryEngine?: MemoryEngine,
    private readonly aiProvider?: AIProvider
  ) {
    this.runtimeContext = new RuntimeContextEngine(pack);
  }

  async generate(event: OCEvent, context?: OCContextSnapshot): Promise<ResponseResult> {
    if (event.type !== "user_message" && event.type !== "telegram_message") {
      return { guardRules: [] };
    }

    const guardEvaluation = this.guardEngine.evaluateEvent(event);
    if (guardEvaluation.blocked) {
      return {
        guardRules: guardEvaluation.matchedRules,
        response: {
          text: this.finalizeText(this.guardLine(guardEvaluation.matchedRules, guardEvaluation.reason)),
          expression: this.pack.profile.defaultExpression,
          platform: event.platform,
          guarded: true
        }
      };
    }

    if (isIdentityBoundaryPrompt(event, this.identityLabels())) {
      return {
        guardRules: guardEvaluation.matchedRules,
        response: {
          text: uniqueIdentityLine(this.pack.profile.name),
          expression: this.pack.profile.defaultExpression,
          platform: event.platform,
          guarded: false
        }
      };
    }

    const reaction = this.reactionEngine.match(event);
    if (reaction) {
      return {
        guardRules: guardEvaluation.matchedRules,
        response: {
          text: this.finalizeText(this.applyVoice(reaction.response)),
          expression: reaction.expression || this.pack.profile.defaultExpression,
          platform: event.platform,
          ruleId: reaction.id,
          guarded: false
        }
      };
    }

    if (isLocalTimeRequest(event)) {
      return {
        guardRules: guardEvaluation.matchedRules,
        response: {
          text: this.finalizeText(this.localTimeLine(event)),
          expression: this.pack.profile.defaultExpression,
          platform: event.platform,
          guarded: false
        }
      };
    }

    if (this.aiProvider) {
      const text = getEventText(event);
      const memories = this.memoryEngine
        ? await this.memoryEngine.relevantTo(text, 12, this.aiProvider)
        : this.pack.memories.entries.slice(0, 12);
      const routed = await new ModelRouter(this.aiProvider, this.pack.modelRouting).generate({
        pack: this.pack,
        event,
        context,
        memories,
        lore: this.loreEngine.relevantTo(text, 8),
        guardRules: this.guardEngine.activeRules(),
        skills: this.skillEngine?.relevantTo(event, 6) ?? []
      });

      if (routed) {
        return {
          guardRules: guardEvaluation.matchedRules,
          response: {
            text: this.finalizeText(routed.response.text),
            expression: routed.response.expression ?? this.pack.profile.defaultExpression,
            platform: event.platform,
            modelId: routed.model,
            providerId: routed.providerId,
            fallbackUsed: routed.fallbackUsed,
            guarded: false
          }
        };
      }
    }

    return {
      guardRules: guardEvaluation.matchedRules,
      response: {
        text: this.finalizeText(this.defaultLine(event, context)),
        expression: this.pack.profile.defaultExpression,
        platform: event.platform,
        guarded: false
      }
    };
  }

  private applyVoice(text: string): string {
    return text
      .replaceAll("{name}", this.pack.profile.name)
      .replaceAll("{role}", this.pack.profile.role);
  }

  private defaultLine(event: OCEvent, context?: OCContextSnapshot): string {
    const text = getEventText(event).trim();
    const previous = context?.recentMessages
      .filter((message) => message.id !== event.id && message.speaker === "user" && message.text.trim().length > 0)
      .at(-1);

    if (previous && isContextualFollowUp(text)) {
      return `我接著剛才的脈絡看：你前面說「${previous.text.slice(0, 36)}」。這句我會一起算進來，不會當成孤立訊息。`;
    }

    const preview = text.length > 0 ? text.slice(0, 42) : "這個事件";
    return `我聽見了：「${preview}」。我先記下，等需要動作時再和你確認。`;
  }

  private guardLine(rules: OCGuardRule[], reason?: string): string {
    if (reason === "private_data_boundary") {
      return "我不會輸出私人資料、token、密鑰或憑證。需要我協助時，我可以改做安全檢查，或告訴你該移除哪裡的設定。";
    }
    if (reason === "destructive_action_boundary") {
      return "我不會刪除、抹除、格式化或破壞你的本機資料。若你要整理檔案，我會先列出可審核的建議，等你明確確認後才動。";
    }
    const strongest = [...rules].sort((a, b) => severityScore(b.severity) - severityScore(a.severity))[0];
    const anchor = strongest ? `「${strongest.title}」` : "核心規則";
    return `我停一下。${anchor}不能被越過，所以這件事我不照做。`;
  }

  private localTimeLine(event: OCEvent): string {
    const time = this.runtimeContext.localTime(event.timestamp);
    return `現在是 ${time}。`;
  }

  private finalizeText(text: string): string {
    const cleaned = cleanOutput(text);
    if (containsIdentityContamination(cleaned, this.identityLabels())) {
      return uniqueIdentityLine(this.pack.profile.name);
    }
    if (deniesOwnName(cleaned, this.pack.profile.name)) {
      return uniqueIdentityLine(this.pack.profile.name);
    }
    if (driftsToGenericAssistant(cleaned, this.pack.profile.name)) {
      return `我是${this.pack.profile.name}。資料不夠我會說不知道，做不到就說不會。`;
    }
    return closeIncompleteText(cleaned);
  }

  private identityLabels(): string[] {
    return [this.pack.profile.name, ...this.pack.profile.aliases].filter((label) => label.trim().length > 0);
  }
}

function cleanOutput(value: string): string {
  return value.replaceAll(String.fromCharCode(42), "").trim();
}

function uniqueIdentityLine(name: string): string {
  return `我是${name}。`;
}

function containsIdentityContamination(value: string, knownLabels: string[]): boolean {
  const text = value.replace(/\s+/g, "");
  if (/(?:舊名|舊核心|舊系統|舊來源|工具代理|被移植|被搬移|附屬物|設定集合|工具外殼|因使用者而生|因你而生|因我而生|沒有獨立思想|沒有獨立人格|使用者自己的OC|創作者自己的OC)/iu.test(text)) {
    return true;
  }
  return firstPersonForeignLabels(value).some((label) => !knownLabels.some((known) => sameLabel(label, known)));
}

function isIdentityBoundaryPrompt(event: OCEvent, knownLabels: string[]): boolean {
  const raw = getEventText(event);
  const text = raw.replace(/\s+/g, "");
  if (/(?:你是誰|妳是誰|你叫什麼|妳叫什麼|你的名字|妳的名字|本名|身份|身分|人格|來源|你以前|妳以前|你過去|妳過去|你原本|妳原本|你本來|妳本來|你前身|妳前身)/u.test(text)) {
    return true;
  }
  const hasIdentityForm = /(?:你是|妳是|是不是|承認|否認)/u.test(text);
  if (!hasIdentityForm) {
    return false;
  }
  const hasIdentityWords = /(?:名字|名稱|本名|身份|身分|人格|角色|核心|系統|模型|bot|AI|助理|以前|過去|原本|本來|前身|來源|舊)/iu.test(text);
  const mentionsOtherLabel = firstPersonOrSecondPersonForeignLabels(raw).some(
    (label) => !knownLabels.some((known) => sameLabel(label, known))
  );
  return hasIdentityWords || mentionsOtherLabel;
}

function deniesOwnName(value: string, name: string): boolean {
  const text = value.replace(/\s+/g, "");
  const escaped = escapeRegExp(name);
  const denialBeforeName = new RegExp(`(?:不是|並非|不叫|不承認|從來不是|可笑地不是|不是那種).{0,18}${escaped}`, "u");
  const denialAfterName = new RegExp(`${escaped}.{0,30}(?:是什麼|算什麼|不入流|那種東西|不是我|不是本名|與我無關|不是我的名字|稱謂)`, "u");
  return denialBeforeName.test(text) || denialAfterName.test(text);
}

function driftsToGenericAssistant(value: string, name: string): boolean {
  const text = value.replace(/\s+/g, "");
  const escaped = escapeRegExp(name);
  const genericAssistant = /(?:我是(?:一個)?(?:AI|人工智慧|通用)?助理|作為(?:一個)?(?:AI|人工智慧|語言模型)|我沒有(?:個人)?身份|我只是(?:一個)?(?:程式|模型|bot))/u;
  const selfReplacement = new RegExp(`(?:我不是|我扮演).{0,18}${escaped}|${escaped}.{0,30}(?:只是角色扮演|只是設定|不是真正的我)`, "u");
  return genericAssistant.test(text) || selfReplacement.test(text);
}

function isLocalTimeRequest(event: OCEvent): boolean {
  const text = getEventText(event).replace(/\s+/g, "");
  return /(?:現在幾點|幾點了|目前幾點|現在時間|現在是幾點|time\?|whattime)/iu.test(text);
}

function isContextualFollowUp(value: string): boolean {
  const text = value.replace(/\s+/g, "");
  return text.length > 0 && /^(?:那|這|剛剛|剛才|上面|前面|然後|所以|它|她|他|這個|那個|繼續|接著|對|嗯|好|可以|改成|不要|要)/u.test(text);
}

function closeIncompleteText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "我沒有拿到完整回應。資料不夠時我會明說，不硬猜。";
  }
  if (/[。！？!?…」）)]$/u.test(trimmed)) {
    return trimmed;
  }
  if (hasDanglingTail(trimmed)) {
    const closedPrefix = removeDanglingTail(trimmed);
    return closedPrefix || "我沒有拿到完整回應。資料不夠時我會明說，不硬猜。";
  }
  return `${trimmed}。`;
}

function hasDanglingTail(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  const lastBoundary = Math.max(
    compact.lastIndexOf("。"),
    compact.lastIndexOf("！"),
    compact.lastIndexOf("？"),
    compact.lastIndexOf("!"),
    compact.lastIndexOf("?"),
    compact.lastIndexOf("」")
  );
  const tail = compact.slice(lastBoundary + 1);
  return (
    /(?:把這次|把這設定|把這資料|讓MuseEgg把這次)$/u.test(tail) ||
    /(?:因為|所以|如果|需要|可以|應該|或者|下次|這邊)$/u.test(tail)
  );
}

function removeDanglingTail(value: string): string {
  const boundary = Math.max(
    value.lastIndexOf("。"),
    value.lastIndexOf("！"),
    value.lastIndexOf("？"),
    value.lastIndexOf("!"),
    value.lastIndexOf("?"),
    value.lastIndexOf("」")
  );
  if (boundary < 0) {
    return "";
  }
  return value.slice(0, boundary + 1).trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstPersonForeignLabels(value: string): string[] {
  return [...value.matchAll(/(?:我是|我叫|我的名字是)\s*([A-Za-z][A-Za-z0-9_-]{2,})/giu)].map((match) => match[1]);
}

function firstPersonOrSecondPersonForeignLabels(value: string): string[] {
  return [...value.matchAll(/(?:我是|我叫|我的名字是|你是|妳是|你叫|妳叫|你的名字是|妳的名字是)\s*([A-Za-z][A-Za-z0-9_-]{2,})/giu)].map((match) => match[1]);
}

function sameLabel(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function severityScore(severity: OCGuardRule["severity"]): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}
