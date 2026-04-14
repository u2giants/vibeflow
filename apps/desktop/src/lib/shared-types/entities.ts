/** Core entity interfaces shared across all VibeFlow packages. */

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isSelfMaintenance: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface ConversationThread {
  id: string;
  projectId: string;
  userId?: string;
  title: string;
  runState: RunState;
  ownerDeviceId: string | null;
  ownerDeviceName: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modeId: string | null;
  modelId: string | null;
  createdAt: string;
}

export interface ExecutionEvent {
  id: string;
  conversationId: string;
  type: 'mode-start' | 'mode-end' | 'tool-call' | 'tool-result' | 'thinking' | 'info';
  modeId: string | null;
  content: string;
  createdAt: string;
}

export type RunState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'waiting_for_second_model_review'
  | 'waiting_for_human_approval'
  | 'waiting_for_user_input'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'abandoned'
  | 'recoverable';

export type SyncStatus = 'synced' | 'syncing' | 'degraded' | 'offline';

export interface DeviceInfo {
  id: string;
  name: string;
  userId: string;
  lastSeenAt: string;
}

export interface ConversationLease {
  conversationId: string;
  deviceId: string;
  deviceName: string;
  acquiredAt: string;
  expiresAt: string;
  heartbeatIntervalSeconds: number;
}

// ── Mode System ─────────────────────────────────────────────────────

export type ApprovalPolicy = 'auto' | 'second-model' | 'human';

export interface Mode {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  soul: string;
  modelId: string;
  fallbackModelId: string | null;
  temperature: number;
  approvalPolicy: ApprovalPolicy;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  supportsTools: boolean;
}

// ── DevOps ─────────────────────────────────────────────────────

export interface ProjectDevOpsConfig {
  projectId: string;
  templateId: string;
  githubOwner: string;
  githubRepo: string;
  coolifyAppId: string;
  coolifyBaseUrl: string;
  imageName: string;
  healthCheckUrl: string;
  updatedAt: string;
}

