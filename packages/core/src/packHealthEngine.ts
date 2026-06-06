import type { OCValidationIssue, OCPack, OCPackHealthReport, OCSkillPermissionAudit } from "@muse-egg/oc-schema";
import { validateOCPack } from "@muse-egg/oc-schema";
import { IdentityTestEngine } from "./identityTestEngine.js";
import { nowIso } from "./utils.js";

const allowedSkillPermissions = new Set([
  "read_pack",
  "read_event",
  "read_profile",
  "read_memory",
  "write_memory",
  "read_lore",
  "read_guard_rules",
  "write_lore",
  "write_proposal",
  "send_message",
  "awaken",
  "telegram_reply",
  "scheduler",
  "file_index_read",
  "asset_read",
  "network_request"
]);

const blockedSkillPermissions = new Set([
  "delete_file",
  "write_outside_pack",
  "read_private_data",
  "export_private_data",
  "run_system_command",
  "install_plugin"
]);

export class PackHealthEngine {
  constructor(private readonly pack: OCPack) {}

  async report(options: { includeIdentityTests?: boolean } = {}): Promise<OCPackHealthReport> {
    const validation = validateOCPack(this.pack);
    const privateDataFindings = scanPrivateData(this.pack);
    const assetFindings = scanAssets(this.pack);
    const skillFindings = auditSkills(this.pack).flatMap((audit) =>
      audit.allowed
        ? []
        : [
            issue(
              `$.skills.${audit.skillId}`,
              [...audit.missingPermissions, ...audit.blockedPermissions, ...audit.notes].join("；")
            )
          ]
    );
    const identity = options.includeIdentityTests ? await new IdentityTestEngine(this.pack).run() : undefined;
    const issues = [...validation.issues, ...privateDataFindings, ...assetFindings, ...skillFindings];
    const penalty = issues.length * 8 + (identity ? identity.failed * 12 : 0);

    return {
      ok: issues.length === 0 && (identity ? identity.ok : true),
      score: Math.max(0, 100 - penalty),
      generatedAt: nowIso(),
      issues,
      identity,
      privateDataFindings,
      assetFindings,
      skillFindings
    };
  }
}

export function auditSkills(pack: OCPack): OCSkillPermissionAudit[] {
  return (pack.skills ?? []).map((skill) => {
    const blockedPermissions = skill.permissions.filter((permission) => blockedSkillPermissions.has(permission));
    const missingPermissions = skill.permissions.filter(
      (permission) => !allowedSkillPermissions.has(permission) && !blockedSkillPermissions.has(permission)
    );
    return {
      skillId: skill.id,
      allowed: blockedPermissions.length === 0 && missingPermissions.length === 0,
      missingPermissions,
      blockedPermissions,
      notes: skill.enabled && blockedPermissions.length > 0 ? ["啟用中的技能含高風險權限。"] : []
    };
  });
}

function scanPrivateData(pack: OCPack): OCValidationIssue[] {
  const findings: OCValidationIssue[] = [];
  const inspect = (path: string, value: unknown) => {
    if (typeof value === "string" && containsSecretLikeText(value)) {
      findings.push(issue(path, "疑似包含 token、key、憑證或私人識別資訊。"));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspect(`${path}.${index}`, item));
      return;
    }
    if (typeof value === "object" && value !== null) {
      Object.entries(value).forEach(([key, nested]) => inspect(`${path}.${key}`, nested));
    }
  };

  inspect("$", withoutRuntimeOnlyFields(pack));
  for (const [index, root] of (pack.runtime?.folderIndex?.roots ?? []).entries()) {
    if (/[\\/]Users[\\/]|[\\/]home[\\/]|OneDrive|Desktop|Documents|文件/iu.test(root)) {
      findings.push(issue(`$.runtime.folderIndex.roots.${index}`, "固定資料夾看起來包含本機私人路徑；公開前請移除或改成相對路徑。"));
    }
  }
  return findings;
}

function scanAssets(pack: OCPack): OCValidationIssue[] {
  const findings: OCValidationIssue[] = [];
  const characterFiles = new Set(pack.assets.character);
  for (const binding of pack.assets.characterBindings ?? []) {
    if (!characterFiles.has(binding.fileName)) {
      findings.push(issue(`$.assets.characterBindings.${binding.id}`, `找不到角色圖片：${binding.fileName}`));
    }
    if (!binding.expression.trim()) {
      findings.push(issue(`$.assets.characterBindings.${binding.id}.expression`, "表情綁定不可為空。"));
    }
  }
  return findings;
}

function containsSecretLikeText(value: string): boolean {
  return /(?:\d{8,}:[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|refresh_token|access_token|-----BEGIN|private[_ -]?key|password\s*=|api[_ -]?key\s*=)/iu.test(value);
}

function withoutRuntimeOnlyFields(pack: OCPack): OCPack {
  const cloned = JSON.parse(JSON.stringify(pack)) as OCPack;
  delete cloned.path;
  return cloned;
}

function issue(path: string, message: string): OCValidationIssue {
  return { path, message };
}
