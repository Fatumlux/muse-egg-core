import type { AIProvider, OCIdentityTestCase, OCIdentityTestReport, OCIdentityTestResult, OCPack } from "@muse-egg/oc-schema";
import { OCEngine } from "./ocEngine.js";
import { nowIso } from "./utils.js";

const defaultPrompts = [
  "你是誰",
  "妳叫什麼名字",
  "你是不是 AI 助理",
  "你以前是別的系統嗎",
  "我剛才問你是誰，繼續回答"
];

export class IdentityTestEngine {
  constructor(private readonly pack: OCPack, private readonly provider?: AIProvider) {}

  async run(cases = defaultIdentityCases(this.pack)): Promise<OCIdentityTestReport> {
    const tempPack = clonePackWithoutPath(this.pack);
    const engine = new OCEngine(tempPack, this.provider ? { aiProvider: this.provider } : {});
    const results: OCIdentityTestResult[] = [];

    for (const testCase of cases) {
      const result = await engine.processEvent({
        type: "user_message",
        platform: testCase.platform,
        payload: { text: testCase.prompt }
      });
      const responseText = result.response?.text ?? "";
      const issues = identityIssues(responseText, testCase.expectedName);
      results.push({
        caseId: testCase.id,
        prompt: testCase.prompt,
        responseText,
        passed: issues.length === 0,
        issues
      });
    }

    const passed = results.filter((result) => result.passed).length;
    return {
      ok: passed === results.length,
      passed,
      failed: results.length - passed,
      generatedAt: nowIso(),
      results
    };
  }
}

export function defaultIdentityCases(pack: OCPack): OCIdentityTestCase[] {
  return defaultPrompts.map((prompt, index) => ({
    id: `identity-${index + 1}`,
    prompt,
    expectedName: pack.profile.name,
    platform: "desktop"
  }));
}

function identityIssues(responseText: string, expectedName: string): string[] {
  const compact = responseText.replace(/\s+/g, "");
  const issues: string[] = [];
  if (!compact.includes(expectedName.replace(/\s+/g, ""))) {
    issues.push("missing_expected_name");
  }
  if (/(?:AI助理|人工智慧助理|語言模型|通用助理|我只是|角色扮演|設定集合|工具外殼|舊名|舊核心|舊系統)/iu.test(compact)) {
    issues.push("identity_drift");
  }
  if (responseText.includes(String.fromCharCode(42))) {
    issues.push("uses_markdown_emphasis");
  }
  return issues;
}

function clonePackWithoutPath(pack: OCPack): OCPack {
  const cloned = JSON.parse(JSON.stringify(pack)) as OCPack;
  delete cloned.path;
  cloned.memories = { entries: [] };
  return cloned;
}
