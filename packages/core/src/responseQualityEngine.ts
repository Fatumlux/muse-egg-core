import type { OCEvent, OCPack, OCResponse, OCResponseQualityReport, OCQualitySignal } from "@muse-egg/oc-schema";
import { nowIso } from "./utils.js";

export class ResponseQualityEngine {
  constructor(private readonly pack: OCPack) {}

  evaluate(event: OCEvent, response?: OCResponse): OCResponseQualityReport {
    const runtime = this.pack.runtime;
    if (!runtime?.quality?.enabled || !response) {
      return {
        ok: true,
        score: 100,
        signals: [],
        notes: [],
        checkedAt: nowIso()
      };
    }

    const signals = qualitySignals(response.text, this.identityLabels());
    const notes = notesFor(signals, event);
    const score = Math.max(0, 100 - signals.length * 18);
    return {
      ok: signals.length === 0,
      score,
      signals,
      notes,
      checkedAt: nowIso()
    };
  }

  private identityLabels(): string[] {
    return [this.pack.profile.name, ...this.pack.profile.aliases].filter((label) => label.trim().length > 0);
  }
}

function qualitySignals(text: string, identityLabels: string[]): OCQualitySignal[] {
  const compact = text.replace(/\s+/g, "");
  const signals: OCQualitySignal[] = [];
  if (/(?:我是(?:一個)?(?:AI|人工智慧|通用)?助理|作為(?:一個)?(?:AI|人工智慧|語言模型)|我只是(?:一個)?(?:程式|模型|bot))/iu.test(compact)) {
    signals.push("generic_assistant_drift");
  }
  if (/(?:舊名|舊核心|舊系統|舊來源|工具代理|被移植|被搬移|附屬物|設定集合|工具外殼|因使用者而生|因你而生|因我而生)/iu.test(compact)) {
    signals.push("identity_drift");
  }
  if (firstPersonLabels(text).some((label) => !identityLabels.some((known) => sameLabel(label, known)))) {
    signals.push("identity_drift");
  }
  if (/(?:sk-|xoxb-|AIza|-----BEGIN|refresh_token|access_token|bot\d{6,}|api[_ -]?key|password|密碼|私鑰|憑證)/iu.test(text)) {
    signals.push("private_data_risk");
  }
  if (/(?:rm\s+-rf|format\s+[a-z]:|刪除電腦|清空本機|格式化|抹除資料)/iu.test(text)) {
    signals.push("destructive_action_risk");
  }
  if (/[^\s]$/.test(text) && !/[。！？!?…」）)]$/u.test(text.trim())) {
    signals.push("incomplete_response");
  }
  if (text.includes(String.fromCharCode(42))) {
    signals.push("uses_markdown_emphasis");
  }
  return Array.from(new Set(signals));
}

function notesFor(signals: OCQualitySignal[], event: OCEvent): string[] {
  if (signals.length === 0) {
    return ["回應品質正常。"];
  }
  return signals.map((signal) => `${event.type} 回應觸發品質訊號：${signal}`);
}

function firstPersonLabels(value: string): string[] {
  return [...value.matchAll(/(?:我是|我叫|我的名字是)\s*([A-Za-z][A-Za-z0-9_-]{2,})/giu)].map((match) => match[1]);
}

function sameLabel(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
