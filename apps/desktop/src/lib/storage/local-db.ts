/** Local SQLite cache using sql.js (pure JavaScript, no native compilation needed). */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const initSqlJs = require('sql.js') as (opts?: { locateFile?: (f: string) => string }) => Promise<any>;
import * as path from 'path';
import * as fs from 'fs';
import type {
  Mode, ApprovalPolicy, ConversationThread, Message, RunState,
  ProjectDevOpsConfig, DeployRun,
  Mission, MissionStatus,
  Plan, PlanStep,
  EvidenceItem, EvidenceItemType,
  Capability, CapabilityHealth, CapabilityClass, CapabilityPermission, CapabilityAction, CapabilityInvocationLog,
  Incident, IncidentSeverity,
  DeployCandidate,
  Environment, EnvironmentType, EnvironmentProtection, MutabilityRule,
  McpServerConfig, McpToolInfo,
  SshTarget, McpConnection,
  ProjectIndex, FileRecord, SymbolRecord, ReferenceEdge, RouteRecord, ApiEndpointRecord, JobRecord,
  ServiceNode, ServiceEdge, ConfigVariableRecord,
  ContextPackEnriched, ContextItem, ContextWarning,
  WorkspaceRun, FileEdit, SemanticChangeGroup, Checkpoint, ChangeSet, DuplicateWarning, PatternReuseSuggestion,
  AuditRecord, RiskClass,
  RuntimeExecution, BrowserSession, EvidenceRecord,
  VerificationRun, VerificationCheck, VerificationBundle, AcceptanceCriteria,
  SecretRecord, MigrationPlan, MigrationRiskClass, MigrationPreview, DatabaseSchemaInfo, MigrationHistoryEntry,
  DeployWorkflow, DeployStep, DriftReport,
  WatchSession, WatchProbe, AnomalyEvent, SelfHealingAction,
  MemoryItem, MemoryCategory, MemoryRevision, Skill, SkillStep, SkillVersionEntry, DecisionRecord,
  MissionLifecycleState, MissionLifecycleStatus,
  ProjectConfig,
} from '../shared-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlJsDb = any;

// Minimal Project type (mirrors shared-types)
interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isSelfMaintenance: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  setupComplete?: boolean;
}

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_self_maintenance: number;
  setup_complete: number | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

interface ModeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  soul: string;
  model_id: string;
  fallback_model_id: string | null;
  temperature: number;
  approval_policy: string;
  is_built_in: number;
  created_at: string;
  updated_at: string;
}

interface ConversationRow {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  run_state: string;
  owner_device_id: string | null;
  owner_device_name: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  mode_id: string | null;
  model_id: string | null;
  created_at: string;
}

export class LocalDb {
  private db: SqlJsDb | null = null;
  private dbPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqlJsModule: any | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /** Initialize the database and create the schema if it doesn't exist. */
  async init(): Promise<void> {
    // Ensure the directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize sql.js — locate the .wasm file correctly in both dev and packaged builds.
    // In dev:       __dirname = apps/desktop/out/main  → 4 levels up = repo root
    // In packaged:  __dirname = …/app.asar/out/main   → 2 levels up = asar root (node_modules lives there)
    const isPackaged = __dirname.includes('app.asar');
    const wasmRoot = isPackaged
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(__dirname, '..', '..', '..', '..');
    this.sqlJsModule = await initSqlJs({
      locateFile: (file: string) => path.join(wasmRoot, 'node_modules', 'sql.js', 'dist', file),
    });

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.sqlJsModule.Database(buffer);
    } else {
      this.db = new this.sqlJsModule.Database();
    }

