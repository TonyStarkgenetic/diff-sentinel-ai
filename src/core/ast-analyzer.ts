/**
 * diff-sentinel: AST & Breaking Change Signature Analyzer
 */

import type { BreakingChange, ParsedDiff } from '../types.ts';

interface ExportedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable';
  file: string;
  signature?: string;
  paramCount?: number;
}

export function detectBreakingChanges(parsedDiff: ParsedDiff): BreakingChange[] {
  const breakingChanges: BreakingChange[] = [];

  for (const file of parsedDiff.files) {
    // Only analyze code files (ts, js, py, go, rs)
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs)$/i.test(file.newPath || file.oldPath)) {
      continue;
    }

    const removedExports: ExportedSymbol[] = [];
    const addedExports: ExportedSymbol[] = [];

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith('-')) {
          const sym = extractExportedSymbol(line.substring(1), file.oldPath);
          if (sym) removedExports.push(sym);
        } else if (line.startsWith('+')) {
          const sym = extractExportedSymbol(line.substring(1), file.newPath);
          if (sym) addedExports.push(sym);
        }
      }
    }

    // Compare removed vs added
    for (const rem of removedExports) {
      const matchingAdd = addedExports.find(a => a.name === rem.name && a.kind === rem.kind);

      if (!matchingAdd) {
        // Completely removed exported symbol
        breakingChanges.push({
          symbolName: rem.name,
          kind: rem.kind,
          changeType: 'removed',
          file: file.oldPath,
          description: `Public ${rem.kind} '${rem.name}' was removed or no longer exported.`,
          severity: 'breaking'
        });
      } else {
        // Check if parameter count changed (added required parameter)
        if (
          rem.paramCount !== undefined &&
          matchingAdd.paramCount !== undefined &&
          matchingAdd.paramCount > rem.paramCount
        ) {
          breakingChanges.push({
            symbolName: rem.name,
            kind: rem.kind,
            changeType: 'signature_modified',
            file: file.newPath,
            description: `Signature for '${rem.name}' modified: parameter count increased from ${rem.paramCount} to ${matchingAdd.paramCount}. Ensure new arguments have default values.`,
            severity: 'breaking'
          });
        }
      }
    }
  }

  return breakingChanges;
}

function extractExportedSymbol(line: string, filePath: string): ExportedSymbol | null {
  const trimmed = line.trim();

  // TypeScript / JavaScript export patterns
  // export function foo(...)
  // export const bar = (...)
  // export class Baz
  // export async function qux(...)
  const tsFuncMatch = trimmed.match(
    /^export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/
  );
  if (tsFuncMatch) {
    const params = tsFuncMatch[2]
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    return {
      name: tsFuncMatch[1],
      kind: 'function',
      file: filePath,
      paramCount: params.length,
      signature: tsFuncMatch[0]
    };
  }

  const tsClassMatch = trimmed.match(/^export\s+(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/);
  if (tsClassMatch) {
    return {
      name: tsClassMatch[1],
      kind: 'class',
      file: filePath
    };
  }

  const tsInterfaceMatch = trimmed.match(/^export\s+interface\s+([a-zA-Z0-9_$]+)/);
  if (tsInterfaceMatch) {
    return {
      name: tsInterfaceMatch[1],
      kind: 'interface',
      file: filePath
    };
  }

  const tsConstMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
  if (tsConstMatch) {
    return {
      name: tsConstMatch[1],
      kind: 'variable',
      file: filePath
    };
  }

  // Python public functions: def foo(...) without leading underscore
  if (filePath.endsWith('.py')) {
    const pyDefMatch = trimmed.match(/^def\s+([a-zA-Z][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
    if (pyDefMatch && !pyDefMatch[1].startsWith('_')) {
      const params = pyDefMatch[2]
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0 && p !== 'self' && p !== 'cls');
      return {
        name: pyDefMatch[1],
        kind: 'function',
        file: filePath,
        paramCount: params.length
      };
    }

    const pyClassMatch = trimmed.match(/^class\s+([a-zA-Z][a-zA-Z0-9_]*)/);
    if (pyClassMatch && !pyClassMatch[1].startsWith('_')) {
      return {
        name: pyClassMatch[1],
        kind: 'class',
        file: filePath
      };
    }
  }

  return null;
}
