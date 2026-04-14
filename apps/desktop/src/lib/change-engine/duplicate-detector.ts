/**
 * DuplicateDetector — detects duplicate logic and suggests reuse.
 *
 * Searches the project intelligence layer for similar functions, components,
 * and utilities. Uses simple string similarity to flag potential duplication.
 */

import type { DuplicateWarning, PatternReuseSuggestion, SymbolRecord } from '../shared-types';

export class DuplicateDetector {
  /**
   * Detect potential duplicates in new content by comparing against
   * known symbols from the project intelligence index.
   */
  detectDuplicates(
    newContent: string,
    filePath: string,
    workspaceRunId: string,
    projectSymbols: SymbolRecord[] = [],
  ): DuplicateWarning[] {
    const warnings: DuplicateWarning[] = [];

    // Extract function/class names from new content
    const newNames = this.extractNames(newContent);

    // Check for name collisions with existing symbols
    for (const symbol of projectSymbols) {
      if (newNames.has(symbol.name)) {
        const reuse: PatternReuseSuggestion = {
          existingPath: symbol.filePath,
          existingSymbol: symbol.name,
          reason: `A ${symbol.kind} named "${symbol.name}" already exists at ${symbol.filePath}. Consider reusing it instead of creating a duplicate.`,
          confidence: 0.8,
        };
        warnings.push({
          id: `dup-${Date.now()}-${symbol.name}`,
          workspaceRunId,
          filePath,
          warning: `Potential duplicate: "${symbol.name}" already exists at ${symbol.filePath}`,
          existingPattern: symbol.filePath,
          reuseSuggestion: reuse,
        });
      }
    }

    // Check for near-duplicate content using simple similarity
    for (const symbol of projectSymbols) {
      if (symbol.kind === 'function' && symbol.name) {
        const similarity = this.computeSimilarity(newContent, symbol.name);
        if (similarity > 0.7 && symbol.name.length > 5) {
          const existingReuse = warnings.find(w => w.existingPattern === symbol.filePath);
          if (!existingReuse) {
            const reuse: PatternReuseSuggestion = {
              existingPath: symbol.filePath,
              existingSymbol: symbol.name,
              reason: `Content appears similar to existing function "${symbol.name}" at ${symbol.filePath}. Consider reusing or extracting shared logic.`,
              confidence: similarity,
            };
            warnings.push({
              id: `dup-sim-${Date.now()}-${symbol.name}`,
              workspaceRunId,
              filePath,
              warning: `Near-duplicate content detected: similar to "${symbol.name}" at ${symbol.filePath}`,
              existingPattern: symbol.filePath,
              reuseSuggestion: reuse,
            });
          }
        }
      }
    }

    return warnings;
  }

  /** Extract function/class/interface names from source content. */
  private extractNames(content: string): Set<string> {
    const names = new Set<string>();
    // Match function declarations
    const funcMatches = content.matchAll(/(?:function|const|let|var)\s+(\w+)\s*[=(]/g);
    for (const m of funcMatches) names.add(m[1]);
    // Match class declarations
    const classMatches = content.matchAll(/class\s+(\w+)/g);
    for (const m of classMatches) names.add(m[1]);
    // Match interface/type declarations
    const typeMatches = content.matchAll(/(?:interface|type)\s+(\w+)/g);
    for (const m of typeMatches) names.add(m[1]);
    // Match export declarations
    const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|class|const)\s+(\w+)/g);
    for (const m of exportMatches) names.add(m[1]);
    return names;
  }

  /** Compute a simple similarity score between content and a symbol name. */
  private computeSimilarity(content: string, symbolName: string): number {
    const lowerContent = content.toLowerCase();
    const lowerName = symbolName.toLowerCase();

    // Check if the symbol name appears in the content
    if (lowerContent.includes(lowerName)) {
      return 0.5;
    }

    // Check for substring matches
    const words = lowerName.split(/[^a-zA-Z0-9]/);
    const matchedWords = words.filter(w => w.length > 3 && lowerContent.includes(w));
    if (words.length > 0) {
      return matchedWords.length / words.length;
    }

    return 0;
  }
}