export interface DeployRun {
  id: string;
  projectId: string;
  templateId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  commitSha: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

// ── Component 10: Product Shell and AI-Native Workspace ──────────────

export type MissionStatus =
  | 'draft'
  | 'planning'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Mission {
  id: string;
  projectId: string;
  title: string;
  operatorRequest: string;
  clarifiedConstraints: string[];
  status: MissionStatus;
  owner: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanStep {
  id: string;
  missionId: string;
  order: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'blocked' | 'completed' | 'skipped';
  requiredCapabilities: string[];
  riskLabel: string | null;
  requiredEvidence: string[];
  expectedOutput: string | null;
}

export interface Plan {
  missionId: string;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ContextPack {
  id: string;
  missionId: string;
  loadedFiles: string[];
  loadedSymbols: string[];
  loadedMemoryPacks: string[];
  environmentsInScope: string[];
  servicesInScope: string[];
  tokenUsage: number;
  contextUsage: number;
  staleContextWarnings: string[];
  suggestedMissingContext: string[];
}

export type EvidenceItemType =
  | 'lint'
  | 'type-check'
  | 'build'
  | 'test'
  | 'browser'
  | 'screenshot'
  | 'trace'
  | 'log'
  | 'policy'
  | 'performance'
  | 'schema-safety';

export interface EvidenceItem {
  id: string;
  missionId: string;
  type: EvidenceItemType;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'skipped';
  title: string;
  detail: string | null;
  timestamp: string;
}

export type CapabilityClass =
  | 'filesystem'
  | 'git'
  | 'terminal'
  | 'browser'
  | 'mcp'
  | 'direct-api'
  | 'ssh'
  | 'secrets'
  | 'logs-metrics'
  | 'build-package';

export type CapabilityHealth =
  | 'healthy'
  | 'degraded'
  | 'unauthorized'
  | 'misconfigured'
  | 'offline'
  | 'unknown';

export type CapabilityPermission =
  | 'read-only'
  | 'local-write'
  | 'repository-mutation'
  | 'environment-mutation'
  | 'service-mutation'
  | 'deployment-action'
  | 'destructive-action'
  | 'privileged-host-action'
  | 'secret-bearing-action';

export interface CapabilityAction {
  id: string;
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>;
  permission: CapabilityPermission;
}

/**
 * Capability — an invokable internal or external ability.
 * Brownfield note: the old `type` field ('mcp' | 'direct') is preserved
 * for backward compatibility but is deprecated. New code reads `class`.
 */
export interface Capability {
  id: string;
  name: string;
  /** @deprecated Use `class` instead. Preserved for brownfield migration compatibility. */
  type: 'mcp' | 'direct';
  /** The capability class (filesystem, git, terminal, mcp, etc.) */
  class: CapabilityClass;
  owner: string; // 'builtin', 'mcp:<server-id>', 'connector:<id>'
  description: string;
  scope: string; // plain English explanation of what this capability does
  authMethod: string | null; // 'none', 'api-key', 'oauth', 'ssh-key', 'token'
  actions: CapabilityAction[];
  health: CapabilityHealth;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  auditNotes: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  // ── Deprecated fields preserved for brownfield migration compatibility ──
  /** @deprecated Use `lastFailureAt` instead. */
  lastFailure: string | null;
  /** @deprecated Use `actions` instead. */
  permissions: string[];
}

export interface CapabilityInvocationLog {
  id: string;
  capabilityId: string;
  actionId: string;
  roleSlug: string | null;
  missionId: string | null;
  planStepId: string | null;
  parameters: Record<string, unknown>;
  dryRun: boolean;
  expectedSideEffects: string;
  timestamp: string;
  success: boolean;
  result: string | null;
  latencyMs: number;
  emittedArtifacts: string[];
  error: string | null;
}

// ── MCP Subsystem Types ─────────────────────────────────────────────

export interface McpToolInfo {
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description: string; // plain English: "This server lets the system talk to X and do Y"
  command: string;
  args: string[];
  env: Record<string, string>; // non-secret env vars
  transport: 'stdio' | 'sse' | 'http';
  authMethod: string | null;
  scope: string;
  enabled: boolean;
  projectId: string | null;
  health: CapabilityHealth;
  lastHealthCheckAt: string | null;
  discoveredTools: McpToolInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface McpInvocationResult {
  toolName: string;
  success: boolean;
  result: unknown;
  error: string | null;
  latencyMs: number;
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Incident {
  id: string;
  projectId: string;
  title: string;
  severity: IncidentSeverity;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  detectedAt: string;
  resolvedAt: string | null;
}

export interface DeployCandidate {
  id: string;
  projectId: string;
  environmentId: string;
  commitSha: string;
  version: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled-back';
  deployedAt: string | null;
  deployedBy: string;
}

export type EnvironmentType = 'local' | 'preview' | 'staging' | 'canary' | 'production';

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  type: EnvironmentType;
  currentVersion: string | null;
  secretsComplete: boolean;
  serviceHealth: CapabilityHealth;
  branchMapping: string | null;
}

// ── Component 12: Agent Orchestration and Mode System ─────────────────

/** A single step in a mission plan, produced by the orchestration engine. */
export interface PlanRecord {
  missionId: string;
  missionSummary: string;
  assumptions: string[];
  goals: string[];
  nonGoals: string[];
  affectedSubsystems: string[];
  requiredContext: string[];
  requiredCapabilities: string[];
  riskClasses: string[];
  requiredEvidence: string[];
  steps: PlanStepRecord[];
  approvalBoundaries: string[];
  createdAt: string;
}

/** A single step within a PlanRecord. */
export interface PlanStepRecord {
  id: string;
  order: number;
  title: string;
  description: string;
  assignedRole: string | null;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'blocked' | 'skipped';
  riskLabel: string | null;
  requiresApproval: boolean;
  requiredEvidence: string[];
  expectedOutput: string | null;
  actualOutput: string | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
}

/** A design decision produced by the Architect role. */
export interface DesignDecision {
  id: string;
  missionId: string;
  stepId: string | null;
  title: string;
  description: string;
  alternatives: string[];
  rationale: string;
  tradeOffs: string[];
  createdAt: string;
}

/** A code patch proposal produced by the Coder role. */
export interface CodePatchProposal {
  id: string;
  missionId: string;
  stepId: string | null;
  title: string;
  description: string;
  files: Array<{
    path: string;
    operation: 'create' | 'modify' | 'delete';
    diff: string | null;
    content: string | null;
  }>;
  rationale: string;
  blastRadius: 'low' | 'medium' | 'high';
  verificationRequired: string[];
  createdAt: string;
}

/** A verification result produced by the verification system. */
export interface VerificationResult {
  id: string;
  missionId: string;
  stepId: string | null;
  checkName: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped';
  detail: string | null;
  evidence: string[];
  createdAt: string;
}

/** A role assignment produced by the orchestration engine. */
export interface RoleAssignment {
  id: string;
  missionId: string;
  stepId: string;
  roleSlug: string;
  roleName: string;
  modelId: string;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'escalated';
  assignedAt: string;
  completedAt: string | null;
  error: string | null;
}

/** In-memory state for the orchestration engine. */
export interface OrchestrationState {
  missionId: string | null;
  currentPlan: PlanRecord | null;
  activeStepId: string | null;
  roleAssignments: RoleAssignment[];
  executionProgress: number;
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed';
  error: string | null;
  updatedAt: string;
}

// ── Component 11: Project Intelligence and Context System ─────────────────

/** Overall index of a project's codebase. */
export interface ProjectIndex {
  id: string;
  projectId: string;
  repoRoot: string;
  branch: string | null;
  packageManager: string | null;
  buildCommand: string | null;
  testCommand: string | null;
  lockfiles: string[];
  monorepoPackages: string[];
  generatedDirs: string[];
  protectedPaths: string[];
  indexedAt: string;
  staleness: 'fresh' | 'stale' | 'unknown';
}

/** A single file discovered during indexing. */
export interface FileRecord {
  id: string;
  projectId: string;
  path: string;
  language: string;
  sizeBytes: number;
  isGenerated: boolean;
  isProtected: boolean;
  lastModified: string | null;
  indexedAt: string;
}

/** A symbol (function, class, interface, etc.) extracted from a file. */
export interface SymbolRecord {
  id: string;
  projectId: string;
  fileId: string;
  filePath: string;
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'route' | 'handler' | 'job' | 'schema' | 'module';
  exportType: 'named' | 'default' | 'none';
  lineStart: number | null;
  lineEnd: number | null;
  signature: string | null;
  docComment: string | null;
}

/** An import/export dependency edge between files or symbols. */
export interface ReferenceEdge {
  id: string;
  projectId: string;
  sourceFileId: string;
  targetFileId: string;
  sourceSymbolId: string | null;
  targetSymbolId: string | null;
  referenceType: 'import' | 'export' | 'dynamic-import' | 'require';
}

/** A route discovered from file-based or explicit routing. */
export interface RouteRecord {
  id: string;
  projectId: string;
  fileId: string;
  method: string | null;
  path: string;
  handler: string | null;
  framework: string | null;
}

/** An API endpoint (method + path). */
export interface ApiEndpointRecord {
  id: string;
  projectId: string;
  routeId: string | null;
  method: string;
  path: string;
  authRequired: boolean;
  description: string | null;
}

/** A background job, cron task, or worker. */
export interface JobRecord {
  id: string;
  projectId: string;
  fileId: string;
  name: string;
  schedule: string | null;
  handler: string | null;
  description: string | null;
}

/** A node in the service topology map. */
export interface ServiceNode {
  id: string;
  projectId: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'storage' | 'auth' | 'cdn' | 'email' | 'queue' | 'external-api' | 'deploy-platform' | 'runtime-host';
  url: string | null;
  healthStatus: CapabilityHealth;
  capabilityId: string | null;
  mcpServerId: string | null;
}

/** An edge in the service topology map. */
export interface ServiceEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: 'depends-on' | 'calls' | 'stores-in' | 'authenticates-with' | 'deploys-to';
}

/** A configuration/environment variable discovered in the project. */
export interface ConfigVariableRecord {
  id: string;
  projectId: string;
  name: string;
  sourceFile: string | null;
  defaultValue: string | null;
  isSecret: boolean;
  requiredEnvironments: string[];
  missingEnvironments: string[];
  description: string | null;
}

/** A single item within a context pack. */
export interface ContextItem {
  id: string;
  contextPackId: string;
  type: 'file' | 'symbol' | 'route' | 'api-endpoint' | 'service' | 'config' | 'memory-pack' | 'log' | 'incident' | 'decision';
  referenceId: string;
  title: string;
  summary: string;
  inclusionReason: string;
  source: 'auto' | 'manual' | 'impact-analysis' | 'framework-detection' | 'topology';
  freshness: 'fresh' | 'stale' | 'unknown';
  pinned: boolean;
}

/** A warning about context quality. */
export interface ContextWarning {
  id: string;
  contextPackId: string;
  type: 'stale-index' | 'missing-context' | 'omitted-impact' | 'stale-assumption' | 'token-budget-exceeded';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  suggestedAction: string | null;
}

/** Enriched ContextPack — replaces the flat string-array version. */
export interface ContextPackEnriched {
  id: string;
  missionId: string;
  items: ContextItem[];
  warnings: ContextWarning[];
  tokenUsage: number;
  contextUsage: number;
  createdAt: string;
  updatedAt: string;
}

/** Framework detection result. */
export interface DetectedStack {
  frontend: string[];
  backend: string[];
  database: string[];
  testFramework: string[];
  deployment: string[];
  confidence: number; // 0-1
}

/** Impact analysis result. */
export interface ImpactAnalysis {
  affectedFiles: FileRecord[];
  affectedSymbols: SymbolRecord[];
  affectedRoutes: RouteRecord[];
  affectedServices: ServiceNode[];
  blastRadius: 'low' | 'medium' | 'high' | 'critical';
}

/** Context dashboard summary. */
export interface ContextDashboard {
  packId: string;
  totalItems: number;
  itemsByCategory: Record<string, number>;
  tokenUsage: number;
  contextUsage: number;
  warningCount: number;
  warnings: ContextWarning[];
  missingContext: Array<{ title: string; reason: string }>;
  tokenBudget: number;
  retrievalSource: string;
}

// ── Component 13: Change Engine and Code Operations ─────────────────

/** Tracks an isolated workspace session for safe code changes. */
export interface WorkspaceRun {
  id: string;
  missionId: string;
  planStepId: string;
  projectRoot: string;
  worktreePath: string;
  branchName: string;
  status: 'active' | 'committed' | 'cleaned-up' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

/** A proposed edit to a file within a workspace run. */
export interface PatchProposal {
  id: string;
  workspaceRunId: string;
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  originalContent: string | null;
  newContent: string | null;
  rationale: string;
  createdAt: string;
}

/** A single file modification with before/after content and validity results. */
export interface FileEdit {
  id: string;
  workspaceRunId: string;
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  diff: string;
  validityResults: EvidenceItem[];
  appliedAt: string;
}

/** Grouped changes by meaning rather than file order. */
export interface SemanticChangeGroup {
  id: string;
  workspaceRunId: string;
  label: string; // "UI layout change", "API contract change", etc.
  description: string;
  fileEdits: string[]; // fileEdit IDs
  affectedContracts: string[]; // public API contracts affected
  blastRadius: 'low' | 'medium' | 'high' | 'critical';
}

/** Rollback checkpoint before risky modification. */
export interface Checkpoint {
  id: string;
  workspaceRunId: string;
  label: string;
  gitRef: string; // commit SHA or stash ref
  createdAt: string;
}

/** Logical unit of changes with metadata, ready for review. */
export interface ChangeSet {
  id: string;
  workspaceRunId: string;
  missionId: string;
  planStepId: string;
  summary: string;
  rationale: string;
  fileEdits: FileEdit[];
  semanticGroups: SemanticChangeGroup[];
  affectedContracts: string[];
  blastRadius: 'low' | 'medium' | 'high' | 'critical';
  verificationState: EvidenceItem[];
  rollbackCheckpointId: string | null;
  duplicateWarnings: DuplicateWarning[];
  createdAt: string;
}

/** Detected duplication alert. */
export interface DuplicateWarning {
  id: string;
  workspaceRunId: string;
  filePath: string;
  warning: string;
  existingPattern: string | null; // path to existing similar code
  reuseSuggestion: PatternReuseSuggestion | null;
}

/** Existing pattern that should be reused instead of new code. */
export interface PatternReuseSuggestion {
  existingPath: string;
  existingSymbol: string | null;
  reason: string;
  confidence: number; // 0-1
}
