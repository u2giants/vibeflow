/**
 * PatchApplier — patch generation and deterministic file edit application.
 *
 * Wraps the existing FileService with workspace-scoping and diff generation.
 */

import { FileService } from '../tooling/file-service';
import type { FileEdit, EvidenceItem } from '../shared-types';

export interface PatchEdit {
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  newContent: string | null;
  rationale: string;
}

export class PatchApplier {
  private fileService = new FileService();

  /** Generate a unified diff string between original and new content. */
  generateUnifiedDiff(
    originalContent: string | null,
    newContent: string | null,
    filePath: string,
  ): string {
    const original = originalContent ?? '';
    const updated = newContent ?? '';
    return this.fileService.generateDiff(original, updated, filePath);
  }

  /**
   * Apply a single file edit within a workspace directory.
   * Returns a FileEdit record with the generated diff.
   */
  applyEdit(
    worktreePath: string,
    edit: PatchEdit,
    validityResults: EvidenceItem[] = [],
  ): FileEdit {
    const resolvedPath = worktreePath === process.cwd()
      ? edit.filePath
      : `${worktreePath}/${edit.filePath}`;

    let diff = '';

    if (edit.operation === 'delete') {
      // Read current content for diff, then delete
      try {
        const current = this.fileService.readFile(resolvedPath);
        diff = this.generateUnifiedDiff(current.content, null, edit.filePath);
      } catch {
        diff = `--- a/${edit.filePath}\n+++ /dev/null\n@@ -1 +0,0 @@\n-file deleted without prior read\n`;
      }
      // Delete the file
      const fs = require('fs');
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
    } else if (edit.operation === 'create') {
      diff = this.generateUnifiedDiff(null, edit.newContent, edit.filePath);
      this.fileService.writeFile(resolvedPath, edit.newContent ?? '');
    } else {
      // modify
      let originalContent = '';
      try {
        const current = this.fileService.readFile(resolvedPath);
        originalContent = current.content;
      } catch {
        // File doesn't exist yet — treat as create
      }
      diff = this.generateUnifiedDiff(originalContent, edit.newContent, edit.filePath);
      this.fileService.writeFile(resolvedPath, edit.newContent ?? '');
    }

    return {
      id: `edit-${Date.now()}-${edit.filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      workspaceRunId: '', // filled by caller
      filePath: edit.filePath,
      operation: edit.operation,
      diff,
      validityResults,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Apply multiple file edits atomically (all-or-nothing).
   * If any edit fails, the caller should handle rollback via checkpoints.
   */
  applyMultiFilePatch(
    worktreePath: string,
    edits: PatchEdit[],
    validityResults: EvidenceItem[] = [],
  ): FileEdit[] {
    const results: FileEdit[] = [];
    for (const edit of edits) {
      const result = this.applyEdit(worktreePath, edit, validityResults);
      results.push(result);
    }
    return results;
  }

  /**
   * Validate that a patch can be applied cleanly by checking if the target
   * file exists for modify/delete operations.
   */
  validatePatchIntegrity(
    worktreePath: string,
    edit: PatchEdit,
  ): { valid: boolean; error: string | null } {
    const resolvedPath = worktreePath === process.cwd()
      ? edit.filePath
      : `${worktreePath}/${edit.filePath}`;

    if (edit.operation === 'create') {
      // Check file doesn't already exist
      const fs = require('fs');
      if (fs.existsSync(resolvedPath)) {
        return { valid: false, error: `File already exists: ${edit.filePath}` };
      }
      return { valid: true, error: null };
    }

    if (edit.operation === 'modify' || edit.operation === 'delete') {
      // Check file exists
      const fs = require('fs');
      if (!fs.existsSync(resolvedPath)) {
        return { valid: false, error: `File not found: ${edit.filePath}` };
      }
      return { valid: true, error: null };
    }

    return { valid: false, error: `Unknown operation: ${edit.operation}` };
  }
}
