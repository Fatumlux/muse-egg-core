export const ocPackManifestJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "MuseEgg Core OC Pack Manifest",
  type: "object",
  required: ["id", "name", "version", "author", "description", "license", "engineVersion"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    author: { type: "string", minLength: 1 },
    description: { type: "string" },
    license: { type: "string", minLength: 1 },
    engineVersion: { type: "string", minLength: 1 }
  }
} as const;

export const ocPackJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "MuseEgg Core OC Pack",
  type: "object",
  required: [
    "manifest",
    "profile",
    "lore",
    "memories",
    "guardRules",
    "reactionRules",
    "awakeningRules",
    "autonomy",
    "assets",
    "prompts"
  ],
  properties: {
    manifest: ocPackManifestJsonSchema,
    profile: {
      type: "object",
      required: [
        "name",
        "aliases",
        "role",
        "personality",
        "speakingStyle",
        "defaultExpression",
        "defaultForm"
      ],
      properties: {
        name: { type: "string" },
        aliases: { type: "array", items: { type: "string" } },
        role: { type: "string" },
        personality: { type: "string" },
        speakingStyle: { type: "string" },
        defaultExpression: { type: "string" },
        defaultForm: { type: "string" }
      }
    },
    lore: {
      type: "object",
      required: ["entries"],
      properties: {
        entries: { type: "array" }
      }
    },
    memories: {
      type: "object",
      required: ["entries"],
      properties: {
        entries: { type: "array" }
      }
    },
    guardRules: { type: "array" },
    reactionRules: { type: "array" },
    awakeningRules: { type: "array" },
    autonomy: { type: "object" },
    assets: { type: "object" },
    prompts: { type: "object" },
    modelRouting: { type: "object" },
    memoryStore: { type: "object" },
    selfGrowth: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        autoRecordReflections: { type: "boolean" },
        autoSummarizeMemories: { type: "boolean" },
        autoProposeLore: { type: "boolean" },
        autoProposeSkills: { type: "boolean" },
        autoProposeSelfRewrite: { type: "boolean" },
        allowSelfRewriteAfterApproval: { type: "boolean" },
        autoModifyPack: { type: "boolean" },
        autoInstallSkills: { type: "boolean" },
        allowPrivateDataExport: { type: "boolean" },
        allowDestructiveFileActions: { type: "boolean" },
        requireExplicitPermissionFor: { type: "array", items: { type: "string" } },
        forbiddenActions: { type: "array", items: { type: "string" } },
        proposalLogPath: { type: "string" }
      }
    },
    growthProposals: {
      type: "object",
      properties: {
        entries: { type: "array" }
      }
    },
    lifeState: { type: "object" },
    companion: { type: "object" },
    runtime: { type: "object" },
    soulFiles: {
      type: "object",
      additionalProperties: { type: "string" }
    },
    skills: { type: "array" }
  }
} as const;
