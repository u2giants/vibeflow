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

// ── SSH Targets ─────────────────────────────────────────────────────

export interface SshTarget {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  hostname: string;
  username: string;
  port: number;
  identityFile: string | null;
  createdAt: string;
}

// ── MCP Connections ──────────────────────────────────────────────────

export interface McpConnection {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  scope: 'global' | 'project';
  createdAt: string;
  updatedAt: string;
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
  // Component 17: environment linkage, evidence, health verdict
  environmentId: string | null;
  evidenceIds: string[];
  healthVerdict: 'healthy' | 'unhealthy' | 'unknown' | null;
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
  | 'schema-safety'
  // Component 15 additions: runtime execution, debugging, and evidence capture
  | 'runtime-log'
  | 'stack-trace'
  | 'network-trace'
  | 'dom-snapshot'
  | 'db-query'
  | 'crash-dump'
  | 'console-log'
  | 'before-after-comparison'
  // Component 21 additions: observability and watch mode
  | 'health-check'
  | 'synthetic-check'
  | 'anomaly-detection'
  | 'watch-summary';

export interface EvidenceItem {
  id: string;
  missionId: string;
  type: EvidenceItemType;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'skipped';
  title: string;
  detail: string | null;
  timestamp: string;
}

// ── Component 15: Runtime Execution, Debugging, and Evidence Capture ─────────────────

/** Tracks a runtime execution session (dev server, build process, etc.). */
export interface RuntimeExecution {
  id: string;
  workspaceRunId: string;
  missionId: string;
  planStepId: string | null;
  command: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
}

/** Tracks a browser automation session. */
export interface BrowserSession {
  id: string;
  workspaceRunId: string;
  missionId: string;
  planStepId: string | null;
  baseUrl: string;
  status: 'starting' | 'running' | 'closed' | 'failed';
  screenshots: string[]; // paths to stored screenshots
  consoleLogs: string;
  networkTraces: string;
  startedAt: string;
  closedAt: string | null;
}

/** Persisted evidence record with full correlation links. */
export interface EvidenceRecord {
  id: string;
  missionId: string;
  workspaceRunId: string;
  planStepId: string | null;
  changesetId: string | null;
  environmentId: string | null;
  capabilityInvocationId: string | null;
  type: EvidenceItemType;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'skipped';
  title: string;
  detail: string | null;
  artifactPath: string | null; // path to stored artifact (screenshot, log file, etc.)
  timestamp: string;
}

/** Before/after comparison result for debugging workflow. */
export interface BeforeAfterComparison {
  id: string;
  missionId: string;
  beforeEvidenceId: string;
  afterEvidenceId: string;
  differenceSummary: string;
  beforeArtifactPath: string | null;
  afterArtifactPath: string | null;
  createdAt: string;
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
  // Component 21 extensions
  environmentId: string | null;
  deployWorkflowId: string | null;
  evidenceIds: string[];
  correlatedChangeIds: string[];
  recommendedAction: string | null;
  selfHealingAttempted: boolean;
  selfHealingResult: string | null;
  watchModeActive: boolean;
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
  // Component 17: evidence linkage, verification, rollback
  evidenceIds: string[];
  verificationRunId: string | null;
  rollbackCheckpointId: string | null;
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
  // Component 17: extended environment fields
  host: string | null;
  deployMechanism: string | null; // 'coolify', 'github-actions', 'manual'
  requiredSecrets: string[];
  linkedServiceIds: string[];
  healthEndpoint: string | null;
  protections: EnvironmentProtection[];
  rollbackMethod: string | null;
  mutabilityRules: MutabilityRule[];
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

// ── Component 19: Approval, Risk, Audit, and Rollback ─────────────────

/** Risk classification for an action. */
export type RiskClass =
  | 'informational'
  | 'low'
  | 'medium'
  | 'high'
  | 'destructive'
  | 'privileged-production';

/** A single dimension of risk scoring. */
export interface RiskDimension {
  dimension: string;
  score: number;
  maxScore: number;
  explanation: string;
}

/** Overall risk assessment for an action. */
export interface RiskAssessment {
  riskClass: RiskClass;
  overallScore: number; // 0-100
  dimensions: RiskDimension[];
  evidenceCompleteness: 'complete' | 'partial' | 'missing';
  reversibility: 'reversible' | 'partially-reversible' | 'irreversible';
}

/** A single entry in the approval chain. */
export interface ApprovalChainEntry {
  tier: number;
  reviewerModel: string | null;
  reviewerRole: string | null;
  decision: string;
  reason: string;
  decidedAt: string;
}

/** Rollback plan for a risky action. */
export interface RollbackPlan {
  targetState: string;
  reversibleChanges: string[];
  irreversibleChanges: string[];
  environment: string;
  dataCaveats: string[];
  estimatedDowntime: string | null;
  requiredApprovals: string[];
  checkpointId: string;
}

/** Full audit record for an action. */
export interface AuditRecord {
  id: string;
  missionId: string | null;
  planStepId: string | null;
  roleSlug: string | null;
  capabilityId: string | null;
  actionType: string;
  parameters: Record<string, unknown>;
  environment: string | null;
  riskAssessment: RiskAssessment;
  evidenceSummary: string | null;
  approvalChain: ApprovalChainEntry[];
  result: 'approved' | 'rejected' | 'escalated' | 'rolled-back';
  checkpointId: string | null;
  rollbackPlan: RollbackPlan | null;
  initiatedBy: string;
  initiatedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

// ── Component 16: Verification and Acceptance System ─────────────────

/** A single verification check within a verification run. */
export interface VerificationCheck {
  id: string;
  verificationRunId: string;
  layer: 'instant-validity' | 'impacted-tests' | 'acceptance-flow' | 'policy-safety' | 'deploy-specific';
  checkName: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped' | 'running';
  detail: string | null;
  evidenceItemIds: string[]; // links to EvidenceRecord IDs
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

/** A full verification run — the primary output of the verification engine. */
export interface VerificationRun {
  id: string;
  missionId: string;
  workspaceRunId: string | null;
  changesetId: string | null;
  candidateId: string | null;
  bundleId: string; // which verification bundle was used
  overallStatus: 'pass' | 'fail' | 'blocked' | 'running';
  checks: VerificationCheck[];
  missingRequiredChecks: string[];
  flakeSuspicions: string[]; // check IDs that may be flaky
  riskImpact: 'low' | 'medium' | 'high' | 'critical';
  startedAt: string;
  completedAt: string | null;
  verdict: 'promote' | 'block' | 'needs-review' | null;
  verdictReason: string | null;
}

/** A verification bundle — a named set of required checks for a risk class. */
export interface VerificationBundle {
  id: string;
  name: string;
  riskClass: 'low' | 'medium' | 'high' | 'destructive';
  requiredLayers: Array<'instant-validity' | 'impacted-tests' | 'acceptance-flow' | 'policy-safety' | 'deploy-specific'>;
  description: string;
}

/** Acceptance criteria for a mission — derived before work begins. */
export interface AcceptanceCriteria {
  id: string;
  missionId: string;
  intendedBehavior: string[];
  nonGoals: string[];
  pathsThatMustStillWork: string[];
  comparisonTargets: string[]; // screenshot paths, state identifiers
  regressionThresholds: string[];
  rollbackConditions: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Component 18: Secrets, Configuration, Database, and Migration Safety ──────────

/** A structured record of a secret or config variable — metadata only, no values. */
export interface SecretRecord {
  id: string;
  projectId: string;
  keyName: string;
  category: string; // 'database', 'api-key', 'oauth', 'smtp', 'storage', 'auth', 'custom'
  description: string;
  requiredEnvironments: string[]; // environment IDs
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  sourceOfTruth: string; // e.g., 'Supabase dashboard', 'Coolify settings', 'operator-provided'
  rotationNotes: string;
  approvalRulesForChanges: string;
  codeReferences: string[]; // file paths that reference this secret
  storedInKeytar: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Risk classification for database migrations. */
export type MigrationRiskClass =
  | 'additive-safe'
  | 'backfill-required'
  | 'index-performance'
  | 'destructive-schema'
  | 'data-rewrite'
  | 'auth-identity';

/** A safeguard that must be satisfied before a migration can proceed. */
export interface MigrationSafeguard {
  type: string;
  description: string;
  required: boolean;
  satisfied: boolean;
}

/** A planned migration — not an execution record. */
export interface MigrationPlan {
  id: string;
  projectId: string;
  missionId: string | null;
  riskClass: MigrationRiskClass;
  description: string;
  affectedTables: string[];
  estimatedBlastRadius: 'low' | 'medium' | 'high' | 'critical';
  forwardCompatible: boolean;
  backwardCompatible: boolean;
  requiresCheckpoint: boolean;
  checkpointId: string | null;
  safeguards: MigrationSafeguard[];
  orderingRequirement: 'app-first' | 'schema-first' | 'simultaneous';
  approvalRequired: boolean;
  rollbackConstraints: string;
  status: 'draft' | 'previewed' | 'approved' | 'executed' | 'rolled-back' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

/** A preview of what a migration will do — generated before execution. */
export interface MigrationPreview {
  planId: string;
  sqlPreview: string;
  affectedEntities: string[];
  destructiveOperations: string[];
  estimatedDowntime: string | null;
  warnings: string[];
}

/** Information about the project's database schema. */
export interface DatabaseSchemaInfo {
  projectId: string;
  engine: string; // 'postgresql', 'sqlite', 'mysql'
  schemaSourceFiles: string[]; // paths to .sql files
  migrationHistory: Array<{ id: string; name: string; appliedAt: string; riskClass: MigrationRiskClass }>;
  tables: Array<{ name: string; columnCount: number; rowCountEstimate: number | null; isProtected: boolean }>;
  relationships: Array<{ fromTable: string; toTable: string; type: string }>;
  protectedEntities: string[];
  highRiskDomains: string[];
}

/** A historical record of a migration that was applied. */
export interface MigrationHistoryEntry {
  id: string;
  projectId: string;
  planId: string;
  migrationName: string;
  riskClass: MigrationRiskClass;
  appliedAt: string;
  appliedBy: string;
  success: boolean;
  error: string | null;
  rollbackExecuted: boolean;
}

// ── Component 17: Environments, Deployments, and Service Control Plane ──

/** Protection rules for an environment. */
export type EnvironmentProtection =
  | 'require-approval'
  | 'require-evidence'
  | 'require-rollback-plan'
  | 'require-service-dependency-check'
  | 'require-incident-watch';

/** Who can mutate an environment and under what conditions. */
export interface MutabilityRule {
  role: string;
  conditions: string[];
  requiresApproval: boolean;
}

/** A single step within a deploy workflow. */
export interface DeployStep {
  order: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  detail: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** A deploy workflow tracking the 10-step deployment process. */
export interface DeployWorkflow {
  id: string;
  candidateId: string;
  environmentId: string;
  steps: DeployStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled-back';
  verdict: 'promote' | 'block' | 'needs-review' | null;
  verdictReason: string | null;
  evidenceIds: string[];
  startedAt: string;
  completedAt: string | null;
  rollbackOffered: boolean;
}

/** A drift report detecting mismatches between expected and actual environment state. */
export interface DriftReport {
  id: string;
  projectId: string;
  environmentId: string;
  driftType: 'missing-secret' | 'version-mismatch' | 'config-drift' | 'manual-change' | 'schema-mismatch' | 'auth-drift';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  detectedAt: string;
  resolved: boolean;
}

/** Service control plane — topology with environment linkage. */
export interface ServiceControlPlane {
  projectId: string;
  services: ServiceNode[];
  edges: ServiceEdge[];
  environmentMappings: Record<string, string[]>; // envId -> serviceIds
  updatedAt: string;
}

// ── Component 21: Observability, Incident Response, and Self-Healing ──

/** Individual probe within a watch session. */
export interface WatchProbe {
  id: string;
  watchSessionId: string;
  type: 'health-check' | 'synthetic-check' | 'drift-check' | 'evidence-check';
  url: string | null; // for health-check probes
  description: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warning' | 'disabled';
  lastResult: string | null;
  lastCheckedAt: string | null;
  failureCount: number;
  disabled: boolean;
}

/** Watch session — created automatically after a protected deploy. */
export interface WatchSession {
  id: string;
  projectId: string;
  environmentId: string;
  deployWorkflowId: string;
  status: 'active' | 'completed' | 'escalated' | 'dismissed';
  startedAt: string;
  completedAt: string | null;
  elevatedEvidence: boolean;
  anomalyThreshold: 'normal' | 'elevated' | 'critical';
  probes: WatchProbe[];
  regressionBaseline: string | null; // evidence ID of pre-deploy stable state
}

/** Anomaly event — detected deviation from expected state. */
export interface AnomalyEvent {
  id: string;
  projectId: string;
  environmentId: string;
  watchSessionId: string | null;
  anomalyType: 'health-degradation' | 'error-rate-spike' | 'latency-spike' | 'drift-detected' | 'synthetic-failure' | 'evidence-gap';
  severity: IncidentSeverity;
  description: string;
  correlatedDeployWorkflowId: string | null;
  correlatedChangeIds: string[];
  evidenceIds: string[];
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

/** Self-healing action record. */
export interface SelfHealingAction {
  id: string;
  projectId: string;
  environmentId: string;
  anomalyEventId: string | null;
  incidentId: string | null;
  actionType: 'restart-preview' | 'rerun-checks' | 'disable-probe' | 'notify-and-prepare-rollback' | 'rollback';
  automatic: boolean; // true = system-initiated, false = human-initiated
  status: 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'blocked';
  approvalRequired: boolean;
  approvalResult: string | null;
  result: string | null;
  executedAt: string | null;
  auditRecordId: string | null;
}

/** Watch dashboard summary. */
export interface WatchDashboard {
  activeSessions: WatchSession[];
  recentAnomalies: AnomalyEvent[];
  openIncidents: Incident[];
  recentSelfHealingActions: SelfHealingAction[];
  environmentHealth: Record<string, CapabilityHealth>; // envId -> health
}

// ── Component 20: Memory, Skills, and Decision Knowledge ──

/** Categories of memory items. */
export type MemoryCategory =
  | 'prior-fix'
  | 'architecture-rule'
  | 'deployment-rule'
  | 'auth-identity'
  | 'provider-gotcha'
  | 'style-pattern'
  | 'incident-postmortem'
  | 'idiosyncrasy'
  | 'fragile-area'
  | 'coding-standard'
  | 'release-rule'
  | 'skill-runbook';

/** A single revision entry in a memory item's history. */
export interface MemoryRevision {
  revisionNumber: number;
  changedAt: string;
  changedBy: string; // Mode slug or 'operator'
  changeSummary: string;
  conversationId: string | null;
}

/** A single memory item — a unit of retained project intelligence. */
export interface MemoryItem {
  id: string;
  projectId: string;
  category: MemoryCategory;
  title: string;
  scope: string; // plain English: what subsystem / area this covers
  tags: string[]; // for trigger matching
  description: string; // structured facts
  freeFormNotes: string | null;
  examples: string[]; // concrete examples of the memory in action
  triggerConditions: string[]; // when this memory should be loaded
  freshnessNotes: string | null; // staleness indicator
  sourceMaterial: string | null; // where this came from (conversation ID, handoff, manual)
  owner: string | null; // Mode slug or 'operator'
  reviewer: string | null; // who last reviewed
  lastReviewedAt: string | null;
  revisionHistory: MemoryRevision[];
  isActive: boolean; // false = retired
  createdAt: string;
  updatedAt: string;
}

/** A single step within a skill runbook. */
export interface SkillStep {
  order: number;
  instruction: string;
  checkCondition: string | null; // optional guard
  fallbackAction: string | null;
}

/** A version history entry for a skill. */
export interface SkillVersionEntry {
  version: number;
  changedAt: string;
  changedBy: string;
  changeSummary: string;
}

/** A skill — an executable runbook or structured procedure. */
export interface Skill {
  id: string;
  projectId: string;
  title: string;
  description: string; // plain English explanation
  category: MemoryCategory; // typically 'skill-runbook'
  steps: SkillStep[];
  triggerConditions: string[]; // when this skill should be suggested
  version: number;
  versionHistory: SkillVersionEntry[];
  owner: string | null;
  reviewer: string | null;
  lastReviewedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A retained decision — the structured, queryable version of docs/decisions.md entries. */
export interface DecisionRecord {
  id: string;
  projectId: string;
  decisionNumber: number; // maps to "Decision N" in docs/decisions.md
  title: string;
  date: string;
  decidedBy: string; // e.g., "Orchestrator + Albert"
  decision: string; // what was decided
  alternativesConsidered: Array<{ option: string; reason: string }>;
  rationale: string;
  consequences: string[];
  relatedFiles: string[]; // file paths referenced
  tags: string[];
  isActive: boolean; // false = superseded
  supersededBy: string | null; // ID of the decision that replaced this
  createdAt: string;
  updatedAt: string;
}

/** Result of a memory retrieval query. */
export interface MemoryRetrievalResult {
  items: MemoryItem[];
  skills: Skill[];
  decisions: DecisionRecord[];
  retrievalReason: string; // why these were returned
  triggerMatch: string; // what triggered the retrieval
  totalTokenEstimate: number; // rough token count for injection
}

/** Memory lifecycle state for batch operations. */
export type MemoryLifecycleAction = 'write' | 'evict' | 'summarize' | 'retire' | 'reactivate';

/** Memory dashboard summary. */
export interface MemoryDashboard {
  totalMemories: number;
  memoriesByCategory: Record<string, number>;
  activeMemories: number;
  retiredMemories: number;
  staleMemories: number; // not reviewed in >30 days
  totalSkills: number;
  activeSkills: number;
  totalDecisions: number;
  activeDecisions: number;
  lastWriteAt: string | null;
  lastReviewAt: string | null;
}
