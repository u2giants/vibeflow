/** Local SQLite cache using better-sqlite3 (synchronous, file-backed). */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type { Mode, ApprovalPolicy } from '../shared-types';

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

export class LocalDb {
  private db: Database.Database | null = null;
  private dbPath: string;

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

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db!.exec(`
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
    `);
  }

  // ── Project CRUD ──────────────────────────────────────────────

  listProjects(userId: string): Project[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
    );
    const rows = stmt.all(userId) as Array<Record<string, unknown>>;
    return rows.map(rowToProject);
  }

  insertProject(project: Project): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO projects
       (id, user_id, name, description, is_self_maintenance, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      project.id,
      project.userId,
      project.name,
      project.description,
      project.isSelfMaintenance ? 1 : 0,
      project.createdAt,
      project.updatedAt,
      project.syncedAt
    );
  }

  // ── Mode CRUD ───────────────────────────────────────────────────

  listModes(): Mode[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM modes ORDER BY slug');
    const rows = stmt.all() as Array<Record<string, unknown>>;
    return rows.map(rowToMode);
  }

  getMode(id: string): Mode | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM modes WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToMode(row) : null;
  }

  upsertMode(mode: Mode): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO modes
       (id, slug, name, description, icon, color, soul, model_id, fallback_model_id,
        temperature, approval_policy, is_built_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      mode.id,
      mode.slug,
      mode.name,
      mode.description,
      mode.icon,
      mode.color,
      mode.soul,
      mode.modelId,
      mode.fallbackModelId,
      mode.temperature,
      mode.approvalPolicy,
      mode.isBuiltIn ? 1 : 0,
      mode.createdAt,
      mode.updatedAt
    );
  }

  updateModeSoul(id: string, soul: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      'UPDATE modes SET soul = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(soul, new Date().toISOString(), id);
  }

  updateModeModel(id: string, modelId: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      'UPDATE modes SET model_id = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(modelId, new Date().toISOString(), id);
  }

  seedDefaultModes(modes: Omit<Mode, 'createdAt' | 'updatedAt'>[]): void {
    if (!this.db) return;
    // Only seed if the table is empty
    const count = this.db.prepare('SELECT COUNT(*) as count FROM modes').get() as { count: number };
    if (count.count > 0) return;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT INTO modes
       (id, slug, name, description, icon, color, soul, model_id, fallback_model_id,
        temperature, approval_policy, is_built_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = this.db.transaction((modeList: typeof modes) => {
      for (const m of modeList) {
        stmt.run(
          m.id,
          m.slug,
          m.name,
          m.description,
          m.icon,
          m.color,
          m.soul,
          m.modelId,
          m.fallbackModelId,
          m.temperature,
          m.approvalPolicy,
          m.isBuiltIn ? 1 : 0,
          now,
          now
        );
      }
    });

    insertMany(modes);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    isSelfMaintenance: (row.is_self_maintenance as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: (row.synced_at as string) ?? null,
  };
}

function rowToMode(row: Record<string, unknown>): Mode {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    icon: row.icon as string,
    color: row.color as string,
    soul: row.soul as string,
    modelId: row.model_id as string,
    fallbackModelId: (row.fallback_model_id as string) ?? null,
    temperature: row.temperature as number,
    approvalPolicy: row.approval_policy as ApprovalPolicy,
    isBuiltIn: (row.is_built_in as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
