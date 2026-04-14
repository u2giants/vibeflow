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
  Environment, EnvironmentType,
  McpServerConfig, McpToolInfo,
  ProjectIndex, FileRecord, SymbolRecord, ReferenceEdge, RouteRecord, ApiEndpointRecord, JobRecord,
  ServiceNode, ServiceEdge, ConfigVariableRecord,
  ContextPackEnriched, ContextItem, ContextWarning,
  WorkspaceRun, FileEdit, SemanticChangeGroup, Checkpoint, ChangeSet, DuplicateWarning, PatternReuseSuggestion,
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
}

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_self_maintenance: number;
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

    // Initialize sql.js
    // __dirname in bundled main process is apps/desktop/out/main
    // node_modules is at repo root: D:\repos\vibeflow\node_modules
    // Need to go up 4 levels: out/main -> out -> desktop -> apps -> vibeflow
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    this.sqlJsModule = await initSqlJs({
      locateFile: (file: string) => path.join(repoRoot, 'node_modules', 'sql.js', 'dist', file),
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
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_self_maintenance INTEGER DEFAULT 0,
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
    `);
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  // ── Settings ────────────────────────────────────────────────────────

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
      'INSERT OR REPLACE INTO projects (id, user_id, name, description, is_self_maintenance, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [project.id, project.userId, project.name, project.description, project.isSelfMaintenance ? 1 : 0, project.createdAt, project.updatedAt, project.syncedAt]
    );
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
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
      'INSERT OR REPLACE INTO incidents (id, project_id, title, severity, description, status, detected_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [incident.id, incident.projectId, incident.title, incident.severity, incident.description, incident.status, incident.detectedAt, incident.resolvedAt]
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
    };
  }

  // ── Deploy Candidates ───────────────────────────────────────────────

  listDeployCandidates(projectId: string): DeployCandidate[] {
    const result = this.db!.exec('SELECT * FROM deploy_candidates WHERE project_id = ? ORDER BY deployed_at DESC', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToDeployCandidate(r));
  }

  upsertDeployCandidate(candidate: DeployCandidate): void {
    this.db!.run(
      'INSERT OR REPLACE INTO deploy_candidates (id, project_id, environment_id, commit_sha, version, status, deployed_at, deployed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [candidate.id, candidate.projectId, candidate.environmentId, candidate.commitSha, candidate.version, candidate.status, candidate.deployedAt, candidate.deployedBy]
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
      'INSERT OR REPLACE INTO environments (id, project_id, name, type, current_version, secrets_complete, service_health, branch_mapping) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [env.id, env.projectId, env.name, env.type, env.currentVersion, env.secretsComplete ? 1 : 0, env.serviceHealth, env.branchMapping]
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
}
