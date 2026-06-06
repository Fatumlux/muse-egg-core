export const ocEventTypes = [
  "user_message",
  "training_input",
  "lore_update",
  "guard_rule_update",
  "oc_pack_imported",
  "oc_pack_exported",
  "observed_file_change",
  "observed_final_candidate",
  "scheduled_daily_reflection",
  "scheduled_weekly_report",
  "telegram_message",
  "custom_event"
] as const;

export type OCEventType = (typeof ocEventTypes)[number];

export type OCPlatform =
  | "desktop"
  | "telegram"
  | "file_watcher"
  | "scheduler"
  | "system"
  | "custom";

export type GuardSeverity = "low" | "medium" | "high" | "critical";

export type AwakeningLevel = "sleep" | "subtle" | "notification" | "full";

export interface OCPackManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  license: string;
  engineVersion: string;
}

export interface OCProfile {
  name: string;
  aliases: string[];
  role: string;
  personality: string;
  speakingStyle: string;
  defaultExpression: string;
  defaultForm: string;
}

export interface OCLoreEntry {
  id: string;
  title: string;
  content: string;
  scope: string;
  priority: number;
  tags: string[];
}

export interface OCLoreVault {
  entries: OCLoreEntry[];
}

export interface OCMemoryEntry {
  id: string;
  type: OCEventType | "note";
  content: string;
  timestamp: string;
  sourceEventId?: string;
  importance: number;
  tags: string[];
  layer?: OCMemoryLayer;
  confidence?: OCMemoryConfidence;
  status?: OCMemoryStatus;
  confirmRequired?: boolean;
  confirmedAt?: string;
}

export interface OCMemoryVault {
  entries: OCMemoryEntry[];
}

export type OCMemoryLayer = "identity" | "canon" | "long_term" | "short_term" | "observation" | "ephemeral";
export type OCMemoryConfidence = "confirmed" | "observed" | "inferred" | "speculative";
export type OCMemoryStatus = "candidate" | "confirmed" | "deprecated" | "rejected";

export interface OCMemoryStoreConfig {
  enabled: boolean;
  kind: "sqlite-vec";
  databasePath: string;
  embeddingModel: string;
  dimensions: number;
  importedFrom?: string;
  useFtsFallback: boolean;
}

export interface OCGuardRule {
  id: string;
  title: string;
  content: string;
  severity: GuardSeverity;
  scope: string;
  enabled: boolean;
}

export interface OCReactionRule {
  id: string;
  trigger: string;
  response: string;
  expression: string;
  platform: OCPlatform | "any";
  enabled: boolean;
}

export interface OCAwakeningRule {
  id: string;
  trigger: string;
  score: number;
  dialogue: string;
  expression: string;
  enabled: boolean;
}

export interface OCAutonomySettings {
  enabled: boolean;
  quietHours: {
    start: string;
    end: string;
  };
  maxWakeupsPerDay: number;
  wakeFrequency: "low" | "medium" | "high";
  wakeOnTelegramMessage: boolean;
  wakeOnFileChange: boolean;
  wakeOnScheduledCheck: boolean;
}

export type OCSelfGrowthRisk =
  | "private_data_export"
  | "destructive_file_action"
  | "external_network_send"
  | "install_or_enable_plugin"
  | "modify_identity"
  | "write_outside_pack"
  | "run_system_command";

export interface OCSelfGrowthPolicy {
  enabled: boolean;
  autoRecordReflections: boolean;
  autoSummarizeMemories: boolean;
  autoProposeLore: boolean;
  autoProposeSkills: boolean;
  autoProposeSelfRewrite: boolean;
  allowSelfRewriteAfterApproval: boolean;
  autoModifyPack: boolean;
  autoInstallSkills: boolean;
  allowPrivateDataExport: boolean;
  allowDestructiveFileActions: boolean;
  requireExplicitPermissionFor: OCSelfGrowthRisk[];
  forbiddenActions: OCSelfGrowthRisk[];
  proposalLogPath: string;
}

export type OCGrowthProposalKind = "lore" | "reaction" | "awakening" | "skill" | "memory" | "permission" | "self_rewrite";
export type OCGrowthProposalStatus = "pending" | "approved" | "rejected" | "applied" | "blocked";

export interface OCSelfRewritePatch {
  profile?: Partial<OCProfile>;
  prompts?: Partial<OCPrompts>;
  loreEntries?: OCLoreEntry[];
  reactionRules?: OCReactionRule[];
  notes?: string;
}

