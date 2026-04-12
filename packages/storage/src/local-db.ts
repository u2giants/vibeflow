/** Local SQLite cache using better-sqlite3 (synchronous, file-backed). */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Minimal Project type (mirrors @vibeflow/shared-types)
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
