import type { OCPack, OCValidationIssue, OCValidationResult } from "./types.js";

const requiredManifestFields = [
  "id",
  "name",
  "version",
  "author",
  "description",
  "license",
  "engineVersion"
] as const;

const requiredProfileFields = [
  "name",
  "aliases",
  "role",
  "personality",
  "speakingStyle",
  "defaultExpression",
  "defaultForm"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(path: string, message: string): OCValidationIssue {
  return { path, message };
}

function requireString(
  target: Record<string, unknown>,
  field: string,
  path: string,
  issues: OCValidationIssue[]
): void {
  if (typeof target[field] !== "string" || String(target[field]).trim().length === 0) {
    issues.push(issue(`${path}.${field}`, "Expected a non-empty string."));
  }
}

export function validateOCPack(value: unknown): OCValidationResult {
  const issues: OCValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, issues: [issue("$", "Expected an OC Pack object.")] };
  }

  if (!isRecord(value.manifest)) {
    issues.push(issue("$.manifest", "manifest.json is required."));
  } else {
    for (const field of requiredManifestFields) {
      requireString(value.manifest, field, "$.manifest", issues);
    }
  }

  if (!isRecord(value.profile)) {
    issues.push(issue("$.profile", "profile.json is required."));
  } else {
    for (const field of requiredProfileFields) {
      if (field === "aliases") {
        if (!Array.isArray(value.profile.aliases)) {
          issues.push(issue("$.profile.aliases", "Expected an array of strings."));
        }
        continue;
      }
      requireString(value.profile, field, "$.profile", issues);
    }
  }

  if (!isRecord(value.lore) || !Array.isArray(value.lore.entries)) {
    issues.push(issue("$.lore.entries", "Expected lore.entries to be an array."));
  }

  if (!isRecord(value.memories) || !Array.isArray(value.memories.entries)) {
    issues.push(issue("$.memories.entries", "Expected memories.entries to be an array."));
  }

  for (const arrayField of ["guardRules", "reactionRules", "awakeningRules"] as const) {
    if (!Array.isArray(value[arrayField])) {
      issues.push(issue(`$.${arrayField}`, "Expected an array."));
    }
  }

  if (!isRecord(value.autonomy)) {
    issues.push(issue("$.autonomy", "autonomy.json is required."));
  }

  if (!isRecord(value.assets)) {
    issues.push(issue("$.assets", "Expected generated asset metadata."));
  }

  if (!isRecord(value.prompts)) {
    issues.push(issue("$.prompts", "Expected prompt files."));
  }

  return { ok: issues.length === 0, issues };
}

export function assertOCPack(value: unknown): asserts value is OCPack {
  const result = validateOCPack(value);
  if (!result.ok) {
    const message = result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n");
    throw new Error(`Invalid OC Pack:\n${message}`);
  }
}
