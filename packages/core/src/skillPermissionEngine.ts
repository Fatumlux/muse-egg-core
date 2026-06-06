import type { OCPack, OCSkill, OCSkillPermissionAudit } from "@muse-egg/oc-schema";

const allowedPermissions = new Set([
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

const blockedPermissions = new Set([
  "delete_file",
  "write_outside_pack",
  "read_private_data",
  "export_private_data",
  "run_system_command",
  "install_plugin"
]);

export class SkillPermissionEngine {
  constructor(private readonly pack: OCPack) {}

  allowedSkills(skills: OCSkill[]): OCSkill[] {
    return skills.filter((skill) => this.audit(skill).allowed);
  }

  audit(skill: OCSkill): OCSkillPermissionAudit {
    const blocked = skill.permissions.filter((permission) => blockedPermissions.has(permission));
    const missing = skill.permissions.filter((permission) => !allowedPermissions.has(permission) && !blockedPermissions.has(permission));
    const notes: string[] = [];
    if (skill.permissions.includes("network_request") && this.pack.runtime?.network?.allowOutboundRequests === false) {
      notes.push("Pack runtime 已關閉對外網路。");
    }
    return {
      skillId: skill.id,
      allowed: blocked.length === 0 && missing.length === 0 && notes.length === 0,
      missingPermissions: missing,
      blockedPermissions: blocked,
      notes
    };
  }
}
