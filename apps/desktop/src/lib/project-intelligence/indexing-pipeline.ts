/**
 * IndexingPipeline — scans project files, classifies them, extracts symbols,
 * builds import/export dependency graphs, and persists the index.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  ProjectIndex, FileRecord, SymbolRecord, ReferenceEdge,
  RouteRecord, ApiEndpointRecord, JobRecord,
} from '../shared-types';
import type { LocalDb } from '../storage/local-db';

/** Languages we can extract symbols from. */
const SUPPORTED_LANGUAGES = new Set(['typescript', 'javascript', 'tsx', 'jsx']);

/** File extensions mapped to language names. */
const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.mts': 'typescript',
  '.cts': 'typescript',
};

/** Directories to skip during scanning. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next',
  '.vite', '.cache', 'coverage', '.turbo', '.nx',
]);

/** Generated directory patterns. */
const GENERATED_DIR_PATTERNS = ['generated', 'dist', 'build', 'out', '.next'];

/** Protected path patterns. */
const PROTECTED_PATH_PATTERNS = ['.env', 'secrets', 'credentials', 'key', 'token'];

export class IndexingPipeline {
  private db: LocalDb;
  private projectId: string;
  private repoRoot: string;
  private onProgress?: (current: number, total: number) => void;

  constructor(db: LocalDb, projectId: string, repoRoot: string, onProgress?: (current: number, total: number) => void) {
    this.db = db;
    this.projectId = projectId;
    this.repoRoot = repoRoot;
    this.onProgress = onProgress;
  }

  /** Run a full index of the project. */
  async run(options?: { fullReindex: boolean }): Promise<{ fileCount: number }> {
    if (options?.fullReindex) {
      // Clear existing index
      this.db.deleteFileRecordsForProject(this.projectId);
      this.db.deleteReferenceEdgesForProject(this.projectId);
    }

    // Scan files
    const files = this.scanFiles(this.repoRoot);
    const totalFiles = files.length;

    // Detect package manager, build/test commands, lockfiles
    const indexMeta = this.detectProjectMeta();

    // Create project index
    const projectIndex: ProjectIndex = {
      id: `idx-${this.projectId}`,
      projectId: this.projectId,
      repoRoot: this.repoRoot,
      branch: this.detectBranch(),
      packageManager: indexMeta.packageManager,
      buildCommand: indexMeta.buildCommand,
      testCommand: indexMeta.testCommand,
      lockfiles: indexMeta.lockfiles,
      monorepoPackages: indexMeta.monorepoPackages,
      generatedDirs: indexMeta.generatedDirs,
      protectedPaths: indexMeta.protectedPaths,
      indexedAt: new Date().toISOString(),
      staleness: 'fresh',
    };
    this.db.upsertProjectIndex(projectIndex);

    // Process each file
    let processed = 0;
    const fileRecords: FileRecord[] = [];
    const allSymbols: SymbolRecord[] = [];
    const allEdges: ReferenceEdge[] = [];

    for (const filePath of files) {
      const relPath = path.relative(this.repoRoot, filePath);
      const ext = path.extname(filePath).toLowerCase();
      const lang = EXT_TO_LANG[ext] ?? this.detectLanguage(filePath);

      const fileRecord: FileRecord = {
        id: `file-${this.projectId}-${relPath.replace(/[/\\]/g, '_')}`,
        projectId: this.projectId,
        path: relPath,
        language: lang,
        sizeBytes: this.getFileSize(filePath),
        isGenerated: this.isGeneratedPath(relPath),
        isProtected: this.isProtectedPath(relPath),
        lastModified: this.getFileModified(filePath),
        indexedAt: new Date().toISOString(),
      };

      this.db.upsertFileRecord(fileRecord);
      fileRecords.push(fileRecord);

      // Extract symbols for supported languages
      if (SUPPORTED_LANGUAGES.has(lang)) {
        const { symbols, edges } = this.extractSymbolsAndEdges(filePath, relPath, fileRecord.id);
        allSymbols.push(...symbols);
        allEdges.push(...edges);
      }

      processed++;
      this.onProgress?.(processed, totalFiles);
    }

    // Persist symbols and edges
    for (const sym of allSymbols) {
      this.db.upsertSymbolRecord(sym);
    }
    for (const edge of allEdges) {
      this.db.upsertReferenceEdge(edge);
    }

    // Extract routes, API endpoints, jobs
    this.extractRoutes(fileRecords);
    this.extractJobs(fileRecords);

    return { fileCount: totalFiles };
  }