export interface OCGrowthProposal {
  id: string;
  kind: OCGrowthProposalKind;
  title: string;
  rationale: string;
  status: OCGrowthProposalStatus;
  createdAt: string;
  updatedAt?: string;
  sourceEventId?: string;
  sourceEventType?: OCEventType;
  requiresPermission: OCSelfGrowthRisk[];
  blockedRisks: OCSelfGrowthRisk[];
  suggestedLore?: OCLoreEntry;
  suggestedSkill?: OCSkill;
  suggestedSelfRewrite?: OCSelfRewritePatch;
  notes?: string;
}

export interface OCGrowthProposalVault {
  entries: OCGrowthProposal[];
}

export interface OCLifeState {
  mood: "calm" | "curious" | "focused" | "guarded" | "warm" | "tired" | "alert";
  energy: number;
  trust: number;
  bond: number;
  wakefulness: number;
  stress: number;
  lastUpdated: string;
  summary: string;
}

export interface OCCompanionSettings {
  enabled: boolean;
  desktopPet: boolean;
  websiteSync: boolean;
  launchOnStartup: boolean;
  relationshipMode: "friend" | "lover" | "family" | "guardian" | "custom";
  notificationLevel: "quiet" | "balanced" | "expressive";
  allowAmbientWakeups: boolean;
  smallWindowAlwaysOnTop: boolean;
}

export interface OCLocalRuntimeSettings {
  enabled: boolean;
  timezone: string;
  locale: string;
  exposeLocalTime: boolean;
  exposePackPath: boolean;
  allowReadInsidePack: boolean;
  allowReadOutsidePack: boolean;
  allowShellCommands: boolean;
}

export interface OCNetworkRuntimeSettings {
  enabled: boolean;
  allowOutboundRequests: boolean;
  requirePermissionForExternalHosts: boolean;
  allowedHosts: string[];
  blockedHosts: string[];
  maxResponseBytes: number;
  userAgent: string;
  webSearchEnabled: boolean;
}

export interface OCContextRuntimeSettings {
  enabled: boolean;
  maxRecentEvents: number;
  maxPromptChars: number;
  includeRuntimeEnvironment: boolean;
  includeLifeState: boolean;
}

export interface OCFolderIndexRuntimeSettings {
  enabled: boolean;
  roots: string[];
  maxFiles: number;
  includeExtensions: string[];
  excludePatterns: string[];
  refreshIntervalMinutes: number;
}

export interface OCQualityRuntimeSettings {
  enabled: boolean;
  blockIdentityDrift: boolean;
  blockPrivateDataLeak: boolean;
  blockIncompleteResponse: boolean;
  recordReports: boolean;
}

export interface OCUpdateRuntimeSettings {
  enabled: boolean;
  checkOnStartup: boolean;
  checkIntervalHours: number;
}

export interface OCRuntimeSettings {
  local: OCLocalRuntimeSettings;
  network: OCNetworkRuntimeSettings;
  context: OCContextRuntimeSettings;
  folderIndex: OCFolderIndexRuntimeSettings;
  quality: OCQualityRuntimeSettings;
  updates: OCUpdateRuntimeSettings;
}

export interface OCPrompts {
  baseSystem: string;
  responseStyle: string;
}

export interface OCModelRouting {
  enabled: boolean;
  primaryModel: string;
  fallbackModels: string[];
  retryPerModel: number;
  timeoutMs: number;
}

export const ocSoulFileNames = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "MEMORY.md"
] as const;

export type OCSoulFileName = (typeof ocSoulFileNames)[number];

export type OCSoulFiles = Partial<Record<OCSoulFileName, string>>;

export interface OCSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  triggers: string[];
  permissions: string[];
  platforms: Array<OCPlatform | "any">;
  instructions: string;
  path?: string;
}

export interface OCCharacterAssetBinding {
  id: string;
  expression: string;
  fileName: string;
  enabled: boolean;
  priority: number;
}

export interface OCPackAssets {
  character: string[];
  live2d: string[];
  voice: string[];
  characterBindings?: OCCharacterAssetBinding[];
}

export interface OCPack {
  manifest: OCPackManifest;
  profile: OCProfile;
  lore: OCLoreVault;
  memories: OCMemoryVault;
  guardRules: OCGuardRule[];
  reactionRules: OCReactionRule[];
  awakeningRules: OCAwakeningRule[];
  autonomy: OCAutonomySettings;
  assets: OCPackAssets;
  prompts: OCPrompts;
  modelRouting?: OCModelRouting;
  memoryStore?: OCMemoryStoreConfig;
  selfGrowth?: OCSelfGrowthPolicy;
  growthProposals?: OCGrowthProposalVault;
  lifeState?: OCLifeState;
  companion?: OCCompanionSettings;
  runtime?: OCRuntimeSettings;
  soulFiles?: OCSoulFiles;
  skills?: OCSkill[];
  path?: string;
}

