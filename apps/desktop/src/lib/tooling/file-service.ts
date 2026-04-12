/** File operations: read, write, list, exists, diff. */

import * as fs from 'fs';
import * as path from 'path';

export interface FileReadResult {
  path: string;
  content: string;
  encoding: string;
  sizeBytes: number;
}

export interface FileWriteResult {
  path: string;
  bytesWritten: number;
}

export interface DirectoryListResult {
  path: string;
  entries: Array<{
    name: string;
    type: 'file' | 'directory' | 'symlink';
    sizeBytes: number;
    modifiedAt: string;
  }>;
}

export class FileService {
  /** Validate that a path does not escape the project root via .. */
  private validatePath(filePath: string, projectRoot: string): string {
    const resolved = path.resolve(filePath);
    const normalizedRoot = path.resolve(projectRoot);
    if (!resolved.startsWith(normalizedRoot)) {
      throw new Error(`Path traversal detected: ${filePath} escapes project root`);
    }
    return resolved;
  }

  readFile(filePath: string, projectRoot?: string): FileReadResult {
    const resolved = projectRoot ? this.validatePath(filePath, projectRoot) : path.resolve(filePath);
    const content = fs.readFileSync(resolved, 'utf-8');
    const stats = fs.statSync(resolved);
    return {
      path: resolved,
      content,
      encoding: 'utf-8',
      sizeBytes: stats.size,
    };
  }

  writeFile(filePath: string, content: string, projectRoot?: string): FileWriteResult {
    const resolved = projectRoot ? this.validatePath(filePath, projectRoot) : path.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, content, 'utf-8');
    const stats = fs.statSync(resolved);
    return { path: resolved, bytesWritten: stats.size };
  }

  listDirectory(dirPath: string, projectRoot?: string): DirectoryListResult {
    const resolved = projectRoot ? this.validatePath(dirPath, projectRoot) : path.resolve(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      path: resolved,
      entries: entries.map(e => {
        const fullPath = path.join(resolved, e.name);
        const stats = fs.statSync(fullPath);
        return {
          name: e.name,
          type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file',
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      }),
    };
  }

  fileExists(filePath: string, projectRoot?: string): boolean {
    const resolved = projectRoot ? this.validatePath(filePath, projectRoot) : path.resolve(filePath);
    return fs.existsSync(resolved);
  }

  generateDiff(originalContent: string, newContent: string, filePath: string): string {
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

    const maxLen = Math.max(originalLines.length, newLines.length);
    let inChange = false;

    for (let i = 0; i < maxLen; i++) {
      const orig = originalLines[i];
      const next = newLines[i];
      if (orig !== next) {
        if (!inChange) {
          inChange = true;
          lines.push(`@@ -${i + 1} +${i + 1} @@`);
        }
        if (orig !== undefined) lines.push(`-${orig}`);
        if (next !== undefined) lines.push(`+${next}`);
      } else {
        inChange = false;
      }
    }

    return lines.join('\n');
  }
}