  /** Recursively scan directory for files. */
  private scanFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        results.push(...this.scanFiles(fullPath));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /** Detect project metadata from package.json and other config files. */
  private detectProjectMeta(): {
    packageManager: string | null;
    buildCommand: string | null;
    testCommand: string | null;
    lockfiles: string[];
    monorepoPackages: string[];
    generatedDirs: string[];
    protectedPaths: string[];
  } {
    const lockfiles: string[] = [];
    if (fs.existsSync(path.join(this.repoRoot, 'pnpm-lock.yaml'))) lockfiles.push('pnpm-lock.yaml');
    if (fs.existsSync(path.join(this.repoRoot, 'package-lock.json'))) lockfiles.push('package-lock.json');
    if (fs.existsSync(path.join(this.repoRoot, 'yarn.lock'))) lockfiles.push('yarn.lock');

    const packageManager = lockfiles.includes('pnpm-lock.yaml') ? 'pnpm'
      : lockfiles.includes('yarn.lock') ? 'yarn'
      : lockfiles.includes('package-lock.json') ? 'npm'
      : null;

    let buildCommand: string | null = null;
    let testCommand: string | null = null;
    const monorepoPackages: string[] = [];

    const pkgPath = path.join(this.repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.build) buildCommand = pkg.scripts.build;
        if (pkg.scripts?.test) testCommand = pkg.scripts.test;
        if (pkg.workspaces && Array.isArray(pkg.workspaces)) {
          monorepoPackages.push(...pkg.workspaces);
        }
      } catch { /* ignore parse errors */ }
    }

    // Check for pnpm-workspace.yaml
    if (fs.existsSync(path.join(this.repoRoot, 'pnpm-workspace.yaml'))) {
      try {
        const content = fs.readFileSync(path.join(this.repoRoot, 'pnpm-workspace.yaml'), 'utf-8');
        const packagesMatch = content.match(/packages:\s*\n((?:\s+- .+\n?)+)/);
        if (packagesMatch) {
          const packages = packagesMatch[1].split('\n')
            .map((l: string) => l.trim().replace(/^- /, ''))
            .filter((l: string) => l);
          monorepoPackages.push(...packages);
        }
      } catch { /* ignore */ }
    }

    const generatedDirs = GENERATED_DIR_PATTERNS.filter(p =>
      fs.existsSync(path.join(this.repoRoot, p))
    );

    const protectedPaths = PROTECTED_PATH_PATTERNS.filter(p =>
      fs.existsSync(path.join(this.repoRoot, p))
    );

    return { packageManager, buildCommand, testCommand, lockfiles, monorepoPackages, generatedDirs, protectedPaths };
  }

  /** Detect current git branch. */
  private detectBranch(): string | null {
    try {
      const { execSync } = require('child_process');
      return execSync('git branch --show-current', { cwd: this.repoRoot, timeout: 5000 }).toString().trim();
    } catch {
      return null;
    }
  }

  /** Detect language from file content (fallback). */
  private detectLanguage(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('import ') || content.includes('export ') || content.includes('interface ') || content.includes('type ')) {
        return 'typescript';
      }
      if (content.includes('require(') || content.includes('module.exports')) {
        return 'javascript';
      }
    } catch { /* ignore */ }
    return 'unknown';
  }

  /** Check if a path looks like generated output. */
  private isGeneratedPath(relPath: string): boolean {
    return GENERATED_DIR_PATTERNS.some(p => relPath.includes(p));
  }

  /** Check if a path looks like it contains secrets. */
  private isProtectedPath(relPath: string): boolean {
    return PROTECTED_PATH_PATTERNS.some(p => relPath.toLowerCase().includes(p));
  }

  /** Get file size in bytes. */
  private getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  /** Get file last modified time. */
  private getFileModified(filePath: string): string | null {
    try {
      return fs.statSync(filePath).mtime.toISOString();
    } catch {
      return null;
    }
  }

  /** Extract symbols and reference edges from a file. */
  private extractSymbolsAndEdges(
    filePath: string,
    relPath: string,
    fileId: string
  ): { symbols: SymbolRecord[]; edges: ReferenceEdge[] } {
    const symbols: SymbolRecord[] = [];
    const edges: ReferenceEdge[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Extract imports
      const importRegex = /^(?:import\s+(?:type\s+)?(?:\{[^}]+\}|[\w]+)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"])/gm;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        const targetFileId = this.resolveImportPath(importPath, filePath);
        if (targetFileId) {
          edges.push({
            id: `edge-${fileId}-${importPath.replace(/[/\\]/g, '_')}`,
            projectId: this.projectId,
            sourceFileId: fileId,
            targetFileId,
            sourceSymbolId: null,
            targetSymbolId: null,
            referenceType: 'import',
          });
        }
      }

      // Extract exports
      const exportRegex = /^(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+)(\w+)/gm;
      while ((match = exportRegex.exec(content)) !== null) {
        const name = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        symbols.push({
          id: `sym-${fileId}-${name}`,
          projectId: this.projectId,
          fileId,
          filePath: relPath,
          name,
          kind: this.detectSymbolKind(match[0]),
          exportType: match[0].includes('default') ? 'default' : 'named',
          lineStart: lineNum,
          lineEnd: null,
          signature: null,
          docComment: null,
        });
      }

      // Extract function declarations (non-exported)
      const funcRegex = /^(?:async\s+)?function\s+(\w+)\s*\(/gm;
      while ((match = funcRegex.exec(content)) !== null) {
        const name = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        symbols.push({
          id: `sym-${fileId}-func-${name}`,
          projectId: this.projectId,
          fileId,
          filePath: relPath,
          name,
          kind: 'function',
          exportType: 'none',
          lineStart: lineNum,
          lineEnd: null,
          signature: null,
          docComment: null,
        });
      }

      // Extract class declarations
      const classRegex = /^class\s+(\w+)/gm;
      while ((match = classRegex.exec(content)) !== null) {
        const name = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        symbols.push({
          id: `sym-${fileId}-class-${name}`,
          projectId: this.projectId,
          fileId,
          filePath: relPath,
          name,
          kind: 'class',
          exportType: 'none',
          lineStart: lineNum,
          lineEnd: null,
          signature: null,
          docComment: null,
        });
      }

      // Extract interface declarations
      const interfaceRegex = /^interface\s+(\w+)/gm;
      while ((match = interfaceRegex.exec(content)) !== null) {
        const name = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        symbols.push({
          id: `sym-${fileId}-iface-${name}`,
          projectId: this.projectId,
          fileId,
          filePath: relPath,
          name,
          kind: 'interface',
          exportType: 'none',
          lineStart: lineNum,
          lineEnd: null,
          signature: null,
          docComment: null,
        });
      }

      // Extract type declarations
      const typeRegex = /^type\s+(\w+)/gm;
      while ((match = typeRegex.exec(content)) !== null) {
        const name = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        symbols.push({
          id: `sym-${fileId}-type-${name}`,
          projectId: this.projectId,
          fileId,
          filePath: relPath,
          name,
          kind: 'type',
          exportType: 'none',
          lineStart: lineNum,
          lineEnd: null,
          signature: null,
          docComment: null,
        });
      }

      // Extract constant declarations
      const constRegex = /^export\s+const\s+(\w+)/gm;
      while ((match = constRegex.exec(content)) !== null) {
        const name = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;
        symbols.push({
          id: `sym-${fileId}-const-${name}`,
          projectId: this.projectId,
          fileId,
          filePath: relPath,
          name,
          kind: 'constant',
          exportType: 'named',
          lineStart: lineNum,
          lineEnd: null,
          signature: null,
          docComment: null,
        });
      }

    } catch { /* ignore read errors */ }

    return { symbols, edges };
  }

  /** Resolve an import path to a file ID. */
  private resolveImportPath(importPath: string, fromFile: string): string | null {
    // Skip external modules (no relative or absolute path)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null; // external module
    }

    const fromDir = path.dirname(fromFile);
    let resolved = path.resolve(fromDir, importPath);

    // Try adding .ts, .tsx, .js, .jsx extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate)) {
        const relPath = path.relative(this.repoRoot, candidate);
        return `file-${this.projectId}-${relPath.replace(/[/\\]/g, '_')}`;
      }
    }

    return null;
  }

  /** Detect symbol kind from declaration text. */
  private detectSymbolKind(decl: string): SymbolRecord['kind'] {
    if (decl.includes('function')) return 'function';
    if (decl.includes('class')) return 'class';
    if (decl.includes('interface')) return 'interface';
    if (decl.includes('type')) return 'type';
    if (decl.includes('const') || decl.includes('let') || decl.includes('var')) return 'constant';
    return 'module';
  }

  /** Extract routes from file records. */
  private extractRoutes(fileRecords: FileRecord[]): void {
    for (const file of fileRecords) {
      if (!file.path.includes('route') && !file.path.includes('api/') && !file.path.includes('controller')) continue;

      try {
        const fullPath = path.join(this.repoRoot, file.path);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Detect Express-style routes: app.get('/path', ...)
        const routeRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = routeRegex.exec(content)) !== null) {
          this.db.upsertRouteRecord({
            id: `route-${file.id}-${match[2].replace(/[/\\]/g, '_')}`,
            projectId: this.projectId,
            fileId: file.id,
            method: match[1].toUpperCase(),
            path: match[2],
            handler: null,
            framework: 'express',
          });
        }

        // Detect Next.js file-based routes
        if (file.path.includes('pages/') || file.path.includes('app/')) {
          const routePath = this.nextJsRoutePath(file.path);
          this.db.upsertRouteRecord({
            id: `route-${file.id}-nextjs`,
            projectId: this.projectId,
            fileId: file.id,
            method: null,
            path: routePath,
            handler: null,
            framework: 'nextjs',
          });
        }
      } catch { /* ignore */ }
    }
  }

  /** Convert Next.js file path to route path. */
  private nextJsRoutePath(filePath: string): string {
    let route = filePath
      .replace(/^(pages|app)\//, '/')
      .replace(/\.(tsx|ts|jsx|js)$/, '')
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1');
    return route || '/';
  }

  /** Extract jobs from file records. */
  private extractJobs(fileRecords: FileRecord[]): void {
    for (const file of fileRecords) {
      if (!file.path.includes('job') && !file.path.includes('cron') && !file.path.includes('worker') && !file.path.includes('task')) continue;

      try {
        const fullPath = path.join(this.repoRoot, file.path);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Detect cron job patterns
        const cronRegex = /cron\.(job|schedule)\s*\(\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = cronRegex.exec(content)) !== null) {
          this.db.upsertJobRecord({
            id: `job-${file.id}-${match[2]}`,
            projectId: this.projectId,
            fileId: file.id,
            name: match[2],
            schedule: null,
            handler: null,
            description: null,
          });
        }
      } catch { /* ignore */ }
    }
  }
}