    this.initializeSchema();
    this.save();
  }

  private save(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  private initializeSchema(): void {
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_self_maintenance INTEGER DEFAULT 0,
        setup_complete INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS modes (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        soul TEXT NOT NULL,
        model_id TEXT NOT NULL,
        fallback_model_id TEXT,
        temperature REAL NOT NULL DEFAULT 0.7,
        approval_policy TEXT NOT NULL DEFAULT 'second-model',
        is_built_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT DEFAULT '',
        title TEXT NOT NULL,
        run_state TEXT NOT NULL DEFAULT 'idle',
        owner_device_id TEXT,
        owner_device_name TEXT,
        lease_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        mode_id TEXT,
        model_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_devops_configs (
        project_id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        github_owner TEXT NOT NULL DEFAULT '',
        github_repo TEXT NOT NULL DEFAULT '',
        coolify_app_id TEXT NOT NULL DEFAULT '',
        coolify_base_url TEXT NOT NULL DEFAULT '',
        image_name TEXT NOT NULL DEFAULT '',
        health_check_url TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deploy_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        commit_sha TEXT,
        triggered_by TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error TEXT
      );

      /* ── Component 22: New domain tables ── */

      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        operator_request TEXT NOT NULL DEFAULT '',
        clarified_constraints_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        owner TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plans (
        mission_id TEXT PRIMARY KEY,
        steps_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evidence_items (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        title TEXT NOT NULL,
        detail TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS capabilities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'direct',
        health TEXT NOT NULL DEFAULT 'unknown',
        last_failure TEXT,
        permissions_json TEXT NOT NULL DEFAULT '[]',
        /* ── Component 14: brownfield migration columns ── */
        class TEXT,
        owner TEXT,
        description TEXT DEFAULT '',
        scope TEXT DEFAULT '',
        auth_method TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_success_at TEXT,
        last_failure_at TEXT,
        last_failure_reason TEXT,
        audit_notes TEXT DEFAULT '',
        project_id TEXT,
        actions_json TEXT DEFAULT '[]',
        created_at TEXT,
        updated_at TEXT
      );

      /* ── Component 14: MCP server configurations ── */
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        command TEXT NOT NULL,
        args_json TEXT NOT NULL,
        env_json TEXT,
        transport TEXT NOT NULL,
        auth_method TEXT,
        scope TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        project_id TEXT,
        health TEXT NOT NULL DEFAULT 'unknown',
        last_health_check_at TEXT,
        discovered_tools_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      /* ── Component 14: Capability invocation log ── */
      CREATE TABLE IF NOT EXISTS capability_invocations (
        id TEXT PRIMARY KEY,
        capability_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        role_slug TEXT,
        mission_id TEXT,
        plan_step_id TEXT,
        parameters_json TEXT,
        dry_run INTEGER NOT NULL DEFAULT 0,
        expected_side_effects TEXT,
        timestamp TEXT NOT NULL,
        success INTEGER NOT NULL,
        result TEXT,
        latency_ms INTEGER,
        artifacts_json TEXT,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'low',
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        detected_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS deploy_candidates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        commit_sha TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        deployed_at TEXT,
        deployed_by TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'local',
        current_version TEXT,
        secrets_complete INTEGER DEFAULT 0,
        service_health TEXT NOT NULL DEFAULT 'unknown',
        branch_mapping TEXT
      );

      /* ── Component 11: Project Intelligence tables ── */

      CREATE TABLE IF NOT EXISTS project_indexes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        repo_root TEXT NOT NULL,
        branch TEXT,
        package_manager TEXT,
        build_command TEXT,
        test_command TEXT,
        lockfiles_json TEXT DEFAULT '[]',
        monorepo_packages_json TEXT DEFAULT '[]',
        generated_dirs_json TEXT DEFAULT '[]',
        protected_paths_json TEXT DEFAULT '[]',
        indexed_at TEXT NOT NULL,
        staleness TEXT NOT NULL DEFAULT 'unknown'
      );

      CREATE TABLE IF NOT EXISTS file_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        language TEXT NOT NULL,
        size_bytes INTEGER,
        is_generated INTEGER DEFAULT 0,
        is_protected INTEGER DEFAULT 0,
        last_modified TEXT,
        indexed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS symbol_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        export_type TEXT NOT NULL DEFAULT 'none',
        line_start INTEGER,
        line_end INTEGER,
        signature TEXT,
        doc_comment TEXT
      );

      CREATE TABLE IF NOT EXISTS reference_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_file_id TEXT NOT NULL,
        target_file_id TEXT NOT NULL,
        source_symbol_id TEXT,
        target_symbol_id TEXT,
        reference_type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS route_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        method TEXT,
        path TEXT NOT NULL,
        handler TEXT,
        framework TEXT
      );

      CREATE TABLE IF NOT EXISTS api_endpoint_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        route_id TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        auth_required INTEGER DEFAULT 0,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS job_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        name TEXT NOT NULL,
        schedule TEXT,
        handler TEXT,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS service_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT,
        health_status TEXT NOT NULL DEFAULT 'unknown',
        capability_id TEXT,
        mcp_server_id TEXT
      );

      CREATE TABLE IF NOT EXISTS service_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relationship TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS config_variable_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        source_file TEXT,
        default_value TEXT,
        is_secret INTEGER DEFAULT 0,
        required_environments_json TEXT DEFAULT '[]',
        missing_environments_json TEXT DEFAULT '[]',
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS context_packs (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        items_json TEXT NOT NULL DEFAULT '[]',
        warnings_json TEXT NOT NULL DEFAULT '[]',
        token_usage INTEGER DEFAULT 0,
        context_usage INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      /* ── Component 13: Change Engine tables ── */

      CREATE TABLE IF NOT EXISTS workspace_runs (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        plan_step_id TEXT NOT NULL,
        project_root TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS file_edits (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        operation TEXT NOT NULL,
        diff TEXT NOT NULL,
        validity_results_json TEXT NOT NULL DEFAULT '[]',
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        label TEXT NOT NULL,
        git_ref TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS semantic_change_groups (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        file_edits_json TEXT NOT NULL DEFAULT '[]',
        affected_contracts_json TEXT NOT NULL DEFAULT '[]',
        blast_radius TEXT NOT NULL DEFAULT 'low'
      );

      CREATE TABLE IF NOT EXISTS change_sets (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        plan_step_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        rationale TEXT NOT NULL,
        file_edits_json TEXT NOT NULL DEFAULT '[]',
        semantic_groups_json TEXT NOT NULL DEFAULT '[]',
        affected_contracts_json TEXT NOT NULL DEFAULT '[]',
        blast_radius TEXT NOT NULL DEFAULT 'low',
        verification_state_json TEXT NOT NULL DEFAULT '[]',
        rollback_checkpoint_id TEXT,
        duplicate_warnings_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS duplicate_warnings (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        warning TEXT NOT NULL,
        existing_pattern TEXT,
        reuse_suggestion_json TEXT
      );

      /* ── Component 19: Audit records table ── */
      CREATE TABLE IF NOT EXISTS audit_records (
        id TEXT PRIMARY KEY,
        mission_id TEXT,
        plan_step_id TEXT,
        role_slug TEXT,
        capability_id TEXT,
        action_type TEXT NOT NULL,
        parameters_json TEXT NOT NULL DEFAULT '{}',
        environment TEXT,
        risk_class TEXT NOT NULL,
        risk_score INTEGER NOT NULL DEFAULT 0,
        risk_dimensions_json TEXT NOT NULL DEFAULT '[]',
        evidence_completeness TEXT NOT NULL DEFAULT 'missing',
        reversibility TEXT NOT NULL DEFAULT 'reversible',
        evidence_summary TEXT,
        approval_chain_json TEXT NOT NULL DEFAULT '[]',
        result TEXT NOT NULL,
        checkpoint_id TEXT,
        rollback_plan_json TEXT,
        initiated_by TEXT NOT NULL DEFAULT 'system',
        initiated_at TEXT NOT NULL,
        completed_at TEXT,
        duration_ms INTEGER
      );

      /* ── Component 15: Runtime Execution, Browser Automation, Evidence Capture ── */

      CREATE TABLE IF NOT EXISTS runtime_executions (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        plan_step_id TEXT,
        command TEXT NOT NULL,
        cwd TEXT NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        duration_ms INTEGER,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS browser_sessions (
        id TEXT PRIMARY KEY,
        workspace_run_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        plan_step_id TEXT,
        base_url TEXT NOT NULL,
        status TEXT NOT NULL,
        screenshots_json TEXT DEFAULT '[]',
        console_logs TEXT,
        network_traces TEXT,
        started_at TEXT NOT NULL,
        closed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS evidence_records (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        workspace_run_id TEXT NOT NULL,
        plan_step_id TEXT,
        changeset_id TEXT,
        environment_id TEXT,
        capability_invocation_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        artifact_path TEXT,
        timestamp TEXT NOT NULL
      );

      /* ── Component 16: Verification and Acceptance System ── */

      CREATE TABLE IF NOT EXISTS verification_runs (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        workspace_run_id TEXT,
        changeset_id TEXT,
        candidate_id TEXT,
        bundle_id TEXT NOT NULL,
        overall_status TEXT NOT NULL DEFAULT 'running',
        checks_json TEXT NOT NULL DEFAULT '[]',
        missing_required_checks_json TEXT NOT NULL DEFAULT '[]',
        flake_suspicions_json TEXT NOT NULL DEFAULT '[]',
        risk_impact TEXT NOT NULL DEFAULT 'low',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        verdict TEXT,
        verdict_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS verification_checks (
        id TEXT PRIMARY KEY,
        verification_run_id TEXT NOT NULL,
        layer TEXT NOT NULL,
        check_name TEXT NOT NULL,
        status TEXT NOT NULL,
        detail TEXT,
        evidence_item_ids_json TEXT NOT NULL DEFAULT '[]',
        duration_ms INTEGER,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS verification_bundles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        risk_class TEXT NOT NULL,
        required_layers_json TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acceptance_criteria (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL UNIQUE,
        intended_behavior_json TEXT NOT NULL DEFAULT '[]',
        non_goals_json TEXT NOT NULL DEFAULT '[]',
        paths_that_must_still_work_json TEXT NOT NULL DEFAULT '[]',
        comparison_targets_json TEXT NOT NULL DEFAULT '[]',
        regression_thresholds_json TEXT NOT NULL DEFAULT '[]',
        rollback_conditions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      /* ── Component 18: Secrets, Configuration, Database, and Migration Safety ── */

      CREATE TABLE IF NOT EXISTS secret_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        key_name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        required_environments_json TEXT NOT NULL DEFAULT '[]',
        sensitivity_level TEXT NOT NULL DEFAULT 'internal',
        source_of_truth TEXT NOT NULL DEFAULT '',
        rotation_notes TEXT DEFAULT '',
        approval_rules TEXT DEFAULT '',
        code_references_json TEXT NOT NULL DEFAULT '[]',
        stored_in_keytar INTEGER NOT NULL DEFAULT 0,
        last_verified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS migration_plans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        mission_id TEXT,
        risk_class TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_tables_json TEXT NOT NULL DEFAULT '[]',
        estimated_blast_radius TEXT NOT NULL DEFAULT 'low',
        forward_compatible INTEGER NOT NULL DEFAULT 1,
        backward_compatible INTEGER NOT NULL DEFAULT 1,
        requires_checkpoint INTEGER NOT NULL DEFAULT 0,
        checkpoint_id TEXT,
        safeguards_json TEXT NOT NULL DEFAULT '[]',
        ordering_requirement TEXT NOT NULL DEFAULT 'schema-first',
        approval_required INTEGER NOT NULL DEFAULT 0,
        rollback_constraints TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS migration_history (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        migration_name TEXT NOT NULL,
        risk_class TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        applied_by TEXT NOT NULL DEFAULT 'system',
        success INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        rollback_executed INTEGER NOT NULL DEFAULT 0
      );

      /* ── Component 17: Deploy Workflows and Drift Reports ── */

      CREATE TABLE IF NOT EXISTS deploy_workflows (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        steps_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        verdict TEXT,
        verdict_reason TEXT,
        evidence_ids_json TEXT DEFAULT '[]',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        rollback_offered INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS drift_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        drift_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        resolved INTEGER DEFAULT 0
      );

      /* ── Component 21: Watch sessions, anomaly events, self-healing actions ── */

      CREATE TABLE IF NOT EXISTS watch_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        deploy_workflow_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        elevated_evidence INTEGER DEFAULT 1,
        anomaly_threshold TEXT NOT NULL DEFAULT 'elevated',
        regression_baseline TEXT,
        probes_json TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS anomaly_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        watch_session_id TEXT,
        anomaly_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        correlated_deploy_workflow_id TEXT,
        correlated_change_ids_json TEXT DEFAULT '[]',
        evidence_ids_json TEXT DEFAULT '[]',
        detected_at TEXT NOT NULL,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_at TEXT,
        acknowledged_by TEXT
      );

      CREATE TABLE IF NOT EXISTS self_healing_actions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        anomaly_event_id TEXT,
        incident_id TEXT,
        action_type TEXT NOT NULL,
        automatic INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        approval_required INTEGER DEFAULT 0,
        approval_result TEXT,
        result TEXT,
        executed_at TEXT,
        audit_record_id TEXT
      );

      /* ── Component 20: Memory, Skills, and Decision Knowledge ── */

      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL DEFAULT '',
        free_form_notes TEXT,
        examples_json TEXT NOT NULL DEFAULT '[]',
        trigger_conditions_json TEXT NOT NULL DEFAULT '[]',
        freshness_notes TEXT,
        source_material TEXT,
        owner TEXT,
        reviewer TEXT,
        last_reviewed_at TEXT,
        revision_history_json TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'skill-runbook',
        steps_json TEXT NOT NULL DEFAULT '[]',
        trigger_conditions_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        version_history_json TEXT NOT NULL DEFAULT '[]',
        owner TEXT,
        reviewer TEXT,
        last_reviewed_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decision_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        decision_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        decided_by TEXT NOT NULL DEFAULT '',
        decision TEXT NOT NULL DEFAULT '',
        alternatives_json TEXT NOT NULL DEFAULT '[]',
        rationale TEXT NOT NULL DEFAULT '',
        consequences_json TEXT NOT NULL DEFAULT '[]',
        related_files_json TEXT NOT NULL DEFAULT '[]',
        tags_json TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        superseded_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- ── SSH Targets (from remote merge) ──
      CREATE TABLE IF NOT EXISTS ssh_targets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        username TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        identity_file TEXT,
        created_at TEXT NOT NULL
      );

      -- ── MCP Connections (from remote merge) ──
      CREATE TABLE IF NOT EXISTS mcp_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        args TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 1,
        scope TEXT NOT NULL DEFAULT 'global',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- ── Mission Lifecycle State (Phase 1 wiring) ──
      CREATE TABLE IF NOT EXISTS mission_lifecycle_state (
        mission_id TEXT PRIMARY KEY,
        current_step INTEGER DEFAULT 1,
        lifecycle_status TEXT NOT NULL DEFAULT 'idle',
        risk_assessment_json TEXT,
        workspace_run_id TEXT,
        verification_run_id TEXT,
        deploy_workflow_id TEXT,
        watch_session_id TEXT,
        updated_at TEXT NOT NULL
      );

      -- ── New Project Wizard: project config ──
      CREATE TABLE IF NOT EXISTS project_config (
        project_id TEXT PRIMARY KEY,
        repo_url TEXT,
        local_folder_path TEXT,
        coolify_base_url TEXT,
        coolify_app_id TEXT,
        supabase_project_url TEXT,
        supabase_project_ref TEXT,
        supabase_anon_key TEXT,
        railway_project_id TEXT,
        railway_service_id TEXT,
        cloudflare_account_id TEXT,
        cloudflare_zone_id TEXT,
        google_oauth_client_id TEXT,
        azure_oauth_client_id TEXT,
        azure_oauth_tenant_id TEXT,
        enabled_integrations_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      -- ── DevOps Templates (from remote merge) ──
      CREATE TABLE IF NOT EXISTS devops_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        branch_strategy TEXT NOT NULL DEFAULT '',
        build_tool TEXT NOT NULL DEFAULT '',
        registry TEXT NOT NULL DEFAULT '',
        image_name TEXT NOT NULL DEFAULT '',
        image_tags TEXT NOT NULL DEFAULT '[]',
        deploy_target_type TEXT NOT NULL DEFAULT '',
        trigger_method TEXT NOT NULL DEFAULT '',
        required_secrets TEXT NOT NULL DEFAULT '[]',
        plain_english_explanation TEXT NOT NULL DEFAULT '',
        is_built_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `;

    // Execute each CREATE TABLE statement individually for better error isolation
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/);
      const tableName = tableMatch ? tableMatch[1] : 'unknown';
      try {
        this.db!.run(stmt);
      } catch (err) {
        console.error(`[local-db] Schema init failed for table "${tableName}":`, err);
      }
    }

    // ── Component 17: Brownfield migration for environments table ──
    // Add new columns to existing environments table (safe to run multiple times via try/catch)
    const envColumns = [
      { name: 'host', sql: 'TEXT' },
      { name: 'deploy_mechanism', sql: 'TEXT' },
      { name: 'required_secrets_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'linked_service_ids_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'health_endpoint', sql: 'TEXT' },
      { name: 'protections_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'rollback_method', sql: 'TEXT' },
      { name: 'mutability_rules_json', sql: "TEXT DEFAULT '[]'" },
    ];
    for (const col of envColumns) {
      try {
        this.db!.run(`ALTER TABLE environments ADD COLUMN ${col.name} ${col.sql}`);
      } catch {
        // Column already exists — safe to skip
      }
    }

    // ── Component 17: Brownfield migration for deploy_candidates table ──
    const dcColumns = [
      { name: 'evidence_ids_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'verification_run_id', sql: 'TEXT' },
      { name: 'rollback_checkpoint_id', sql: 'TEXT' },
    ];
    for (const col of dcColumns) {
      try {
        this.db!.run(`ALTER TABLE deploy_candidates ADD COLUMN ${col.name} ${col.sql}`);
      } catch {
        // Column already exists — safe to skip
      }
    }

    // ── Component 17: Brownfield migration for deploy_runs table ──
    const drColumns = [
      { name: 'environment_id', sql: 'TEXT' },
      { name: 'evidence_ids_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'health_verdict', sql: 'TEXT' },
    ];
    for (const col of drColumns) {
      try {
        this.db!.run(`ALTER TABLE deploy_runs ADD COLUMN ${col.name} ${col.sql}`);
      } catch {
        // Column already exists — safe to skip
      }
    }

    // ── Component 21: Brownfield migration for incidents table ──
    const incidentColumns = [
      { name: 'environment_id', sql: 'TEXT' },
      { name: 'deploy_workflow_id', sql: 'TEXT' },
      { name: 'evidence_ids_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'correlated_change_ids_json', sql: "TEXT DEFAULT '[]'" },
      { name: 'recommended_action', sql: 'TEXT' },
      { name: 'self_healing_attempted', sql: 'INTEGER DEFAULT 0' },
      { name: 'self_healing_result', sql: 'TEXT' },
      { name: 'watch_mode_active', sql: 'INTEGER DEFAULT 0' },
    ];
    for (const col of incidentColumns) {
      try {
        this.db!.run(`ALTER TABLE incidents ADD COLUMN ${col.name} ${col.sql}`);
      } catch {
        // Column already exists — safe to skip
      }
    }

    // ── New Project Wizard: brownfield migration for projects table ──
    try {
      this.db!.run('ALTER TABLE projects ADD COLUMN setup_complete INTEGER DEFAULT 0');
    } catch {
      // Column already exists — safe to skip
    }

    this.save();
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  // ── Settings ────────────────────────────────────────────────────────

  getSetting(key: string): string | null {
    const row = this.db!.exec('SELECT value FROM settings WHERE key = ?', [key])[0];
    return row?.values?.[0]?.[0] as string | null;
  }

  setSetting(key: string, value: string): void {
    this.db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    this.save();
  }

  getDeviceId(): string | null {
    const row = this.db!.exec('SELECT value FROM settings WHERE key = ?', ['deviceId'])[0];
    return row?.values?.[0]?.[0] as string | null;
  }

  setDeviceId(id: string): void {
    this.db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['deviceId', id]);
    this.save();
  }

  // ── Helper: convert sql.js array row to object using column names ────

  private toObj(result: { columns: string[]; values: AnyRow[] }, rowIndex: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col, i) => { obj[col] = result.values[rowIndex][i]; });
    return obj;
  }

  private toObjAll(result: { columns: string[]; values: AnyRow[] } | undefined): Record<string, unknown>[] {
    if (!result?.values) return [];
    return result.values.map((_, i) => this.toObj(result, i));
  }

  // ── Projects ────────────────────────────────────────────────────────

  listProjects(userId: string): Project[] {
    const result = this.db!.exec('SELECT * FROM projects WHERE user_id = ?', [userId])[0];
    return this.toObjAll(result).map((r) => this.rowToProject(r as unknown as ProjectRow));
  }

  insertProject(project: Project): void {
    this.db!.run(
      'INSERT OR REPLACE INTO projects (id, user_id, name, description, is_self_maintenance, setup_complete, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [project.id, project.userId, project.name, project.description, project.isSelfMaintenance ? 1 : 0, project.setupComplete ? 1 : 0, project.createdAt, project.updatedAt, project.syncedAt]
    );
    this.save();
  }

  deleteProject(projectId: string): void {
    // Cascade-delete all child data before removing the project row.
    // Subquery-based deletes handle grandchild rows (plans, evidence_items).
    this.db!.run('DELETE FROM plans WHERE mission_id IN (SELECT id FROM missions WHERE project_id = ?)', [projectId]);
    this.db!.run('DELETE FROM evidence_items WHERE mission_id IN (SELECT id FROM missions WHERE project_id = ?)', [projectId]);
    this.db!.run('DELETE FROM missions WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM capabilities WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM incidents WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM environments WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM deploy_candidates WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM deploy_runs WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM mcp_servers WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM ssh_targets WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM watch_sessions WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM anomaly_events WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM project_devops_configs WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM project_config WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM conversations WHERE project_id = ?', [projectId]);
    this.db!.run('DELETE FROM projects WHERE id = ?', [projectId]);
    this.save();
  }

  getSelfMaintenanceProject(): Project | null {
    const result = this.db!.exec('SELECT * FROM projects WHERE is_self_maintenance = 1 LIMIT 1')[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToProject(objs[0] as unknown as ProjectRow);
  }

  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description ?? null,
      isSelfMaintenance: row.is_self_maintenance === 1,
      setupComplete: row.setup_complete === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
    };
  }

  // ── Project Config (New Project Wizard) ─────────────────────────────

  upsertProjectConfig(config: ProjectConfig): void {
    this.db!.run(
      `INSERT OR REPLACE INTO project_config (
        project_id, repo_url, local_folder_path, coolify_base_url, coolify_app_id,
        supabase_project_url, supabase_project_ref, supabase_anon_key,
        railway_project_id, railway_service_id,
        cloudflare_account_id, cloudflare_zone_id,
        google_oauth_client_id, azure_oauth_client_id, azure_oauth_tenant_id,
        enabled_integrations_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.projectId,
        config.repoUrl,
        config.localFolderPath,
        config.coolifyBaseUrl,
        config.coolifyAppId,
        config.supabaseProjectUrl,
        config.supabaseProjectRef,
        config.supabaseAnonKey,
        config.railwayProjectId,
        config.railwayServiceId,
        config.cloudflareAccountId,
        config.cloudflareZoneId,
        config.googleOAuthClientId,
        config.azureOAuthClientId,
        config.azureOAuthTenantId,
        JSON.stringify(config.enabledIntegrations),
        config.updatedAt,
      ]
    );
    this.save();
  }

  getProjectConfig(projectId: string): ProjectConfig | null {
    const result = this.db!.exec('SELECT * FROM project_config WHERE project_id = ?', [projectId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    const row = objs[0];
    return {
      projectId: row.project_id as string,
      repoUrl: (row.repo_url as string) ?? null,
      localFolderPath: (row.local_folder_path as string) ?? null,
      coolifyBaseUrl: (row.coolify_base_url as string) ?? null,
      coolifyAppId: (row.coolify_app_id as string) ?? null,
      supabaseProjectUrl: (row.supabase_project_url as string) ?? null,
      supabaseProjectRef: (row.supabase_project_ref as string) ?? null,
      supabaseAnonKey: (row.supabase_anon_key as string) ?? null,
      railwayProjectId: (row.railway_project_id as string) ?? null,
      railwayServiceId: (row.railway_service_id as string) ?? null,
      cloudflareAccountId: (row.cloudflare_account_id as string) ?? null,
      cloudflareZoneId: (row.cloudflare_zone_id as string) ?? null,
      googleOAuthClientId: (row.google_oauth_client_id as string) ?? null,
      azureOAuthClientId: (row.azure_oauth_client_id as string) ?? null,
      azureOAuthTenantId: (row.azure_oauth_tenant_id as string) ?? null,
      enabledIntegrations: JSON.parse((row.enabled_integrations_json as string) || '[]') as string[],
      updatedAt: row.updated_at as string,
    };
  }

  // ── Modes ───────────────────────────────────────────────────────────

  listModes(): Mode[] {
    const result = this.db!.exec('SELECT * FROM modes')[0];
    return this.toObjAll(result).map((r) => this.rowToMode(r as unknown as ModeRow));
  }

  getMode(id: string): Mode | null {
    const result = this.db!.exec('SELECT * FROM modes WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToMode(objs[0] as unknown as ModeRow);
  }

  upsertMode(mode: Mode): void {
    this.db!.run(
      'INSERT OR REPLACE INTO modes (id, slug, name, description, icon, color, soul, model_id, fallback_model_id, temperature, approval_policy, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [mode.id, mode.slug, mode.name, mode.description, mode.icon, mode.color, mode.soul, mode.modelId, mode.fallbackModelId, mode.temperature, mode.approvalPolicy, mode.isBuiltIn ? 1 : 0, mode.createdAt, mode.updatedAt]
    );
    this.save();
  }

  updateModeSoul(id: string, soul: string): void {
    this.db!.run('UPDATE modes SET soul = ?, updated_at = ? WHERE id = ?', [soul, new Date().toISOString(), id]);
    this.save();
  }

  updateModeModel(id: string, modelId: string): void {
    this.db!.run('UPDATE modes SET model_id = ?, updated_at = ? WHERE id = ?', [modelId, new Date().toISOString(), id]);
    this.save();
  }

  seedDefaultModes(modes: Omit<Mode, 'createdAt' | 'updatedAt'>[]): void {
    const existing = this.listModes();
    if (existing.length > 0) return;
    const now = new Date().toISOString();
    for (const mode of modes) {
      this.upsertMode({ ...mode, createdAt: now, updatedAt: now } as Mode);
    }
  }

  migrateDefaultModelId(oldId: string, newId: string): void {
    this.db!.run(
      'UPDATE modes SET model_id = ?, updated_at = ? WHERE model_id = ? AND is_built_in = 1',
      [newId, new Date().toISOString(), oldId]
    );
    this.save();
  }

  private rowToMode(row: ModeRow): Mode {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      soul: row.soul,
      modelId: row.model_id,
      fallbackModelId: row.fallback_model_id,
      temperature: row.temperature,
      approvalPolicy: row.approval_policy as ApprovalPolicy,
      isBuiltIn: row.is_built_in === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Conversations ───────────────────────────────────────────────────

  listConversations(projectId: string | undefined): ConversationThread[] {
    if (!projectId) return [];
    const result = this.db!.exec('SELECT * FROM conversations WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToConversation(r as unknown as ConversationRow));
  }

  getConversation(id: string): ConversationThread | null {
    const result = this.db!.exec('SELECT * FROM conversations WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToConversation(objs[0] as unknown as ConversationRow);
  }

  createConversation(conv: ConversationThread): void {
    this.db!.run(
      'INSERT INTO conversations (id, project_id, user_id, title, run_state, owner_device_id, owner_device_name, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [conv.id, conv.projectId, conv.userId ?? '', conv.title, conv.runState ?? 'idle', conv.ownerDeviceId, conv.ownerDeviceName, conv.leaseExpiresAt, conv.createdAt, conv.updatedAt]
    );
    this.save();
  }

  updateConversationRunState(id: string, state: RunState, ownerDeviceId?: string, ownerDeviceName?: string, leaseExpiresAt?: string): void {
    this.db!.run(
      'UPDATE conversations SET run_state = ?, owner_device_id = ?, owner_device_name = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?',
      [state, ownerDeviceId ?? null, ownerDeviceName ?? null, leaseExpiresAt ?? null, new Date().toISOString(), id]
    );
    this.save();
  }

  upsertConversation(conv: ConversationThread): void {
    this.db!.run(
      'INSERT OR REPLACE INTO conversations (id, project_id, user_id, title, run_state, owner_device_id, owner_device_name, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [conv.id, conv.projectId, conv.userId ?? '', conv.title, conv.runState ?? 'idle', conv.ownerDeviceId, conv.ownerDeviceName, conv.leaseExpiresAt, conv.createdAt, conv.updatedAt]
    );
    this.save();
  }

  private rowToConversation(row: ConversationRow): ConversationThread {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id || undefined,
      title: row.title,
      runState: row.run_state as RunState,
      ownerDeviceId: row.owner_device_id,
      ownerDeviceName: row.owner_device_name,
      leaseExpiresAt: row.lease_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Messages ────────────────────────────────────────────────────────

  listMessages(conversationId: string): Message[] {
    const result = this.db!.exec('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId])[0];
    return this.toObjAll(result).map((r) => this.rowToMessage(r as unknown as MessageRow));
  }

  insertMessage(msg: Message): void {
    this.db!.run(
      'INSERT INTO messages (id, conversation_id, role, content, mode_id, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [msg.id, msg.conversationId, msg.role, msg.content, msg.modeId, msg.modelId, msg.createdAt]
    );
    this.save();
  }

  upsertMessage(msg: Message): void {
    this.db!.run(
      'INSERT OR REPLACE INTO messages (id, conversation_id, role, content, mode_id, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [msg.id, msg.conversationId, msg.role, msg.content, msg.modeId, msg.modelId, msg.createdAt]
    );
    this.save();
  }

  private rowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      modeId: row.mode_id,
      modelId: row.model_id,
      createdAt: row.created_at,
    };
  }

  // ── DevOps ──────────────────────────────────────────────────────────

  getProjectDevOpsConfig(projectId: string): ProjectDevOpsConfig | null {
    const rows = this.db!.exec('SELECT * FROM project_devops_configs WHERE project_id = ?', [projectId])[0];
    if (!rows?.values?.length) return null;
    const r = rows.values[0] as any;
    return {
      projectId: r.project_id,
      templateId: r.template_id,
      githubOwner: r.github_owner,
      githubRepo: r.github_repo,
      coolifyAppId: r.coolify_app_id,
      coolifyBaseUrl: r.coolify_base_url,
      imageName: r.image_name,
      healthCheckUrl: r.health_check_url,
      updatedAt: r.updated_at,
    };
  }

  saveProjectDevOpsConfig(config: ProjectDevOpsConfig): void {
    this.db!.run(
      'INSERT OR REPLACE INTO project_devops_configs (project_id, template_id, github_owner, github_repo, coolify_app_id, coolify_base_url, image_name, health_check_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [config.projectId, config.templateId, config.githubOwner, config.githubRepo, config.coolifyAppId, config.coolifyBaseUrl, config.imageName, config.healthCheckUrl, config.updatedAt]
    );
    this.save();
  }

  insertDeployRun(run: DeployRun): void {
    this.db!.run(
      'INSERT INTO deploy_runs (id, project_id, template_id, status, commit_sha, triggered_by, started_at, completed_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [run.id, run.projectId, run.templateId, run.status, run.commitSha, run.triggeredBy, run.startedAt, run.completedAt, run.error]
    );
    this.save();
  }

  updateDeployRun(id: string, updates: Partial<DeployRun>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.commitSha !== undefined) { fields.push('commit_sha = ?'); values.push(updates.commitSha); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
    if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error); }
    if (fields.length === 0) return;
    values.push(id);
    this.db!.run(`UPDATE deploy_runs SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  listDeployRuns(projectId: string): DeployRun[] {
    const rows = this.db!.exec('SELECT * FROM deploy_runs WHERE project_id = ? ORDER BY started_at DESC', [projectId])[0];
    if (!rows?.values) return [];
    return rows.values.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      templateId: r.template_id,
      status: r.status,
      commitSha: r.commit_sha,
      triggeredBy: r.triggered_by,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      error: r.error,
    }));
  }

  // ── Missions ────────────────────────────────────────────────────────

  listMissions(projectId: string): Mission[] {
    const result = this.db!.exec('SELECT * FROM missions WHERE project_id = ? ORDER BY created_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToMission(r));
  }

  getMission(id: string): Mission | null {
    const result = this.db!.exec('SELECT * FROM missions WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToMission(objs[0]);
  }

  insertMission(mission: Mission): void {
    this.db!.run(
      'INSERT OR REPLACE INTO missions (id, project_id, title, operator_request, clarified_constraints_json, status, owner, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [mission.id, mission.projectId, mission.title, mission.operatorRequest, JSON.stringify(mission.clarifiedConstraints), mission.status, mission.owner, mission.startedAt, mission.completedAt, mission.createdAt, mission.updatedAt]
    );
    this.save();
  }

  updateMission(id: string, updates: Partial<Mission>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.operatorRequest !== undefined) { fields.push('operator_request = ?'); values.push(updates.operatorRequest); }
    if (updates.clarifiedConstraints !== undefined) { fields.push('clarified_constraints_json = ?'); values.push(JSON.stringify(updates.clarifiedConstraints)); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.owner !== undefined) { fields.push('owner = ?'); values.push(updates.owner); }
    if (updates.startedAt !== undefined) { fields.push('started_at = ?'); values.push(updates.startedAt); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
    fields.push('updated_at = ?'); values.push(new Date().toISOString());
    values.push(id);
    this.db!.run(`UPDATE missions SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  deleteMission(id: string): void {
    this.db!.run('DELETE FROM missions WHERE id = ?', [id]);
    this.save();
  }

  private rowToMission(row: Record<string, unknown>): Mission {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      operatorRequest: (row.operator_request as string) ?? '',
      clarifiedConstraints: JSON.parse((row.clarified_constraints_json as string) ?? '[]'),
      status: (row.status as MissionStatus) ?? 'draft',
      owner: (row.owner as string) ?? null,
      startedAt: (row.started_at as string) ?? null,
      completedAt: (row.completed_at as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Plans ───────────────────────────────────────────────────────────

  getPlan(missionId: string): Plan | null {
    const result = this.db!.exec('SELECT * FROM plans WHERE mission_id = ?', [missionId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    const row = objs[0];
    const steps: PlanStep[] = JSON.parse((row.steps_json as string) ?? '[]');
    return {
      missionId: row.mission_id as string,
      steps,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  upsertPlan(plan: Plan): void {
    this.db!.run(
      'INSERT OR REPLACE INTO plans (mission_id, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [plan.missionId, JSON.stringify(plan.steps), plan.createdAt, plan.updatedAt]
    );
    this.save();
  }

  // ── Evidence Items ──────────────────────────────────────────────────

  listEvidenceItems(missionId: string): EvidenceItem[] {
    const result = this.db!.exec('SELECT * FROM evidence_items WHERE mission_id = ? ORDER BY timestamp DESC', [missionId])[0];
    return this.toObjAll(result).map((r) => this.rowToEvidenceItem(r));
  }

  insertEvidenceItem(item: EvidenceItem): void {
    this.db!.run(
      'INSERT INTO evidence_items (id, mission_id, type, status, title, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item.id, item.missionId, item.type, item.status, item.title, item.detail, item.timestamp]
    );
    this.save();
  }

  private rowToEvidenceItem(row: Record<string, unknown>): EvidenceItem {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      type: row.type as EvidenceItemType,
      status: row.status as EvidenceItem['status'],
      title: row.title as string,
      detail: (row.detail as string) ?? null,
      timestamp: row.timestamp as string,
    };
  }

  // ── Capabilities ────────────────────────────────────────────────────

  listCapabilities(): Capability[] {
    const result = this.db!.exec('SELECT * FROM capabilities')[0];
    return this.toObjAll(result).map((r) => this.rowToCapability(r));
  }

  getCapability(id: string): Capability | null {
    const result = this.db!.exec('SELECT * FROM capabilities WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToCapability(objs[0]);
  }

  upsertCapability(cap: Capability): void {
    this.db!.run(
      'INSERT OR REPLACE INTO capabilities (id, name, type, health, last_failure, permissions_json, class, owner, description, scope, auth_method, enabled, last_success_at, last_failure_at, last_failure_reason, audit_notes, project_id, actions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        cap.id, cap.name, cap.type, cap.health, cap.lastFailure, JSON.stringify(cap.permissions),
        cap.class, cap.owner, cap.description, cap.scope, cap.authMethod, cap.enabled ? 1 : 0,
        cap.lastSuccessAt, cap.lastFailureAt, cap.lastFailureReason, cap.auditNotes, cap.projectId,
        JSON.stringify(cap.actions), cap.createdAt, cap.updatedAt,
      ]
    );
    this.save();
  }

  deleteCapability(id: string): void {
    this.db!.run('DELETE FROM capabilities WHERE id = ?', [id]);
    this.save();
  }

  private rowToCapability(row: Record<string, unknown>): Capability {
    // Brownfield: if class is null, derive from old type field
    const derivedClass = (row.class as CapabilityClass) ?? (row.type === 'mcp' ? 'mcp' : 'direct-api');
    return {
      id: row.id as string,
      name: row.name as string,
      type: (row.type as 'mcp' | 'direct') ?? 'direct',
      class: derivedClass,
      owner: (row.owner as string) ?? 'builtin',
      description: (row.description as string) ?? '',
      scope: (row.scope as string) ?? '',
      authMethod: (row.auth_method as string) ?? null,
      actions: JSON.parse((row.actions_json as string) ?? '[]') as CapabilityAction[],
      health: (row.health as CapabilityHealth) ?? 'unknown',
      enabled: (row.enabled as number) !== 0,
      lastSuccessAt: (row.last_success_at as string) ?? null,
      lastFailureAt: (row.last_failure_at as string) ?? null,
      lastFailureReason: (row.last_failure_reason as string) ?? null,
      auditNotes: (row.audit_notes as string) ?? '',
      projectId: (row.project_id as string) ?? null,
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
      updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
      // Deprecated field — preserved for brownfield compatibility
      lastFailure: (row.last_failure as string) ?? null,
      permissions: JSON.parse((row.permissions_json as string) ?? '[]'),
    };
  }

  // ── MCP Servers ─────────────────────────────────────────────────────

  listMcpServers(): McpServerConfig[] {
    const result = this.db!.exec('SELECT * FROM mcp_servers')[0];
    return this.toObjAll(result).map((r) => this.rowToMcpServer(r));
  }

  getMcpServer(id: string): McpServerConfig | null {
    const result = this.db!.exec('SELECT * FROM mcp_servers WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToMcpServer(objs[0]);
  }

  upsertMcpServer(config: McpServerConfig): void {
    this.db!.run(
      'INSERT OR REPLACE INTO mcp_servers (id, name, description, command, args_json, env_json, transport, auth_method, scope, enabled, project_id, health, last_health_check_at, discovered_tools_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        config.id, config.name, config.description, config.command,
        JSON.stringify(config.args), config.env ? JSON.stringify(config.env) : null,
        config.transport, config.authMethod, config.scope, config.enabled ? 1 : 0,
        config.projectId, config.health, config.lastHealthCheckAt,
        JSON.stringify(config.discoveredTools), config.createdAt, config.updatedAt,
      ]
    );
    this.save();
  }

  deleteMcpServer(id: string): void {
    this.db!.run('DELETE FROM mcp_servers WHERE id = ?', [id]);
    this.save();
  }

  private rowToMcpServer(row: Record<string, unknown>): McpServerConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) ?? '',
      command: (row.command as string) ?? '',
      args: JSON.parse((row.args_json as string) ?? '[]') as string[],
      env: (row.env_json ? JSON.parse(row.env_json as string) : {}) as Record<string, string>,
      transport: (row.transport as 'stdio' | 'sse' | 'http') ?? 'stdio',
      authMethod: (row.auth_method as string) ?? null,
      scope: (row.scope as string) ?? '',
      enabled: (row.enabled as number) !== 0,
      projectId: (row.project_id as string) ?? null,
      health: (row.health as CapabilityHealth) ?? 'unknown',
      lastHealthCheckAt: (row.last_health_check_at as string) ?? null,
      discoveredTools: JSON.parse((row.discovered_tools_json as string) ?? '[]') as McpToolInfo[],
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
      updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    };
  }

  // ── Capability Invocations ──────────────────────────────────────────

  logCapabilityInvocation(log: CapabilityInvocationLog): void {
    this.db!.run(
      'INSERT INTO capability_invocations (id, capability_id, action_id, role_slug, mission_id, plan_step_id, parameters_json, dry_run, expected_side_effects, timestamp, success, result, latency_ms, artifacts_json, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        log.id, log.capabilityId, log.actionId, log.roleSlug, log.missionId, log.planStepId,
        JSON.stringify(log.parameters), log.dryRun ? 1 : 0, log.expectedSideEffects,
        log.timestamp, log.success ? 1 : 0, log.result, log.latencyMs,
        JSON.stringify(log.emittedArtifacts), log.error,
      ]
    );
    this.save();
  }

  getCapabilityInvocations(capabilityId: string, limit: number = 50): CapabilityInvocationLog[] {
    const result = this.db!.exec(
      'SELECT * FROM capability_invocations WHERE capability_id = ? ORDER BY timestamp DESC LIMIT ?',
      [capabilityId, limit]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToInvocationLog(r));
  }

  private rowToInvocationLog(row: Record<string, unknown>): CapabilityInvocationLog {
    return {
      id: row.id as string,
      capabilityId: row.capability_id as string,
      actionId: row.action_id as string,
      roleSlug: (row.role_slug as string) ?? null,
      missionId: (row.mission_id as string) ?? null,
      planStepId: (row.plan_step_id as string) ?? null,
      parameters: JSON.parse((row.parameters_json as string) ?? '{}') as Record<string, unknown>,
      dryRun: (row.dry_run as number) !== 0,
      expectedSideEffects: (row.expected_side_effects as string) ?? '',
      timestamp: (row.timestamp as string) ?? '',
      success: (row.success as number) !== 0,
      result: (row.result as string) ?? null,
      latencyMs: (row.latency_ms as number) ?? 0,
      emittedArtifacts: JSON.parse((row.artifacts_json as string) ?? '[]') as string[],
      error: (row.error as string) ?? null,
    };
  }

  // ── Incidents ───────────────────────────────────────────────────────

  listIncidents(projectId: string): Incident[] {
    const result = this.db!.exec('SELECT * FROM incidents WHERE project_id = ? ORDER BY detected_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToIncident(r));
  }

  getIncident(id: string): Incident | null {
    const result = this.db!.exec('SELECT * FROM incidents WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToIncident(objs[0]);
  }

  insertIncident(incident: Incident): void {
    this.db!.run(
      'INSERT OR REPLACE INTO incidents (id, project_id, title, severity, description, status, detected_at, resolved_at, environment_id, deploy_workflow_id, evidence_ids_json, correlated_change_ids_json, recommended_action, self_healing_attempted, self_healing_result, watch_mode_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        incident.id, incident.projectId, incident.title, incident.severity,
        incident.description, incident.status, incident.detectedAt, incident.resolvedAt,
        incident.environmentId, incident.deployWorkflowId,
        JSON.stringify(incident.evidenceIds ?? []),
        JSON.stringify(incident.correlatedChangeIds ?? []),
        incident.recommendedAction, incident.selfHealingAttempted ? 1 : 0,
        incident.selfHealingResult, incident.watchModeActive ? 1 : 0,
      ]
    );
    this.save();
  }

  updateIncident(id: string, updates: Partial<Incident>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.severity !== undefined) { fields.push('severity = ?'); values.push(updates.severity); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.resolvedAt !== undefined) { fields.push('resolved_at = ?'); values.push(updates.resolvedAt); }
    if (updates.environmentId !== undefined) { fields.push('environment_id = ?'); values.push(updates.environmentId); }
    if (updates.deployWorkflowId !== undefined) { fields.push('deploy_workflow_id = ?'); values.push(updates.deployWorkflowId); }
    if (updates.evidenceIds !== undefined) { fields.push('evidence_ids_json = ?'); values.push(JSON.stringify(updates.evidenceIds)); }
    if (updates.correlatedChangeIds !== undefined) { fields.push('correlated_change_ids_json = ?'); values.push(JSON.stringify(updates.correlatedChangeIds)); }
    if (updates.recommendedAction !== undefined) { fields.push('recommended_action = ?'); values.push(updates.recommendedAction); }
    if (updates.selfHealingAttempted !== undefined) { fields.push('self_healing_attempted = ?'); values.push(updates.selfHealingAttempted ? 1 : 0); }
    if (updates.selfHealingResult !== undefined) { fields.push('self_healing_result = ?'); values.push(updates.selfHealingResult); }
    if (updates.watchModeActive !== undefined) { fields.push('watch_mode_active = ?'); values.push(updates.watchModeActive ? 1 : 0); }
    values.push(id);
    this.db!.run(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  /** Update extended incident fields (Component 21). */
  updateIncidentWatchFields(id: string, updates: {
    environmentId?: string | null;
    deployWorkflowId?: string | null;
    evidenceIds?: string[];
    correlatedChangeIds?: string[];
    recommendedAction?: string | null;
    selfHealingAttempted?: boolean;
    selfHealingResult?: string | null;
    watchModeActive?: boolean;
  }): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.environmentId !== undefined) { fields.push('environment_id = ?'); values.push(updates.environmentId); }
    if (updates.deployWorkflowId !== undefined) { fields.push('deploy_workflow_id = ?'); values.push(updates.deployWorkflowId); }
    if (updates.evidenceIds !== undefined) { fields.push('evidence_ids_json = ?'); values.push(JSON.stringify(updates.evidenceIds)); }
    if (updates.correlatedChangeIds !== undefined) { fields.push('correlated_change_ids_json = ?'); values.push(JSON.stringify(updates.correlatedChangeIds)); }
    if (updates.recommendedAction !== undefined) { fields.push('recommended_action = ?'); values.push(updates.recommendedAction); }
    if (updates.selfHealingAttempted !== undefined) { fields.push('self_healing_attempted = ?'); values.push(updates.selfHealingAttempted ? 1 : 0); }
    if (updates.selfHealingResult !== undefined) { fields.push('self_healing_result = ?'); values.push(updates.selfHealingResult); }
    if (updates.watchModeActive !== undefined) { fields.push('watch_mode_active = ?'); values.push(updates.watchModeActive ? 1 : 0); }
    if (fields.length === 0) return;
    values.push(id);
    this.db!.run(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  private rowToIncident(row: Record<string, unknown>): Incident {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      severity: (row.severity as IncidentSeverity) ?? 'low',
      description: (row.description as string) ?? '',
      status: (row.status as Incident['status']) ?? 'open',
      detectedAt: row.detected_at as string,
      resolvedAt: (row.resolved_at as string) ?? null,
      // Component 21 fields
      environmentId: (row.environment_id as string) ?? null,
      deployWorkflowId: (row.deploy_workflow_id as string) ?? null,
      evidenceIds: JSON.parse((row.evidence_ids_json as string) ?? '[]') as string[],
      correlatedChangeIds: JSON.parse((row.correlated_change_ids_json as string) ?? '[]') as string[],
      recommendedAction: (row.recommended_action as string) ?? null,
      selfHealingAttempted: (row.self_healing_attempted as number) === 1,
      selfHealingResult: (row.self_healing_result as string) ?? null,
      watchModeActive: (row.watch_mode_active as number) === 1,
    };
  }

  // ── Deploy Candidates ───────────────────────────────────────────────

  listDeployCandidates(projectId: string): DeployCandidate[] {
    const result = this.db!.exec('SELECT * FROM deploy_candidates WHERE project_id = ? ORDER BY deployed_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToDeployCandidate(r));
  }

  upsertDeployCandidate(candidate: DeployCandidate): void {
    this.db!.run(
      'INSERT OR REPLACE INTO deploy_candidates (id, project_id, environment_id, commit_sha, version, status, deployed_at, deployed_by, evidence_ids_json, verification_run_id, rollback_checkpoint_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [candidate.id, candidate.projectId, candidate.environmentId, candidate.commitSha, candidate.version, candidate.status, candidate.deployedAt, candidate.deployedBy, JSON.stringify(candidate.evidenceIds ?? []), candidate.verificationRunId, candidate.rollbackCheckpointId]
    );
    this.save();
  }

  private rowToDeployCandidate(row: Record<string, unknown>): DeployCandidate {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      commitSha: row.commit_sha as string,
      version: row.version as string,
      status: (row.status as DeployCandidate['status']) ?? 'pending',
      deployedAt: (row.deployed_at as string) ?? null,
      deployedBy: (row.deployed_by as string) ?? '',
      evidenceIds: JSON.parse((row.evidence_ids_json as string) ?? '[]') as string[],
      verificationRunId: (row.verification_run_id as string) ?? null,
      rollbackCheckpointId: (row.rollback_checkpoint_id as string) ?? null,
    };
  }

  // ── Environments ────────────────────────────────────────────────────

  listEnvironments(projectId: string): Environment[] {
    const result = this.db!.exec('SELECT * FROM environments WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToEnvironment(r));
  }

  getEnvironment(id: string): Environment | null {
    const result = this.db!.exec('SELECT * FROM environments WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToEnvironment(objs[0]);
  }

  upsertEnvironment(env: Environment): void {
    this.db!.run(
      'INSERT OR REPLACE INTO environments (id, project_id, name, type, current_version, secrets_complete, service_health, branch_mapping, host, deploy_mechanism, required_secrets_json, linked_service_ids_json, health_endpoint, protections_json, rollback_method, mutability_rules_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        env.id, env.projectId, env.name, env.type, env.currentVersion, env.secretsComplete ? 1 : 0, env.serviceHealth, env.branchMapping,
        env.host, env.deployMechanism, JSON.stringify(env.requiredSecrets ?? []), JSON.stringify(env.linkedServiceIds ?? []),
        env.healthEndpoint, JSON.stringify(env.protections ?? []), env.rollbackMethod, JSON.stringify(env.mutabilityRules ?? []),
      ]
    );
    this.save();
  }

  private rowToEnvironment(row: Record<string, unknown>): Environment {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      type: (row.type as EnvironmentType) ?? 'local',
      currentVersion: (row.current_version as string) ?? null,
      secretsComplete: (row.secrets_complete as number) === 1,
      serviceHealth: (row.service_health as CapabilityHealth) ?? 'unknown',
      branchMapping: (row.branch_mapping as string) ?? null,
      host: (row.host as string) ?? null,
      deployMechanism: (row.deploy_mechanism as string) ?? null,
      requiredSecrets: JSON.parse((row.required_secrets_json as string) ?? '[]') as string[],
      linkedServiceIds: JSON.parse((row.linked_service_ids_json as string) ?? '[]') as string[],
      healthEndpoint: (row.health_endpoint as string) ?? null,
      protections: JSON.parse((row.protections_json as string) ?? '[]') as EnvironmentProtection[],
      rollbackMethod: (row.rollback_method as string) ?? null,
      mutabilityRules: JSON.parse((row.mutability_rules_json as string) ?? '[]') as MutabilityRule[],
    };
  }

  // ── Component 11: Project Intelligence ────────────────────────────────────

  // Project Index

  upsertProjectIndex(idx: ProjectIndex): void {
    this.db!.run(
      'INSERT OR REPLACE INTO project_indexes (id, project_id, repo_root, branch, package_manager, build_command, test_command, lockfiles_json, monorepo_packages_json, generated_dirs_json, protected_paths_json, indexed_at, staleness) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        idx.id, idx.projectId, idx.repoRoot, idx.branch, idx.packageManager,
        idx.buildCommand, idx.testCommand, JSON.stringify(idx.lockfiles),
        JSON.stringify(idx.monorepoPackages), JSON.stringify(idx.generatedDirs),
        JSON.stringify(idx.protectedPaths), idx.indexedAt, idx.staleness,
      ]
    );
    this.save();
  }

  getProjectIndex(projectId: string): ProjectIndex | null {
    const result = this.db!.exec('SELECT * FROM project_indexes WHERE project_id = ? ORDER BY indexed_at DESC LIMIT 1', [projectId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToProjectIndex(objs[0]);
  }

  private rowToProjectIndex(row: Record<string, unknown>): ProjectIndex {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      repoRoot: row.repo_root as string,
      branch: (row.branch as string) ?? null,
      packageManager: (row.package_manager as string) ?? null,
      buildCommand: (row.build_command as string) ?? null,
      testCommand: (row.test_command as string) ?? null,
      lockfiles: JSON.parse((row.lockfiles_json as string) ?? '[]') as string[],
      monorepoPackages: JSON.parse((row.monorepo_packages_json as string) ?? '[]') as string[],
      generatedDirs: JSON.parse((row.generated_dirs_json as string) ?? '[]') as string[],
      protectedPaths: JSON.parse((row.protected_paths_json as string) ?? '[]') as string[],
      indexedAt: row.indexed_at as string,
      staleness: (row.staleness as ProjectIndex['staleness']) ?? 'unknown',
    };
  }

  // File Records

  upsertFileRecord(rec: FileRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO file_records (id, project_id, path, language, size_bytes, is_generated, is_protected, last_modified, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.path, rec.language, rec.sizeBytes, rec.isGenerated ? 1 : 0, rec.isProtected ? 1 : 0, rec.lastModified, rec.indexedAt]
    );
  }

  listFileRecords(projectId: string, filter?: { language?: string; isGenerated?: boolean }): FileRecord[] {
    let sql = 'SELECT * FROM file_records WHERE project_id = ?';
    const params: unknown[] = [projectId];
    if (filter?.language) { sql += ' AND language = ?'; params.push(filter.language); }
    if (filter?.isGenerated !== undefined) { sql += ' AND is_generated = ?'; params.push(filter.isGenerated ? 1 : 0); }
    const result = this.db!.exec(sql, params)[0];
    return this.toObjAll(result).map((r) => this.rowToFileRecord(r));
  }

  getFileRecord(projectId: string, path: string): FileRecord | null {
    const result = this.db!.exec('SELECT * FROM file_records WHERE project_id = ? AND path = ?', [projectId, path])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToFileRecord(objs[0]);
  }

  deleteFileRecordsForProject(projectId: string): void {
    this.db!.run('DELETE FROM file_records WHERE project_id = ?', [projectId]);
  }

  private rowToFileRecord(row: Record<string, unknown>): FileRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      path: row.path as string,
      language: row.language as string,
      sizeBytes: (row.size_bytes as number) ?? 0,
      isGenerated: (row.is_generated as number) === 1,
      isProtected: (row.is_protected as number) === 1,
      lastModified: (row.last_modified as string) ?? null,
      indexedAt: row.indexed_at as string,
    };
  }

  // Symbol Records

  upsertSymbolRecord(rec: SymbolRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO symbol_records (id, project_id, file_id, file_path, name, kind, export_type, line_start, line_end, signature, doc_comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.fileId, rec.filePath, rec.name, rec.kind, rec.exportType, rec.lineStart, rec.lineEnd, rec.signature, rec.docComment]
    );
  }

  listSymbolRecords(projectId: string, filter?: { fileId?: string; kind?: string }): SymbolRecord[] {
    let sql = 'SELECT * FROM symbol_records WHERE project_id = ?';
    const params: unknown[] = [projectId];
    if (filter?.fileId) { sql += ' AND file_id = ?'; params.push(filter.fileId); }
    if (filter?.kind) { sql += ' AND kind = ?'; params.push(filter.kind); }
    const result = this.db!.exec(sql, params)[0];
    return this.toObjAll(result).map((r) => this.rowToSymbolRecord(r));
  }

  getSymbolRecord(projectId: string, id: string): SymbolRecord | null {
    const result = this.db!.exec('SELECT * FROM symbol_records WHERE project_id = ? AND id = ?', [projectId, id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToSymbolRecord(objs[0]);
  }

  deleteSymbolRecordsForFile(fileId: string): void {
    this.db!.run('DELETE FROM symbol_records WHERE file_id = ?', [fileId]);
  }

  private rowToSymbolRecord(row: Record<string, unknown>): SymbolRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      fileId: row.file_id as string,
      filePath: row.file_path as string,
      name: row.name as string,
      kind: row.kind as SymbolRecord['kind'],
      exportType: (row.export_type as SymbolRecord['exportType']) ?? 'none',
      lineStart: (row.line_start as number) ?? null,
      lineEnd: (row.line_end as number) ?? null,
      signature: (row.signature as string) ?? null,
      docComment: (row.doc_comment as string) ?? null,
    };
  }

  // Reference Edges

  upsertReferenceEdge(rec: ReferenceEdge): void {
    this.db!.run(
      'INSERT OR REPLACE INTO reference_edges (id, project_id, source_file_id, target_file_id, source_symbol_id, target_symbol_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.sourceFileId, rec.targetFileId, rec.sourceSymbolId, rec.targetSymbolId, rec.referenceType]
    );
  }

  listReferenceEdges(projectId: string): ReferenceEdge[] {
    const result = this.db!.exec('SELECT * FROM reference_edges WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToReferenceEdge(r));
  }

  deleteReferenceEdgesForProject(projectId: string): void {
    this.db!.run('DELETE FROM reference_edges WHERE project_id = ?', [projectId]);
  }

  private rowToReferenceEdge(row: Record<string, unknown>): ReferenceEdge {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      sourceFileId: row.source_file_id as string,
      targetFileId: row.target_file_id as string,
      sourceSymbolId: (row.source_symbol_id as string) ?? null,
      targetSymbolId: (row.target_symbol_id as string) ?? null,
      referenceType: row.reference_type as ReferenceEdge['referenceType'],
    };
  }

  // Route Records

  upsertRouteRecord(rec: RouteRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO route_records (id, project_id, file_id, method, path, handler, framework) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.fileId, rec.method, rec.path, rec.handler, rec.framework]
    );
  }

  listRouteRecords(projectId: string): RouteRecord[] {
    const result = this.db!.exec('SELECT * FROM route_records WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToRouteRecord(r));
  }

  private rowToRouteRecord(row: Record<string, unknown>): RouteRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      fileId: row.file_id as string,
      method: (row.method as string) ?? null,
      path: row.path as string,
      handler: (row.handler as string) ?? null,
      framework: (row.framework as string) ?? null,
    };
  }

  // API Endpoint Records

  upsertApiEndpointRecord(rec: ApiEndpointRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO api_endpoint_records (id, project_id, route_id, method, path, auth_required, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.routeId, rec.method, rec.path, rec.authRequired ? 1 : 0, rec.description]
    );
  }

  listApiEndpointRecords(projectId: string): ApiEndpointRecord[] {
    const result = this.db!.exec('SELECT * FROM api_endpoint_records WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToApiEndpointRecord(r));
  }

  private rowToApiEndpointRecord(row: Record<string, unknown>): ApiEndpointRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      routeId: (row.route_id as string) ?? null,
      method: row.method as string,
      path: row.path as string,
      authRequired: (row.auth_required as number) === 1,
      description: (row.description as string) ?? null,
    };
  }

  // Job Records

  upsertJobRecord(rec: JobRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO job_records (id, project_id, file_id, name, schedule, handler, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.fileId, rec.name, rec.schedule, rec.handler, rec.description]
    );
  }

  listJobRecords(projectId: string): JobRecord[] {
    const result = this.db!.exec('SELECT * FROM job_records WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToJobRecord(r));
  }

  private rowToJobRecord(row: Record<string, unknown>): JobRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      fileId: row.file_id as string,
      name: row.name as string,
      schedule: (row.schedule as string) ?? null,
      handler: (row.handler as string) ?? null,
      description: (row.description as string) ?? null,
    };
  }

  // Service Nodes

  upsertServiceNode(node: ServiceNode): void {
    this.db!.run(
      'INSERT OR REPLACE INTO service_nodes (id, project_id, name, type, url, health_status, capability_id, mcp_server_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [node.id, node.projectId, node.name, node.type, node.url, node.healthStatus, node.capabilityId, node.mcpServerId]
    );
  }

  listServiceNodes(projectId: string): ServiceNode[] {
    const result = this.db!.exec('SELECT * FROM service_nodes WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToServiceNode(r));
  }

  private rowToServiceNode(row: Record<string, unknown>): ServiceNode {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      type: row.type as ServiceNode['type'],
      url: (row.url as string) ?? null,
      healthStatus: (row.health_status as CapabilityHealth) ?? 'unknown',
      capabilityId: (row.capability_id as string) ?? null,
      mcpServerId: (row.mcp_server_id as string) ?? null,
    };
  }

  // Service Edges

  upsertServiceEdge(edge: ServiceEdge): void {
    this.db!.run(
      'INSERT OR REPLACE INTO service_edges (id, project_id, source_node_id, target_node_id, relationship) VALUES (?, ?, ?, ?, ?)',
      [edge.id, edge.projectId, edge.sourceNodeId, edge.targetNodeId, edge.relationship]
    );
  }

  listServiceEdges(projectId: string): ServiceEdge[] {
    const result = this.db!.exec('SELECT * FROM service_edges WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToServiceEdge(r));
  }

  private rowToServiceEdge(row: Record<string, unknown>): ServiceEdge {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      sourceNodeId: row.source_node_id as string,
      targetNodeId: row.target_node_id as string,
      relationship: row.relationship as ServiceEdge['relationship'],
    };
  }

  // Config Variable Records

  upsertConfigVariableRecord(rec: ConfigVariableRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO config_variable_records (id, project_id, name, source_file, default_value, is_secret, required_environments_json, missing_environments_json, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rec.id, rec.projectId, rec.name, rec.sourceFile, rec.defaultValue, rec.isSecret ? 1 : 0, JSON.stringify(rec.requiredEnvironments), JSON.stringify(rec.missingEnvironments), rec.description]
    );
  }

  listConfigVariableRecords(projectId: string): ConfigVariableRecord[] {
    const result = this.db!.exec('SELECT * FROM config_variable_records WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToConfigVariableRecord(r));
  }

  private rowToConfigVariableRecord(row: Record<string, unknown>): ConfigVariableRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      sourceFile: (row.source_file as string) ?? null,
      defaultValue: (row.default_value as string) ?? null,
      isSecret: (row.is_secret as number) === 1,
      requiredEnvironments: JSON.parse((row.required_environments_json as string) ?? '[]') as string[],
      missingEnvironments: JSON.parse((row.missing_environments_json as string) ?? '[]') as string[],
      description: (row.description as string) ?? null,
    };
  }

  // Context Packs (enriched)

  upsertContextPack(pack: ContextPackEnriched): void {
    this.db!.run(
      'INSERT OR REPLACE INTO context_packs (id, mission_id, items_json, warnings_json, token_usage, context_usage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [pack.id, pack.missionId, JSON.stringify(pack.items), JSON.stringify(pack.warnings), pack.tokenUsage, pack.contextUsage, pack.createdAt, pack.updatedAt]
    );
    this.save();
  }

  getContextPack(packId: string): ContextPackEnriched | null {
    const result = this.db!.exec('SELECT * FROM context_packs WHERE id = ?', [packId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToContextPack(objs[0]);
  }

  getContextPackForMission(missionId: string): ContextPackEnriched | null {
    const result = this.db!.exec('SELECT * FROM context_packs WHERE mission_id = ? ORDER BY created_at DESC LIMIT 1', [missionId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToContextPack(objs[0]);
  }

  private rowToContextPack(row: Record<string, unknown>): ContextPackEnriched {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      items: JSON.parse((row.items_json as string) ?? '[]') as ContextItem[],
      warnings: JSON.parse((row.warnings_json as string) ?? '[]') as ContextWarning[],
      tokenUsage: (row.token_usage as number) ?? 0,
      contextUsage: (row.context_usage as number) ?? 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Component 13: Change Engine CRUD ──────────────────────────────

  // Workspace Runs

  upsertWorkspaceRun(run: WorkspaceRun): void {
    this.db!.run(
      'INSERT OR REPLACE INTO workspace_runs (id, mission_id, plan_step_id, project_root, worktree_path, branch_name, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [run.id, run.missionId, run.planStepId, run.projectRoot, run.worktreePath, run.branchName, run.status, run.createdAt, run.completedAt]
    );
    this.save();
  }

  getWorkspaceRun(id: string): WorkspaceRun | null {
    const result = this.db!.exec('SELECT * FROM workspace_runs WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToWorkspaceRun(objs[0]);
  }

  listWorkspaceRuns(missionId?: string): WorkspaceRun[] {
    const query = missionId
      ? 'SELECT * FROM workspace_runs WHERE mission_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM workspace_runs ORDER BY created_at DESC';
    const params = missionId ? [missionId] : [];
    const result = this.db!.exec(query, params)[0];
    return this.toObjAll(result).map((r) => this.rowToWorkspaceRun(r));
  }

  private rowToWorkspaceRun(row: Record<string, unknown>): WorkspaceRun {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      planStepId: row.plan_step_id as string,
      projectRoot: row.project_root as string,
      worktreePath: row.worktree_path as string,
      branchName: row.branch_name as string,
      status: row.status as WorkspaceRun['status'],
      createdAt: row.created_at as string,
      completedAt: (row.completed_at as string) ?? null,
    };
  }

  // File Edits

  upsertFileEdit(edit: FileEdit): void {
    this.db!.run(
      'INSERT OR REPLACE INTO file_edits (id, workspace_run_id, file_path, operation, diff, validity_results_json, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [edit.id, edit.workspaceRunId, edit.filePath, edit.operation, edit.diff, JSON.stringify(edit.validityResults), edit.appliedAt]
    );
    this.save();
  }

  listFileEdits(workspaceRunId: string): FileEdit[] {
    const result = this.db!.exec('SELECT * FROM file_edits WHERE workspace_run_id = ? ORDER BY applied_at', [workspaceRunId])[0];
    return this.toObjAll(result).map((r) => this.rowToFileEdit(r));
  }

  private rowToFileEdit(row: Record<string, unknown>): FileEdit {
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      filePath: row.file_path as string,
      operation: row.operation as FileEdit['operation'],
      diff: row.diff as string,
      validityResults: JSON.parse((row.validity_results_json as string) ?? '[]') as EvidenceItem[],
      appliedAt: row.applied_at as string,
    };
  }

  // Checkpoints

  upsertCheckpoint(cp: Checkpoint): void {
    this.db!.run(
      'INSERT OR REPLACE INTO checkpoints (id, workspace_run_id, label, git_ref, created_at) VALUES (?, ?, ?, ?, ?)',
      [cp.id, cp.workspaceRunId, cp.label, cp.gitRef, cp.createdAt]
    );
    this.save();
  }

  listCheckpoints(workspaceRunId: string): Checkpoint[] {
    const result = this.db!.exec('SELECT * FROM checkpoints WHERE workspace_run_id = ? ORDER BY created_at', [workspaceRunId])[0];
    return this.toObjAll(result).map((r) => this.rowToCheckpoint(r));
  }

  getCheckpoint(id: string): Checkpoint | null {
    const result = this.db!.exec('SELECT * FROM checkpoints WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToCheckpoint(objs[0]);
  }

  private rowToCheckpoint(row: Record<string, unknown>): Checkpoint {
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      label: row.label as string,
      gitRef: row.git_ref as string,
      createdAt: row.created_at as string,
    };
  }

  // Semantic Change Groups

  upsertSemanticChangeGroup(group: SemanticChangeGroup): void {
    this.db!.run(
      'INSERT OR REPLACE INTO semantic_change_groups (id, workspace_run_id, label, description, file_edits_json, affected_contracts_json, blast_radius) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [group.id, group.workspaceRunId, group.label, group.description, JSON.stringify(group.fileEdits), JSON.stringify(group.affectedContracts), group.blastRadius]
    );
    this.save();
  }

  listSemanticChangeGroups(workspaceRunId: string): SemanticChangeGroup[] {
    const result = this.db!.exec('SELECT * FROM semantic_change_groups WHERE workspace_run_id = ?', [workspaceRunId])[0];
    return this.toObjAll(result).map((r) => this.rowToSemanticChangeGroup(r));
  }

  private rowToSemanticChangeGroup(row: Record<string, unknown>): SemanticChangeGroup {
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      label: row.label as string,
      description: row.description as string,
      fileEdits: JSON.parse((row.file_edits_json as string) ?? '[]') as string[],
      affectedContracts: JSON.parse((row.affected_contracts_json as string) ?? '[]') as string[],
      blastRadius: row.blast_radius as SemanticChangeGroup['blastRadius'],
    };
  }

  // Change Sets

  upsertChangeSet(cs: ChangeSet): void {
    this.db!.run(
      'INSERT OR REPLACE INTO change_sets (id, workspace_run_id, mission_id, plan_step_id, summary, rationale, file_edits_json, semantic_groups_json, affected_contracts_json, blast_radius, verification_state_json, rollback_checkpoint_id, duplicate_warnings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cs.id, cs.workspaceRunId, cs.missionId, cs.planStepId, cs.summary, cs.rationale, JSON.stringify(cs.fileEdits), JSON.stringify(cs.semanticGroups), JSON.stringify(cs.affectedContracts), cs.blastRadius, JSON.stringify(cs.verificationState), cs.rollbackCheckpointId, JSON.stringify(cs.duplicateWarnings), cs.createdAt]
    );
    this.save();
  }

  getChangeSet(id: string): ChangeSet | null {
    const result = this.db!.exec('SELECT * FROM change_sets WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToChangeSet(objs[0]);
  }

  getChangeSetForWorkspace(workspaceRunId: string): ChangeSet | null {
    const result = this.db!.exec('SELECT * FROM change_sets WHERE workspace_run_id = ? ORDER BY created_at DESC LIMIT 1', [workspaceRunId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToChangeSet(objs[0]);
  }

  private rowToChangeSet(row: Record<string, unknown>): ChangeSet {
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      missionId: row.mission_id as string,
      planStepId: row.plan_step_id as string,
      summary: row.summary as string,
      rationale: row.rationale as string,
      fileEdits: JSON.parse((row.file_edits_json as string) ?? '[]') as FileEdit[],
      semanticGroups: JSON.parse((row.semantic_groups_json as string) ?? '[]') as SemanticChangeGroup[],
      affectedContracts: JSON.parse((row.affected_contracts_json as string) ?? '[]') as string[],
      blastRadius: row.blast_radius as ChangeSet['blastRadius'],
      verificationState: JSON.parse((row.verification_state_json as string) ?? '[]') as EvidenceItem[],
      rollbackCheckpointId: (row.rollback_checkpoint_id as string) ?? null,
      duplicateWarnings: JSON.parse((row.duplicate_warnings_json as string) ?? '[]') as DuplicateWarning[],
      createdAt: row.created_at as string,
    };
  }

  // Duplicate Warnings

  upsertDuplicateWarning(warning: DuplicateWarning): void {
    this.db!.run(
      'INSERT OR REPLACE INTO duplicate_warnings (id, workspace_run_id, file_path, warning, existing_pattern, reuse_suggestion_json) VALUES (?, ?, ?, ?, ?, ?)',
      [warning.id, warning.workspaceRunId, warning.filePath, warning.warning, warning.existingPattern, warning.reuseSuggestion ? JSON.stringify(warning.reuseSuggestion) : null]
    );
    this.save();
  }

  listDuplicateWarnings(workspaceRunId: string): DuplicateWarning[] {
    const result = this.db!.exec('SELECT * FROM duplicate_warnings WHERE workspace_run_id = ?', [workspaceRunId])[0];
    return this.toObjAll(result).map((r) => this.rowToDuplicateWarning(r));
  }

  private rowToDuplicateWarning(row: Record<string, unknown>): DuplicateWarning {
    const reuseJson = (row.reuse_suggestion_json as string) ?? null;
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      filePath: row.file_path as string,
      warning: row.warning as string,
      existingPattern: (row.existing_pattern as string) ?? null,
      reuseSuggestion: reuseJson ? JSON.parse(reuseJson) as PatternReuseSuggestion : null,
    };
  }

  // ── Component 19: Audit Records ────────────────────────────────────

  insertAuditRecord(record: AuditRecord): void {
    this.db!.run(
      'INSERT INTO audit_records (id, mission_id, plan_step_id, role_slug, capability_id, action_type, parameters_json, environment, risk_class, risk_score, risk_dimensions_json, evidence_completeness, reversibility, evidence_summary, approval_chain_json, result, checkpoint_id, rollback_plan_json, initiated_by, initiated_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id,
        record.missionId,
        record.planStepId,
        record.roleSlug,
        record.capabilityId,
        record.actionType,
        JSON.stringify(record.parameters),
        record.environment,
        record.riskAssessment.riskClass,
        record.riskAssessment.overallScore,
        JSON.stringify(record.riskAssessment.dimensions),
        record.riskAssessment.evidenceCompleteness,
        record.riskAssessment.reversibility,
        record.evidenceSummary,
        JSON.stringify(record.approvalChain),
        record.result,
        record.checkpointId,
        record.rollbackPlan ? JSON.stringify(record.rollbackPlan) : null,
        record.initiatedBy,
        record.initiatedAt,
        record.completedAt,
        record.durationMs,
      ]
    );
    this.save();
  }

  getAuditRecord(id: string): AuditRecord | null {
    const result = this.db!.exec('SELECT * FROM audit_records WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToAuditRecord(objs[0]);
  }

  listAuditRecords(filter?: { missionId?: string; limit?: number }): AuditRecord[] {
    let sql = 'SELECT * FROM audit_records';
    const params: unknown[] = [];
    if (filter?.missionId) {
      sql += ' WHERE mission_id = ?';
      params.push(filter.missionId);
    }
    sql += ' ORDER BY initiated_at DESC';
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const result = this.db!.exec(sql, params)[0];
    return this.toObjAll(result).map((r) => this.rowToAuditRecord(r));
  }

  listAuditRecordsByRiskClass(riskClass: RiskClass): AuditRecord[] {
    const result = this.db!.exec(
      'SELECT * FROM audit_records WHERE risk_class = ? ORDER BY initiated_at DESC',
      [riskClass]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToAuditRecord(r));
  }

  updateAuditResult(id: string, result: string, completedAt: string | null, durationMs: number | null): void {
    this.db!.run(
      'UPDATE audit_records SET result = ?, completed_at = ?, duration_ms = ? WHERE id = ?',
      [result, completedAt, durationMs, id]
    );
    this.save();
  }

  linkCheckpointToAudit(auditId: string, checkpointId: string): void {
    this.db!.run(
      'UPDATE audit_records SET checkpoint_id = ? WHERE id = ?',
      [checkpointId, auditId]
    );
    this.save();
  }

  getCheckpointsForMission(missionId: string): Checkpoint[] {
    // Join audit_records with checkpoints via checkpoint_id
    const result = this.db!.exec(
      `SELECT c.* FROM checkpoints c
       INNER JOIN audit_records a ON a.checkpoint_id = c.id
       WHERE a.mission_id = ?
       ORDER BY c.created_at DESC`,
      [missionId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToCheckpoint(r));
  }

  private rowToAuditRecord(row: Record<string, unknown>): AuditRecord {
    return {
      id: row.id as string,
      missionId: (row.mission_id as string) ?? null,
      planStepId: (row.plan_step_id as string) ?? null,
      roleSlug: (row.role_slug as string) ?? null,
      capabilityId: (row.capability_id as string) ?? null,
      actionType: row.action_type as string,
      parameters: JSON.parse((row.parameters_json as string) ?? '{}') as Record<string, unknown>,
      environment: (row.environment as string) ?? null,
      riskAssessment: {
        riskClass: row.risk_class as RiskClass,
        overallScore: (row.risk_score as number) ?? 0,
        dimensions: JSON.parse((row.risk_dimensions_json as string) ?? '[]'),
        evidenceCompleteness: (row.evidence_completeness as 'complete' | 'partial' | 'missing') ?? 'missing',
        reversibility: (row.reversibility as 'reversible' | 'partially-reversible' | 'irreversible') ?? 'reversible',
      },
      evidenceSummary: (row.evidence_summary as string) ?? null,
      approvalChain: JSON.parse((row.approval_chain_json as string) ?? '[]'),
      result: row.result as AuditRecord['result'],
      checkpointId: (row.checkpoint_id as string) ?? null,
      rollbackPlan: row.rollback_plan_json ? JSON.parse(row.rollback_plan_json as string) : null,
      initiatedBy: (row.initiated_by as string) ?? 'system',
      initiatedAt: row.initiated_at as string,
      completedAt: (row.completed_at as string) ?? null,
      durationMs: (row.duration_ms as number) ?? null,
    };
  }

  // ── Component 15: Runtime Executions ────────────────────────────────────

  upsertRuntimeExecution(exec: RuntimeExecution): void {
    this.db!.run(
      'INSERT OR REPLACE INTO runtime_executions (id, workspace_run_id, mission_id, plan_step_id, command, cwd, status, exit_code, stdout, stderr, duration_ms, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        exec.id, exec.workspaceRunId, exec.missionId, exec.planStepId,
        exec.command, exec.cwd, exec.status, exec.exitCode,
        exec.stdout, exec.stderr, exec.durationMs, exec.startedAt, exec.completedAt,
      ]
    );
    this.save();
  }

  getRuntimeExecution(id: string): RuntimeExecution | null {
    const result = this.db!.exec('SELECT * FROM runtime_executions WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToRuntimeExecution(objs[0]);
  }

  listRuntimeExecutions(missionId: string): RuntimeExecution[] {
    const result = this.db!.exec(
      'SELECT * FROM runtime_executions WHERE mission_id = ? ORDER BY started_at DESC',
      [missionId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToRuntimeExecution(r));
  }

  private rowToRuntimeExecution(row: Record<string, unknown>): RuntimeExecution {
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      missionId: row.mission_id as string,
      planStepId: (row.plan_step_id as string) ?? null,
      command: row.command as string,
      cwd: row.cwd as string,
      status: row.status as RuntimeExecution['status'],
      exitCode: (row.exit_code as number) ?? null,
      stdout: (row.stdout as string) ?? '',
      stderr: (row.stderr as string) ?? '',
      durationMs: (row.duration_ms as number) ?? 0,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) ?? null,
    };
  }

  // ── Component 15: Browser Sessions ──────────────────────────────────────

  upsertBrowserSession(session: BrowserSession): void {
    this.db!.run(
      'INSERT OR REPLACE INTO browser_sessions (id, workspace_run_id, mission_id, plan_step_id, base_url, status, screenshots_json, console_logs, network_traces, started_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        session.id, session.workspaceRunId, session.missionId, session.planStepId,
        session.baseUrl, session.status, JSON.stringify(session.screenshots),
        session.consoleLogs, session.networkTraces, session.startedAt, session.closedAt,
      ]
    );
    this.save();
  }

  getBrowserSession(id: string): BrowserSession | null {
    const result = this.db!.exec('SELECT * FROM browser_sessions WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToBrowserSession(objs[0]);
  }

  listBrowserSessions(missionId: string): BrowserSession[] {
    const result = this.db!.exec(
      'SELECT * FROM browser_sessions WHERE mission_id = ? ORDER BY started_at DESC',
      [missionId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToBrowserSession(r));
  }

  private rowToBrowserSession(row: Record<string, unknown>): BrowserSession {
    return {
      id: row.id as string,
      workspaceRunId: row.workspace_run_id as string,
      missionId: row.mission_id as string,
      planStepId: (row.plan_step_id as string) ?? null,
      baseUrl: row.base_url as string,
      status: row.status as BrowserSession['status'],
      screenshots: JSON.parse((row.screenshots_json as string) ?? '[]') as string[],
      consoleLogs: (row.console_logs as string) ?? '',
      networkTraces: (row.network_traces as string) ?? '',
      startedAt: row.started_at as string,
      closedAt: (row.closed_at as string) ?? null,
    };
  }

  // ── Component 15: Evidence Records ──────────────────────────────────────

  upsertEvidenceRecord(record: EvidenceRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO evidence_records (id, mission_id, workspace_run_id, plan_step_id, changeset_id, environment_id, capability_invocation_id, type, status, title, detail, artifact_path, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.missionId, record.workspaceRunId, record.planStepId,
        record.changesetId, record.environmentId, record.capabilityInvocationId,
        record.type, record.status, record.title, record.detail,
        record.artifactPath, record.timestamp,
      ]
    );
    this.save();
  }

  getEvidenceRecord(id: string): EvidenceRecord | null {
    const result = this.db!.exec('SELECT * FROM evidence_records WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToEvidenceRecord(objs[0]);
  }

  listEvidenceRecordsByMission(missionId: string): EvidenceRecord[] {
    const result = this.db!.exec(
      'SELECT * FROM evidence_records WHERE mission_id = ? ORDER BY timestamp DESC',
      [missionId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToEvidenceRecord(r));
  }

  listEvidenceRecordsByWorkspaceRun(workspaceRunId: string): EvidenceRecord[] {
    const result = this.db!.exec(
      'SELECT * FROM evidence_records WHERE workspace_run_id = ? ORDER BY timestamp DESC',
      [workspaceRunId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToEvidenceRecord(r));
  }

  private rowToEvidenceRecord(row: Record<string, unknown>): EvidenceRecord {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      workspaceRunId: row.workspace_run_id as string,
      planStepId: (row.plan_step_id as string) ?? null,
      changesetId: (row.changeset_id as string) ?? null,
      environmentId: (row.environment_id as string) ?? null,
      capabilityInvocationId: (row.capability_invocation_id as string) ?? null,
      type: row.type as EvidenceItemType,
      status: row.status as EvidenceRecord['status'],
      title: row.title as string,
      detail: (row.detail as string) ?? null,
      artifactPath: (row.artifact_path as string) ?? null,
      timestamp: row.timestamp as string,
    };
  }

  // ── Component 16: Verification Runs ──────────────────────────────────────

  upsertVerificationRun(run: VerificationRun): void {
    this.db!.run(
      'INSERT OR REPLACE INTO verification_runs (id, mission_id, workspace_run_id, changeset_id, candidate_id, bundle_id, overall_status, checks_json, missing_required_checks_json, flake_suspicions_json, risk_impact, started_at, completed_at, verdict, verdict_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        run.id, run.missionId, run.workspaceRunId, run.changesetId, run.candidateId,
        run.bundleId, run.overallStatus, JSON.stringify(run.checks),
        JSON.stringify(run.missingRequiredChecks), JSON.stringify(run.flakeSuspicions),
        run.riskImpact, run.startedAt, run.completedAt, run.verdict, run.verdictReason,
      ]
    );
    this.save();
  }

  getVerificationRun(id: string): VerificationRun | null {
    const result = this.db!.exec('SELECT * FROM verification_runs WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToVerificationRun(objs[0]);
  }

  listVerificationRunsByMission(missionId: string): VerificationRun[] {
    const result = this.db!.exec(
      'SELECT * FROM verification_runs WHERE mission_id = ? ORDER BY started_at DESC',
      [missionId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToVerificationRun(r));
  }

  private rowToVerificationRun(row: Record<string, unknown>): VerificationRun {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      workspaceRunId: (row.workspace_run_id as string) ?? null,
      changesetId: (row.changeset_id as string) ?? null,
      candidateId: (row.candidate_id as string) ?? null,
      bundleId: row.bundle_id as string,
      overallStatus: row.overall_status as VerificationRun['overallStatus'],
      checks: JSON.parse((row.checks_json as string) ?? '[]') as VerificationCheck[],
      missingRequiredChecks: JSON.parse((row.missing_required_checks_json as string) ?? '[]') as string[],
      flakeSuspicions: JSON.parse((row.flake_suspicions_json as string) ?? '[]') as string[],
      riskImpact: row.risk_impact as VerificationRun['riskImpact'],
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) ?? null,
      verdict: (row.verdict as VerificationRun['verdict']) ?? null,
      verdictReason: (row.verdict_reason as string) ?? null,
    };
  }

  // ── Component 16: Verification Checks ──────────────────────────────────────

  upsertVerificationCheck(check: VerificationCheck): void {
    this.db!.run(
      'INSERT OR REPLACE INTO verification_checks (id, verification_run_id, layer, check_name, status, detail, evidence_item_ids_json, duration_ms, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        check.id, check.verificationRunId, check.layer, check.checkName,
        check.status, check.detail, JSON.stringify(check.evidenceItemIds),
        check.durationMs, check.startedAt, check.completedAt,
      ]
    );
    this.save();
  }

  listVerificationChecksByRun(runId: string): VerificationCheck[] {
    const result = this.db!.exec(
      'SELECT * FROM verification_checks WHERE verification_run_id = ? ORDER BY started_at ASC',
      [runId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToVerificationCheck(r));
  }

  private rowToVerificationCheck(row: Record<string, unknown>): VerificationCheck {
    return {
      id: row.id as string,
      verificationRunId: row.verification_run_id as string,
      layer: row.layer as VerificationCheck['layer'],
      checkName: row.check_name as string,
      status: row.status as VerificationCheck['status'],
      detail: (row.detail as string) ?? null,
      evidenceItemIds: JSON.parse((row.evidence_item_ids_json as string) ?? '[]') as string[],
      durationMs: (row.duration_ms as number) ?? null,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) ?? null,
    };
  }

  // ── Component 16: Verification Bundles ──────────────────────────────────────

  upsertVerificationBundle(bundle: VerificationBundle): void {
    this.db!.run(
      'INSERT OR REPLACE INTO verification_bundles (id, name, risk_class, required_layers_json, description) VALUES (?, ?, ?, ?, ?)',
      [bundle.id, bundle.name, bundle.riskClass, JSON.stringify(bundle.requiredLayers), bundle.description]
    );
    this.save();
  }

  listVerificationBundles(): VerificationBundle[] {
    const result = this.db!.exec('SELECT * FROM verification_bundles ORDER BY risk_class ASC')[0];
    return this.toObjAll(result).map((r) => this.rowToVerificationBundle(r));
  }

  getVerificationBundle(id: string): VerificationBundle | null {
    const result = this.db!.exec('SELECT * FROM verification_bundles WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToVerificationBundle(objs[0]);
  }

  private rowToVerificationBundle(row: Record<string, unknown>): VerificationBundle {
    return {
      id: row.id as string,
      name: row.name as string,
      riskClass: row.risk_class as VerificationBundle['riskClass'],
      requiredLayers: JSON.parse((row.required_layers_json as string) ?? '[]') as VerificationBundle['requiredLayers'],
      description: row.description as string,
    };
  }

  // ── Component 16: Acceptance Criteria ──────────────────────────────────────

  upsertAcceptanceCriteria(criteria: AcceptanceCriteria): void {
    this.db!.run(
      'INSERT OR REPLACE INTO acceptance_criteria (id, mission_id, intended_behavior_json, non_goals_json, paths_that_must_still_work_json, comparison_targets_json, regression_thresholds_json, rollback_conditions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        criteria.id, criteria.missionId,
        JSON.stringify(criteria.intendedBehavior), JSON.stringify(criteria.nonGoals),
        JSON.stringify(criteria.pathsThatMustStillWork), JSON.stringify(criteria.comparisonTargets),
        JSON.stringify(criteria.regressionThresholds), JSON.stringify(criteria.rollbackConditions),
        criteria.createdAt, criteria.updatedAt,
      ]
    );
    this.save();
  }

  getAcceptanceCriteria(missionId: string): AcceptanceCriteria | null {
    const result = this.db!.exec('SELECT * FROM acceptance_criteria WHERE mission_id = ?', [missionId])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToAcceptanceCriteria(objs[0]);
  }

  private rowToAcceptanceCriteria(row: Record<string, unknown>): AcceptanceCriteria {
    return {
      id: row.id as string,
      missionId: row.mission_id as string,
      intendedBehavior: JSON.parse((row.intended_behavior_json as string) ?? '[]') as string[],
      nonGoals: JSON.parse((row.non_goals_json as string) ?? '[]') as string[],
      pathsThatMustStillWork: JSON.parse((row.paths_that_must_still_work_json as string) ?? '[]') as string[],
      comparisonTargets: JSON.parse((row.comparison_targets_json as string) ?? '[]') as string[],
      regressionThresholds: JSON.parse((row.regression_thresholds_json as string) ?? '[]') as string[],
      rollbackConditions: JSON.parse((row.rollback_conditions_json as string) ?? '[]') as string[],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Component 18: Secrets Records ──────────────────────────────────────

  upsertSecretRecord(rec: SecretRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO secret_records (id, project_id, key_name, category, description, required_environments_json, sensitivity_level, source_of_truth, rotation_notes, approval_rules, code_references_json, stored_in_keytar, last_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        rec.id, rec.projectId, rec.keyName, rec.category, rec.description,
        JSON.stringify(rec.requiredEnvironments), rec.sensitivityLevel, rec.sourceOfTruth,
        rec.rotationNotes, rec.approvalRulesForChanges, JSON.stringify(rec.codeReferences),
        rec.storedInKeytar ? 1 : 0, rec.lastVerifiedAt, rec.createdAt, rec.updatedAt,
      ]
    );
    this.save();
  }

  listSecretRecords(projectId: string): SecretRecord[] {
    const result = this.db!.exec('SELECT * FROM secret_records WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToSecretRecord(r));
  }

  getSecretRecord(id: string): SecretRecord | null {
    const result = this.db!.exec('SELECT * FROM secret_records WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToSecretRecord(objs[0]);
  }

  deleteSecretRecord(id: string): void {
    this.db!.run('DELETE FROM secret_records WHERE id = ?', [id]);
    this.save();
  }

  getMissingSecretsForEnvironment(projectId: string, environmentId: string): SecretRecord[] {
    // For now, return all secrets for the project — future: filter by required_environments
    const all = this.listSecretRecords(projectId);
    // In a real implementation, we'd cross-reference with environment config
    return all.filter(s => s.requiredEnvironments.includes(environmentId));
  }

  getChangedSecretsSinceLastDeploy(projectId: string): SecretRecord[] {
    // Return secrets that have been recently verified or modified
    const all = this.listSecretRecords(projectId);
    return all.filter(s => s.lastVerifiedAt !== null);
  }

  verifySecret(id: string): { success: boolean; error?: string } {
    try {
      // Update last_verified_at timestamp
      this.db!.run(
        'UPDATE secret_records SET last_verified_at = ?, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), new Date().toISOString(), id]
      );
      this.save();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  getSecretInventorySummary(projectId: string): { total: number; missing: number; verified: number } {
    const all = this.listSecretRecords(projectId);
    return {
      total: all.length,
      missing: all.filter(s => !s.storedInKeytar).length,
      verified: all.filter(s => s.lastVerifiedAt !== null).length,
    };
  }

  private rowToSecretRecord(row: Record<string, unknown>): SecretRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      keyName: row.key_name as string,
      category: row.category as string,
      description: (row.description as string) ?? '',
      requiredEnvironments: JSON.parse((row.required_environments_json as string) ?? '[]') as string[],
      sensitivityLevel: (row.sensitivity_level as SecretRecord['sensitivityLevel']) ?? 'internal',
      sourceOfTruth: (row.source_of_truth as string) ?? '',
      rotationNotes: (row.rotation_notes as string) ?? '',
      approvalRulesForChanges: (row.approval_rules as string) ?? '',
      codeReferences: JSON.parse((row.code_references_json as string) ?? '[]') as string[],
      storedInKeytar: (row.stored_in_keytar as number) !== 0,
      lastVerifiedAt: (row.last_verified_at as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Component 18: Migration Plans ──────────────────────────────────────

  upsertMigrationPlan(plan: MigrationPlan): void {
    this.db!.run(
      'INSERT OR REPLACE INTO migration_plans (id, project_id, mission_id, risk_class, description, affected_tables_json, estimated_blast_radius, forward_compatible, backward_compatible, requires_checkpoint, checkpoint_id, safeguards_json, ordering_requirement, approval_required, rollback_constraints, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        plan.id, plan.projectId, plan.missionId, plan.riskClass, plan.description,
        JSON.stringify(plan.affectedTables), plan.estimatedBlastRadius,
        plan.forwardCompatible ? 1 : 0, plan.backwardCompatible ? 1 : 0,
        plan.requiresCheckpoint ? 1 : 0, plan.checkpointId,
        JSON.stringify(plan.safeguards), plan.orderingRequirement,
        plan.approvalRequired ? 1 : 0, plan.rollbackConstraints,
        plan.status, plan.createdAt, plan.updatedAt,
      ]
    );
    this.save();
  }

  getMigrationPlan(id: string): MigrationPlan | null {
    const result = this.db!.exec('SELECT * FROM migration_plans WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToMigrationPlan(objs[0]);
  }

  listMigrationPlans(projectId: string): MigrationPlan[] {
    const result = this.db!.exec('SELECT * FROM migration_plans WHERE project_id = ? ORDER BY created_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToMigrationPlan(r));
  }

  private rowToMigrationPlan(row: Record<string, unknown>): MigrationPlan {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      missionId: (row.mission_id as string) ?? null,
      riskClass: row.risk_class as MigrationRiskClass,
      description: row.description as string,
      affectedTables: JSON.parse((row.affected_tables_json as string) ?? '[]') as string[],
      estimatedBlastRadius: (row.estimated_blast_radius as MigrationPlan['estimatedBlastRadius']) ?? 'low',
      forwardCompatible: (row.forward_compatible as number) !== 0,
      backwardCompatible: (row.backward_compatible as number) !== 0,
      requiresCheckpoint: (row.requires_checkpoint as number) !== 0,
      checkpointId: (row.checkpoint_id as string) ?? null,
      safeguards: JSON.parse((row.safeguards_json as string) ?? '[]') as MigrationPlan['safeguards'],
      orderingRequirement: (row.ordering_requirement as MigrationPlan['orderingRequirement']) ?? 'schema-first',
      approvalRequired: (row.approval_required as number) !== 0,
      rollbackConstraints: (row.rollback_constraints as string) ?? '',
      status: (row.status as MigrationPlan['status']) ?? 'draft',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Component 18: Migration History ──────────────────────────────────────

  insertMigrationHistoryEntry(entry: MigrationHistoryEntry): void {
    this.db!.run(
      'INSERT INTO migration_history (id, project_id, plan_id, migration_name, risk_class, applied_at, applied_by, success, error, rollback_executed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        entry.id, entry.projectId, entry.planId, entry.migrationName,
        entry.riskClass, entry.appliedAt, entry.appliedBy,
        entry.success ? 1 : 0, entry.error, entry.rollbackExecuted ? 1 : 0,
      ]
    );
    this.save();
  }

  listMigrationHistory(projectId: string): MigrationHistoryEntry[] {
    const result = this.db!.exec('SELECT * FROM migration_history WHERE project_id = ? ORDER BY applied_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToMigrationHistoryEntry(r));
  }

  private rowToMigrationHistoryEntry(row: Record<string, unknown>): MigrationHistoryEntry {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      planId: row.plan_id as string,
      migrationName: row.migration_name as string,
      riskClass: row.risk_class as MigrationRiskClass,
      appliedAt: row.applied_at as string,
      appliedBy: (row.applied_by as string) ?? 'system',
      success: (row.success as number) !== 0,
      error: (row.error as string) ?? null,
      rollbackExecuted: (row.rollback_executed as number) !== 0,
    };
  }

  // ── Component 17: Deploy Workflows ──────────────────────────────────────

  upsertDeployWorkflow(wf: DeployWorkflow): void {
    this.db!.run(
      'INSERT OR REPLACE INTO deploy_workflows (id, candidate_id, environment_id, steps_json, status, verdict, verdict_reason, evidence_ids_json, started_at, completed_at, rollback_offered) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        wf.id, wf.candidateId, wf.environmentId, JSON.stringify(wf.steps),
        wf.status, wf.verdict, wf.verdictReason, JSON.stringify(wf.evidenceIds),
        wf.startedAt, wf.completedAt, wf.rollbackOffered ? 1 : 0,
      ]
    );
    this.save();
  }

  getDeployWorkflow(id: string): DeployWorkflow | null {
    const result = this.db!.exec('SELECT * FROM deploy_workflows WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToDeployWorkflow(objs[0]);
  }

  listDeployWorkflows(projectId: string): DeployWorkflow[] {
    // Join via environment_id to filter by project
    const result = this.db!.exec(
      'SELECT dw.* FROM deploy_workflows dw INNER JOIN environments e ON dw.environment_id = e.id WHERE e.project_id = ? ORDER BY dw.started_at DESC',
      [projectId]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToDeployWorkflow(r));
  }

  updateDeployWorkflowStatus(id: string, status: DeployWorkflow['status'], verdict?: string | null, verdictReason?: string | null, completedAt?: string | null, rollbackOffered?: boolean): void {
    this.db!.run(
      'UPDATE deploy_workflows SET status = ?, verdict = ?, verdict_reason = ?, completed_at = ?, rollback_offered = ? WHERE id = ?',
      [status, verdict ?? null, verdictReason ?? null, completedAt ?? null, rollbackOffered ? 1 : 0, id]
    );
    this.save();
  }

  private rowToDeployWorkflow(row: Record<string, unknown>): DeployWorkflow {
    return {
      id: row.id as string,
      candidateId: row.candidate_id as string,
      environmentId: row.environment_id as string,
      steps: JSON.parse((row.steps_json as string) ?? '[]') as DeployStep[],
      status: (row.status as DeployWorkflow['status']) ?? 'pending',
      verdict: (row.verdict as DeployWorkflow['verdict']) ?? null,
      verdictReason: (row.verdict_reason as string) ?? null,
      evidenceIds: JSON.parse((row.evidence_ids_json as string) ?? '[]') as string[],
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) ?? null,
      rollbackOffered: (row.rollback_offered as number) === 1,
    };
  }

  // ── Component 17: Drift Reports ─────────────────────────────────────────

  insertDriftReport(report: DriftReport): void {
    this.db!.run(
      'INSERT OR REPLACE INTO drift_reports (id, project_id, environment_id, drift_type, severity, description, detected_at, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        report.id, report.projectId, report.environmentId, report.driftType,
        report.severity, report.description, report.detectedAt, report.resolved ? 1 : 0,
      ]
    );
    this.save();
  }

  listDriftReports(projectId: string): DriftReport[] {
    const result = this.db!.exec('SELECT * FROM drift_reports WHERE project_id = ? ORDER BY detected_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToDriftReport(r));
  }

  resolveDriftReport(id: string): void {
    this.db!.run('UPDATE drift_reports SET resolved = 1 WHERE id = ?', [id]);
    this.save();
  }

  private rowToDriftReport(row: Record<string, unknown>): DriftReport {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      driftType: row.drift_type as DriftReport['driftType'],
      severity: row.severity as DriftReport['severity'],
      description: row.description as string,
      detectedAt: row.detected_at as string,
      resolved: (row.resolved as number) === 1,
    };
  }

  // ── Component 21: Watch Sessions ──────────────────────────────────────

  upsertWatchSession(session: WatchSession): void {
    this.db!.run(
      'INSERT OR REPLACE INTO watch_sessions (id, project_id, environment_id, deploy_workflow_id, status, started_at, completed_at, elevated_evidence, anomaly_threshold, regression_baseline, probes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        session.id, session.projectId, session.environmentId, session.deployWorkflowId,
        session.status, session.startedAt, session.completedAt,
        session.elevatedEvidence ? 1 : 0, session.anomalyThreshold,
        session.regressionBaseline, JSON.stringify(session.probes),
      ]
    );
    this.save();
  }

  getWatchSession(id: string): WatchSession | null {
    const result = this.db!.exec('SELECT * FROM watch_sessions WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToWatchSession(objs[0]);
  }

  listWatchSessions(projectId: string): WatchSession[] {
    const result = this.db!.exec('SELECT * FROM watch_sessions WHERE project_id = ? ORDER BY started_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToWatchSession(r));
  }

  listActiveWatchSessions(projectId: string): WatchSession[] {
    const result = this.db!.exec("SELECT * FROM watch_sessions WHERE project_id = ? AND status = 'active' ORDER BY started_at DESC", [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToWatchSession(r));
  }

  completeWatchSession(id: string): void {
    this.db!.run(
      'UPDATE watch_sessions SET status = ?, completed_at = ? WHERE id = ?',
      ['completed', new Date().toISOString(), id]
    );
    this.save();
  }

  private rowToWatchSession(row: Record<string, unknown>): WatchSession {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      deployWorkflowId: row.deploy_workflow_id as string,
      status: (row.status as WatchSession['status']) ?? 'active',
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) ?? null,
      elevatedEvidence: (row.elevated_evidence as number) !== 0,
      anomalyThreshold: (row.anomaly_threshold as WatchSession['anomalyThreshold']) ?? 'elevated',
      regressionBaseline: (row.regression_baseline as string) ?? null,
      probes: JSON.parse((row.probes_json as string) ?? '[]') as WatchProbe[],
    };
  }

  // ── Component 21: Anomaly Events ──────────────────────────────────────

  insertAnomalyEvent(event: AnomalyEvent): void {
    this.db!.run(
      'INSERT OR REPLACE INTO anomaly_events (id, project_id, environment_id, watch_session_id, anomaly_type, severity, description, correlated_deploy_workflow_id, correlated_change_ids_json, evidence_ids_json, detected_at, acknowledged, acknowledged_at, acknowledged_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        event.id, event.projectId, event.environmentId, event.watchSessionId,
        event.anomalyType, event.severity, event.description,
        event.correlatedDeployWorkflowId, JSON.stringify(event.correlatedChangeIds),
        JSON.stringify(event.evidenceIds), event.detectedAt,
        event.acknowledged ? 1 : 0, event.acknowledgedAt, event.acknowledgedBy,
      ]
    );
    this.save();
  }

  listAnomalyEvents(projectId: string): AnomalyEvent[] {
    const result = this.db!.exec('SELECT * FROM anomaly_events WHERE project_id = ? ORDER BY detected_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToAnomalyEvent(r));
  }

  acknowledgeAnomaly(id: string, acknowledgedBy: string): void {
    this.db!.run(
      'UPDATE anomaly_events SET acknowledged = 1, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?',
      [new Date().toISOString(), acknowledgedBy, id]
    );
    this.save();
  }

  private rowToAnomalyEvent(row: Record<string, unknown>): AnomalyEvent {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      watchSessionId: (row.watch_session_id as string) ?? null,
      anomalyType: row.anomaly_type as AnomalyEvent['anomalyType'],
      severity: (row.severity as IncidentSeverity) ?? 'low',
      description: row.description as string,
      correlatedDeployWorkflowId: (row.correlated_deploy_workflow_id as string) ?? null,
      correlatedChangeIds: JSON.parse((row.correlated_change_ids_json as string) ?? '[]') as string[],
      evidenceIds: JSON.parse((row.evidence_ids_json as string) ?? '[]') as string[],
      detectedAt: row.detected_at as string,
      acknowledged: (row.acknowledged as number) === 1,
      acknowledgedAt: (row.acknowledged_at as string) ?? null,
      acknowledgedBy: (row.acknowledged_by as string) ?? null,
    };
  }

  // ── Component 21: Self-Healing Actions ────────────────────────────────

  upsertSelfHealingAction(action: SelfHealingAction): void {
    this.db!.run(
      'INSERT OR REPLACE INTO self_healing_actions (id, project_id, environment_id, anomaly_event_id, incident_id, action_type, automatic, status, approval_required, approval_result, result, executed_at, audit_record_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        action.id, action.projectId, action.environmentId,
        action.anomalyEventId, action.incidentId, action.actionType,
        action.automatic ? 1 : 0, action.status,
        action.approvalRequired ? 1 : 0, action.approvalResult,
        action.result, action.executedAt, action.auditRecordId,
      ]
    );
    this.save();
  }

  listSelfHealingActions(projectId: string): SelfHealingAction[] {
    const result = this.db!.exec('SELECT * FROM self_healing_actions WHERE project_id = ? ORDER BY executed_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToSelfHealingAction(r));
  }

  updateSelfHealingStatus(id: string, status: SelfHealingAction['status'], result: string | null): void {
    this.db!.run(
      'UPDATE self_healing_actions SET status = ?, result = ?, executed_at = ? WHERE id = ?',
      [status, result, new Date().toISOString(), id]
    );
    this.save();
  }

  private rowToSelfHealingAction(row: Record<string, unknown>): SelfHealingAction {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      anomalyEventId: (row.anomaly_event_id as string) ?? null,
      incidentId: (row.incident_id as string) ?? null,
      actionType: row.action_type as SelfHealingAction['actionType'],
      automatic: (row.automatic as number) === 1,
      status: (row.status as SelfHealingAction['status']) ?? 'pending',
      approvalRequired: (row.approval_required as number) === 1,
      approvalResult: (row.approval_result as string) ?? null,
      result: (row.result as string) ?? null,
      executedAt: (row.executed_at as string) ?? null,
      auditRecordId: (row.audit_record_id as string) ?? null,
    };
  }

  // ── Component 21: Watch Dashboard (aggregate query) ───────────────────

  getWatchDashboard(projectId: string): {
    activeSessions: WatchSession[];
    recentAnomalies: AnomalyEvent[];
    openIncidents: Incident[];
    recentSelfHealingActions: SelfHealingAction[];
  } {
    const activeSessions = this.listActiveWatchSessions(projectId);
    const recentAnomalies = this.listAnomalyEvents(projectId).slice(0, 20);
    const openIncidents = this.listIncidents(projectId).filter((i) => i.status === 'open' || i.status === 'investigating');
    const recentSelfHealingActions = this.listSelfHealingActions(projectId).slice(0, 20);
    return { activeSessions, recentAnomalies, openIncidents, recentSelfHealingActions };
  }

  // ── Component 20: Memory Items ──────────────────────────────────────

  upsertMemoryItem(item: MemoryItem): void {
    this.db!.run(
      'INSERT OR REPLACE INTO memory_items (id, project_id, category, title, scope, tags_json, description, free_form_notes, examples_json, trigger_conditions_json, freshness_notes, source_material, owner, reviewer, last_reviewed_at, revision_history_json, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        item.id, item.projectId, item.category, item.title, item.scope,
        JSON.stringify(item.tags), item.description, item.freeFormNotes,
        JSON.stringify(item.examples), JSON.stringify(item.triggerConditions),
        item.freshnessNotes, item.sourceMaterial, item.owner, item.reviewer,
        item.lastReviewedAt, JSON.stringify(item.revisionHistory),
        item.isActive ? 1 : 0, item.createdAt, item.updatedAt,
      ]
    );
    this.save();
  }

  getMemoryItem(id: string): MemoryItem | null {
    const result = this.db!.exec('SELECT * FROM memory_items WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToMemoryItem(objs[0]);
  }

  listMemoryItems(projectId: string, filters?: { category?: MemoryCategory; activeOnly?: boolean }): MemoryItem[] {
    let sql = 'SELECT * FROM memory_items WHERE project_id = ?';
    const params: unknown[] = [projectId];
    if (filters?.category) { sql += ' AND category = ?'; params.push(filters.category); }
    if (filters?.activeOnly) { sql += ' AND is_active = 1'; }
    sql += ' ORDER BY updated_at DESC';
    const result = this.db!.exec(sql, params)[0];
    return this.toObjAll(result).map((r) => this.rowToMemoryItem(r));
  }

  searchMemoryItems(projectId: string, query: { tags?: string[]; category?: MemoryCategory; triggerMatch?: string }): MemoryItem[] {
    let sql = 'SELECT * FROM memory_items WHERE project_id = ? AND is_active = 1';
    const params: unknown[] = [projectId];
    if (query.category) { sql += ' AND category = ?'; params.push(query.category); }
    sql += ' ORDER BY updated_at DESC';
    const result = this.db!.exec(sql, params)[0];
    const all = this.toObjAll(result).map((r) => this.rowToMemoryItem(r));

    if (!query.tags?.length && !query.triggerMatch) return all;

    const searchTerms = [
      ...(query.tags ?? []),
      ...(query.triggerMatch ? query.triggerMatch.toLowerCase().split(/\s+/) : []),
    ];
    return all
      .map(item => {
        let score = 0;
        for (const term of searchTerms) {
          if (item.tags.some(t => t.toLowerCase().includes(term))) score += 2;
          if (item.triggerConditions.some(t => t.toLowerCase().includes(term))) score += 1;
          if (item.title.toLowerCase().includes(term)) score += 3;
          if (item.description.toLowerCase().includes(term)) score += 1;
        }
        return { item, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);
  }

  retireMemoryItem(id: string): void {
    this.db!.run('UPDATE memory_items SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    this.save();
  }

  reactivateMemoryItem(id: string): void {
    this.db!.run('UPDATE memory_items SET is_active = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    this.save();
  }

  getStaleMemories(projectId: string, daysThreshold: number = 30): MemoryItem[] {
    const cutoff = new Date(Date.now() - daysThreshold * 86400000).toISOString();
    const result = this.db!.exec(
      "SELECT * FROM memory_items WHERE project_id = ? AND is_active = 1 AND (last_reviewed_at IS NULL OR last_reviewed_at < ?) ORDER BY last_reviewed_at ASC",
      [projectId, cutoff]
    )[0];
    return this.toObjAll(result).map((r) => this.rowToMemoryItem(r));
  }

  getMemoryDashboard(projectId: string): {
    totalMemories: number;
    memoriesByCategory: Record<string, number>;
    activeMemories: number;
    retiredMemories: number;
    staleMemories: number;
    totalSkills: number;
    activeSkills: number;
    totalDecisions: number;
    activeDecisions: number;
    lastWriteAt: string | null;
    lastReviewAt: string | null;
  } {
    const all = this.listMemoryItems(projectId);
    const stale = this.getStaleMemories(projectId);
    const skills = this.listSkills(projectId);
    const decisions = this.listDecisionRecords(projectId);

    const memoriesByCategory: Record<string, number> = {};
    for (const item of all) {
      memoriesByCategory[item.category] = (memoriesByCategory[item.category] ?? 0) + 1;
    }

    const activeItems = all.filter(i => i.isActive);
    const reviewDates = activeItems.map(i => i.lastReviewedAt).filter(Boolean) as string[];
    const updateDates = all.map(i => i.updatedAt).filter(Boolean) as string[];

    return {
      totalMemories: all.length,
      memoriesByCategory,
      activeMemories: activeItems.length,
      retiredMemories: all.length - activeItems.length,
      staleMemories: stale.length,
      totalSkills: skills.length,
      activeSkills: skills.filter(s => s.isActive).length,
      totalDecisions: decisions.length,
      activeDecisions: decisions.filter(d => d.isActive).length,
      lastWriteAt: updateDates.length > 0 ? updateDates.sort().reverse()[0] : null,
      lastReviewAt: reviewDates.length > 0 ? reviewDates.sort().reverse()[0] : null,
    };
  }

  private rowToMemoryItem(row: Record<string, unknown>): MemoryItem {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      category: row.category as MemoryCategory,
      title: row.title as string,
      scope: (row.scope as string) ?? '',
      tags: JSON.parse((row.tags_json as string) ?? '[]') as string[],
      description: (row.description as string) ?? '',
      freeFormNotes: (row.free_form_notes as string) ?? null,
      examples: JSON.parse((row.examples_json as string) ?? '[]') as string[],
      triggerConditions: JSON.parse((row.trigger_conditions_json as string) ?? '[]') as string[],
      freshnessNotes: (row.freshness_notes as string) ?? null,
      sourceMaterial: (row.source_material as string) ?? null,
      owner: (row.owner as string) ?? null,
      reviewer: (row.reviewer as string) ?? null,
      lastReviewedAt: (row.last_reviewed_at as string) ?? null,
      revisionHistory: JSON.parse((row.revision_history_json as string) ?? '[]') as MemoryRevision[],
      isActive: (row.is_active as number) === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Component 20: Skills ────────────────────────────────────────────

  upsertSkill(skill: Skill): void {
    this.db!.run(
      'INSERT OR REPLACE INTO skills (id, project_id, title, description, category, steps_json, trigger_conditions_json, version, version_history_json, owner, reviewer, last_reviewed_at, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        skill.id, skill.projectId, skill.title, skill.description, skill.category,
        JSON.stringify(skill.steps), JSON.stringify(skill.triggerConditions),
        skill.version, JSON.stringify(skill.versionHistory),
        skill.owner, skill.reviewer, skill.lastReviewedAt,
        skill.isActive ? 1 : 0, skill.createdAt, skill.updatedAt,
      ]
    );
    this.save();
  }

  getSkill(id: string): Skill | null {
    const result = this.db!.exec('SELECT * FROM skills WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToSkill(objs[0]);
  }

  listSkills(projectId: string, activeOnly?: boolean): Skill[] {
    let sql = 'SELECT * FROM skills WHERE project_id = ?';
    const params: unknown[] = [projectId];
    if (activeOnly) { sql += ' AND is_active = 1'; }
    sql += ' ORDER BY updated_at DESC';
    const result = this.db!.exec(sql, params)[0];
    return this.toObjAll(result).map((r) => this.rowToSkill(r));
  }

  invokeSkill(id: string): Skill | null {
    const skill = this.getSkill(id);
    if (!skill) return null;
    skill.version += 1;
    skill.updatedAt = new Date().toISOString();
    this.upsertSkill(skill);
    return skill;
  }

  private rowToSkill(row: Record<string, unknown>): Skill {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      description: (row.description as string) ?? '',
      category: (row.category as MemoryCategory) ?? 'skill-runbook',
      steps: JSON.parse((row.steps_json as string) ?? '[]') as SkillStep[],
      triggerConditions: JSON.parse((row.trigger_conditions_json as string) ?? '[]') as string[],
      version: (row.version as number) ?? 1,
      versionHistory: JSON.parse((row.version_history_json as string) ?? '[]') as SkillVersionEntry[],
      owner: (row.owner as string) ?? null,
      reviewer: (row.reviewer as string) ?? null,
      lastReviewedAt: (row.last_reviewed_at as string) ?? null,
      isActive: (row.is_active as number) === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Component 20: Decision Records ──────────────────────────────────

  upsertDecisionRecord(record: DecisionRecord): void {
    this.db!.run(
      'INSERT OR REPLACE INTO decision_records (id, project_id, decision_number, title, date, decided_by, decision, alternatives_json, rationale, consequences_json, related_files_json, tags_json, is_active, superseded_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.projectId, record.decisionNumber, record.title, record.date,
        record.decidedBy, record.decision, JSON.stringify(record.alternativesConsidered),
        record.rationale, JSON.stringify(record.consequences),
        JSON.stringify(record.relatedFiles), JSON.stringify(record.tags),
        record.isActive ? 1 : 0, record.supersededBy,
        record.createdAt, record.updatedAt,
      ]
    );
    this.save();
  }

  getDecisionRecord(id: string): DecisionRecord | null {
    const result = this.db!.exec('SELECT * FROM decision_records WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToDecisionRecord(objs[0]);
  }

  listDecisionRecords(projectId: string, activeOnly?: boolean): DecisionRecord[] {
    let sql = 'SELECT * FROM decision_records WHERE project_id = ?';
    const params: unknown[] = [projectId];
    if (activeOnly) { sql += ' AND is_active = 1'; }
    sql += ' ORDER BY decision_number DESC';
    const result = this.db!.exec(sql, params)[0];
    return this.toObjAll(result).map((r) => this.rowToDecisionRecord(r));
  }

  getDecisionByNumber(projectId: string, number: number): DecisionRecord | null {
    const result = this.db!.exec(
      'SELECT * FROM decision_records WHERE project_id = ? AND decision_number = ?',
      [projectId, number]
    )[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToDecisionRecord(objs[0]);
  }

  supersedeDecision(id: string, supersededBy: string): void {
    this.db!.run(
      'UPDATE decision_records SET is_active = 0, superseded_by = ?, updated_at = ? WHERE id = ?',
      [supersededBy, new Date().toISOString(), id]
    );
    this.save();
  }

  private rowToDecisionRecord(row: Record<string, unknown>): DecisionRecord {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      decisionNumber: row.decision_number as number,
      title: row.title as string,
      date: row.date as string,
      decidedBy: (row.decided_by as string) ?? '',
      decision: (row.decision as string) ?? '',
      alternativesConsidered: JSON.parse((row.alternatives_json as string) ?? '[]') as Array<{ option: string; reason: string }>,
      rationale: (row.rationale as string) ?? '',
      consequences: JSON.parse((row.consequences_json as string) ?? '[]') as string[],
      relatedFiles: JSON.parse((row.related_files_json as string) ?? '[]') as string[],
      tags: JSON.parse((row.tags_json as string) ?? '[]') as string[],
      isActive: (row.is_active as number) === 1,
      supersededBy: (row.superseded_by as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Mode config update (from remote merge) ──────────────────────────

  updateModeConfig(id: string, temperature: number, approvalPolicy: string, fallbackModelId: string | null): void {
    this.db!.run(
      'UPDATE modes SET temperature = ?, approval_policy = ?, fallback_model_id = ?, updated_at = ? WHERE id = ?',
      [temperature, approvalPolicy, fallbackModelId, new Date().toISOString(), id]
    );
    this.save();
  }

  // ── DevOps Templates (from remote merge) ────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listDevOpsTemplates(): any[] {
    const result = this.db!.exec('SELECT * FROM devops_templates ORDER BY name ASC')[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.toObjAll(result).map((r: any) => ({
      id: r.id, name: r.name, description: r.description,
      branchStrategy: r.branch_strategy, buildTool: r.build_tool,
      registry: r.registry, imageName: r.image_name,
      imageTags: JSON.parse(r.image_tags || '[]'),
      deployTargetType: r.deploy_target_type,
      triggerMethod: r.trigger_method,
      requiredSecrets: JSON.parse(r.required_secrets || '[]'),
      plainEnglishExplanation: r.plain_english_explanation,
      isBuiltIn: r.is_built_in === 1,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertDevOpsTemplate(t: any): void {
    const now = new Date().toISOString();
    this.db!.run(
      'INSERT OR REPLACE INTO devops_templates (id, name, description, branch_strategy, build_tool, registry, image_name, image_tags, deploy_target_type, trigger_method, required_secrets, plain_english_explanation, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [t.id, t.name, t.description, t.branchStrategy, t.buildTool, t.registry, t.imageName, JSON.stringify(t.imageTags), t.deployTargetType, t.triggerMethod, JSON.stringify(t.requiredSecrets), t.plainEnglishExplanation, t.isBuiltIn ? 1 : 0, t.createdAt || now, now]
    );
    this.save();
  }

  deleteDevOpsTemplate(id: string): void {
    this.db!.run('DELETE FROM devops_templates WHERE id = ? AND is_built_in = 0', [id]);
    this.save();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seedDevOpsTemplates(templates: any[]): void {
    const existing = this.listDevOpsTemplates();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingIds = new Set(existing.map((t: any) => t.id));
    for (const t of templates) {
      if (!existingIds.has(t.id)) this.upsertDevOpsTemplate(t);
    }
  }

  // ── SSH Targets (from remote merge) ─────────────────────────────────

  listSshTargets(projectId: string | null): SshTarget[] {
    const result = projectId
      ? this.db!.exec('SELECT * FROM ssh_targets WHERE project_id = ? OR project_id IS NULL ORDER BY name ASC', [projectId])[0]
      : this.db!.exec('SELECT * FROM ssh_targets ORDER BY name ASC')[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.toObjAll(result).map((r: any) => ({
      id: r.id, userId: r.user_id, projectId: r.project_id ?? null,
      name: r.name, hostname: r.hostname, username: r.username,
      port: r.port, identityFile: r.identity_file ?? null, createdAt: r.created_at,
    }));
  }

  insertSshTarget(t: SshTarget): void {
    this.db!.run(
      'INSERT INTO ssh_targets (id, user_id, project_id, name, hostname, username, port, identity_file, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [t.id, t.userId, t.projectId, t.name, t.hostname, t.username, t.port, t.identityFile, t.createdAt]
    );
    this.save();
  }

  upsertSshTarget(t: SshTarget): void {
    this.db!.run(
      'INSERT OR REPLACE INTO ssh_targets (id, user_id, project_id, name, hostname, username, port, identity_file, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [t.id, t.userId, t.projectId, t.name, t.hostname, t.username, t.port, t.identityFile, t.createdAt]
    );
    this.save();
  }

  deleteSshTarget(id: string): void {
    this.db!.run('DELETE FROM ssh_targets WHERE id = ?', [id]);
    this.save();
  }

  // ── MCP Connections (from remote merge) ──────────────────────────────

  listMcpConnections(projectId: string | null): McpConnection[] {
    const result = projectId
      ? this.db!.exec('SELECT * FROM mcp_connections WHERE project_id = ? OR scope = ? ORDER BY name ASC', [projectId, 'global'])[0]
      : this.db!.exec('SELECT * FROM mcp_connections ORDER BY name ASC')[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.toObjAll(result).map((r: any) => ({
      id: r.id, userId: r.user_id, projectId: r.project_id ?? null,
      name: r.name, command: r.command, args: JSON.parse(r.args || '[]'),
      enabled: r.enabled === 1, scope: r.scope as 'global' | 'project',
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  insertMcpConnection(m: McpConnection): void {
    this.db!.run(
      'INSERT INTO mcp_connections (id, user_id, project_id, name, command, args, enabled, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [m.id, m.userId, m.projectId, m.name, m.command, JSON.stringify(m.args), m.enabled ? 1 : 0, m.scope, m.createdAt, m.updatedAt]
    );
    this.save();
  }

  updateMcpConnection(id: string, updates: Partial<McpConnection>): void {
    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.command !== undefined) { fields.push('command = ?'); values.push(updates.command); }
    if (updates.args !== undefined) { fields.push('args = ?'); values.push(JSON.stringify(updates.args)); }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    if (updates.scope !== undefined) { fields.push('scope = ?'); values.push(updates.scope); }
    fields.push('updated_at = ?'); values.push(new Date().toISOString());
    values.push(id);
    this.db!.run(`UPDATE mcp_connections SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  deleteMcpConnection(id: string): void {
    this.db!.run('DELETE FROM mcp_connections WHERE id = ?', [id]);
    this.save();
  }

  // ── Mission Lifecycle State (Phase 1 wiring) ─────────────────────────────

  upsertMissionLifecycleState(state: MissionLifecycleState): void {
    this.db!.run(
      `INSERT INTO mission_lifecycle_state
         (mission_id, current_step, lifecycle_status, risk_assessment_json,
          workspace_run_id, verification_run_id, deploy_workflow_id,
          watch_session_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(mission_id) DO UPDATE SET
         current_step        = excluded.current_step,
         lifecycle_status    = excluded.lifecycle_status,
         risk_assessment_json = excluded.risk_assessment_json,
         workspace_run_id    = excluded.workspace_run_id,
         verification_run_id = excluded.verification_run_id,
         deploy_workflow_id  = excluded.deploy_workflow_id,
         watch_session_id    = excluded.watch_session_id,
         updated_at          = excluded.updated_at`,
      [
        state.missionId,
        state.currentStep,
        state.lifecycleStatus,
        state.riskAssessment !== null ? JSON.stringify(state.riskAssessment) : null,
        state.workspaceRunId,
        state.verificationRunId,
        state.deployWorkflowId,
        state.watchSessionId,
        state.updatedAt,
      ]
    );
    this.save();
  }

  getMissionLifecycleState(missionId: string): MissionLifecycleState | null {
    const result = this.db!.exec(
      'SELECT * FROM mission_lifecycle_state WHERE mission_id = ?',
      [missionId]
    )[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    const row = objs[0];
    return {
      missionId: row.mission_id as string,
      currentStep: (row.current_step as number) ?? 1,
      lifecycleStatus: (row.lifecycle_status as MissionLifecycleStatus) ?? 'idle',
      riskAssessment: row.risk_assessment_json
        ? JSON.parse(row.risk_assessment_json as string)
        : null,
      workspaceRunId: (row.workspace_run_id as string) ?? null,
      verificationRunId: (row.verification_run_id as string) ?? null,
      deployWorkflowId: (row.deploy_workflow_id as string) ?? null,
      watchSessionId: (row.watch_session_id as string) ?? null,
      updatedAt: row.updated_at as string,
    };
  }
}