export interface OCEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: OCEventType;
  timestamp: string;
  platform: OCPlatform;
  payload: TPayload;
  source?: string;
}

export interface OCResponse {
  text: string;
  expression: string;
  platform: OCPlatform;
  ruleId?: string;
  modelId?: string;
  providerId?: string;
  fallbackUsed?: boolean;
  guarded: boolean;
}

export type OCQualitySignal =
  | "identity_drift"
  | "generic_assistant_drift"
  | "private_data_risk"
  | "destructive_action_risk"
  | "incomplete_response"
  | "uses_markdown_emphasis"
  | "unsupported_claim";

export interface OCResponseQualityReport {
  ok: boolean;
  score: number;
  signals: OCQualitySignal[];
  notes: string[];
  checkedAt: string;
}

export type OCContextSpeaker = "user" | "oc" | "system";

export interface OCContextMessage {
  id: string;
  type: OCEventType;
  timestamp: string;
  platform: OCPlatform;
  speaker: OCContextSpeaker;
  text: string;
}

export interface OCContextSnapshot {
  enabled: boolean;
  currentEvent: OCContextMessage;
  recentMessages: OCContextMessage[];
  notes: string[];
  limits: {
    maxRecentEvents: number;
    maxPromptChars: number;
  };
}

export interface AwakeningResult {
  score: number;
  level: AwakeningLevel;
  dialogue?: string;
  expression?: string;
  matchedRuleIds: string[];
  shouldWake: boolean;
}

export interface OCProcessResult {
  event: OCEvent;
  response?: OCResponse;
  awakening: AwakeningResult;
  memory?: OCMemoryEntry;
  selfGrowth?: OCSelfGrowthDecision;
  growthProposals?: OCGrowthProposal[];
  quality?: OCResponseQualityReport;
  growthJournal?: OCGrowthJournalEntry;
  lifeState?: OCLifeState;
  guardRuleIds: string[];
}

export interface OCSelfGrowthDecision {
  enabled: boolean;
  automaticActions: string[];
  proposals: string[];
  requiresPermission: OCSelfGrowthRisk[];
  blocked: OCSelfGrowthRisk[];
  reasons: string[];
}

export interface OCValidationIssue {
  path: string;
  message: string;
}

export interface OCValidationResult {
  ok: boolean;
  issues: OCValidationIssue[];
}

export interface OCIdentityTestCase {
  id: string;
  prompt: string;
  expectedName: string;
  platform: OCPlatform;
}

export interface OCIdentityTestResult {
  caseId: string;
  prompt: string;
  responseText: string;
  passed: boolean;
  issues: string[];
}

export interface OCIdentityTestReport {
  ok: boolean;
  passed: number;
  failed: number;
  generatedAt: string;
  results: OCIdentityTestResult[];
}

export interface OCPackHealthReport {
  ok: boolean;
  score: number;
  generatedAt: string;
  issues: OCValidationIssue[];
  identity?: OCIdentityTestReport;
  privateDataFindings: OCValidationIssue[];
  assetFindings: OCValidationIssue[];
  skillFindings: OCValidationIssue[];
}

export interface OCPackBackupEntry {
  id: string;
  path: string;
  createdAt: string;
  files: string[];
}

export interface OCGrowthJournalEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  eventId?: string;
  memoryId?: string;
  proposalIds: string[];
  qualitySignals: OCQualitySignal[];
  createdAt: string;
}

export interface OCFolderIndexItem {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
  root: string;
}

export interface OCFolderIndexSnapshot {
  generatedAt: string;
  roots: string[];
  items: OCFolderIndexItem[];
  truncated: boolean;
  issues: OCValidationIssue[];
}

export interface OCSkillPermissionAudit {
  skillId: string;
  allowed: boolean;
  missingPermissions: string[];
  blockedPermissions: string[];
  notes: string[];
}

export interface AIProviderRequest {
  pack: OCPack;
  event: OCEvent;
  model?: string;
  context?: OCContextSnapshot;
  memories: OCMemoryEntry[];
  lore: OCLoreEntry[];
  guardRules: OCGuardRule[];
  skills?: OCSkill[];
}

export interface AIProviderResponse {
  text: string;
  expression?: string;
}

export interface AIEmbeddingRequest {
  input: string[];
  model?: string;
  dimensions?: number;
}

export interface AIEmbeddingResponse {
  embeddings: number[][];
  model?: string;
}

export interface AIProvider {
  id: string;
  displayName: string;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
  embed?(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;
}
