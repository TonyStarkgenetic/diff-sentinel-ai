/**
 * diff-sentinel: AST & Breaking Change Signature Analyzer
 * Supports TypeScript, JavaScript, Python, Go, and Rust
 */

import type { BreakingChange, ParsedDiff } from '../types.ts';

interface ExportedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable';
  file: string;
  signature?: string;
  paramCount?: number;
  requiredParamCount?: number;
}

export function detectBreakingChanges(parsedDiff: ParsedDiff): BreakingChange[] {
  const breakingChanges: BreakingChange[] = [];

  for (const file of parsedDiff.files) {
    const targetPath = file.newPath || file.oldPath;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs)$/i.test(targetPath)) {
      continue;
    }

    const removedExports: ExportedSymbol[] = [];
    const addedExports: ExportedSymbol[] = [];

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith('-')) {
          const sym = extractExportedSymbol(line.substring(1), file.oldPath || targetPath);
          if (sym) removedExports.push(sym);
        } else if (line.startsWith('+')) {
          const sym = extractExportedSymbol(line.substring(1), file.newPath || targetPath);
          if (sym) addedExports.push(sym);
        }
      }
    }

    for (const rem of removedExports) {
      const matchingAdd = addedExports.find(a => a.name === rem.name && a.kind === rem.kind);

      if (!matchingAdd) {
        breakingChanges.push({
          symbolName: rem.name,
          kind: rem.kind,
          changeType: 'removed',
          file: file.oldPath || targetPath,
          description: `Public ${rem.kind} '${rem.name}' was removed or no longer exported.`,
          severity: 'breaking'
        });
      } else {
        const oldRequired = rem.requiredParamCount ?? rem.paramCount;
        const newRequired = matchingAdd.requiredParamCount ?? matchingAdd.paramCount;

        if (
          oldRequired !== undefined &&
          newRequired !== undefined &&
          newRequired > oldRequired
        ) {
          breakingChanges.push({
            symbolName: rem.name,
            kind: rem.kind,
            changeType: 'signature_modified',
            file: file.newPath || targetPath,
            description: `Signature for '${rem.name}' modified: required parameter count increased from ${oldRequired} to ${newRequired}. Ensure new arguments have default values or are optional.`,
            severity: 'breaking'
          });
        } else if (
          rem.paramCount !== undefined &&
          matchingAdd.paramCount !== undefined &&
          matchingAdd.paramCount < rem.paramCount
        ) {
          breakingChanges.push({
            symbolName: rem.name,
            kind: rem.kind,
            changeType: 'signature_modified',
            file: file.newPath || targetPath,
            description: `Signature for '${rem.name}' modified: parameter arity decreased from ${rem.paramCount} to ${matchingAdd.paramCount}.`,
            severity: 'breaking'
          });
        }
      }
    }
  }

  return breakingChanges;
}

function countParams(
  rawParams: string,
  ignoreReceiverNames: string[] = []
): { total: number; required: number } {
  const parts = rawParams
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0 && !ignoreReceiverNames.includes(p));

  let required = 0;
  for (const part of parts) {
    const isOptionalTs = /^[a-zA-Z0-9_$]+\s*\?:/.test(part);
    const hasDefaultValue = part.includes('=');
    const isVariadic = part.startsWith('...') || part.startsWith('*');
    if (!isOptionalTs && !hasDefaultValue && !isVariadic) {
      required++;
    }
  }

  return { total: parts.length, required };
}

function extractExportedSymbol(line: string, filePath: string): ExportedSymbol | null {
  const trimmed = line.trim();

  // 1. TypeScript / JavaScript export patterns
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath)) {
    const tsFuncMatch = trimmed.match(
      /^export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/
    );
    if (tsFuncMatch) {
      const { total, required } = countParams(tsFuncMatch[2]);
      return {
        name: tsFuncMatch[1],
        kind: 'function',
        file: filePath,
        paramCount: total,
        requiredParamCount: required,
        signature: tsFuncMatch[0]
      };
    }

    const tsClassMatch = trimmed.match(/^export\s+(?:default\s+)?(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/);
    if (tsClassMatch) {
      return {
        name: tsClassMatch[1],
        kind: 'class',
        file: filePath
      };
    }

    const tsInterfaceMatch = trimmed.match(/^export\s+(?:interface|type)\s+([a-zA-Z0-9_$]+)/);
    if (tsInterfaceMatch) {
      return {
        name: tsInterfaceMatch[1],
        kind: 'interface',
        file: filePath
      };
    }

    const tsConstMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*(?::[^=]+)?=/);
    if (tsConstMatch) {
      return {
        name: tsConstMatch[1],
        kind: 'variable',
        file: filePath
      };
    }
  }

  // 2. Python public functions & classes (no leading underscore)
  if (filePath.endsWith('.py')) {
    const pyDefMatch = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
    if (pyDefMatch && !pyDefMatch[1].startsWith('_')) {
      const { total, required } = countParams(pyDefMatch[2], ['self', 'cls']);
      return {
        name: pyDefMatch[1],
        kind: 'function',
        file: filePath,
        paramCount: total,
        requiredParamCount: required
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

  // 3. Go exported functions & types (Identifier starts with uppercase letter)
  if (filePath.endsWith('.go')) {
    const goFuncMatch = trimmed.match(
      /^func\s+(?:\([^)]+\)\s+)?([A-Z][a-zA-Z0-9_]*)\s*(?:\[[^\]]*\])?\s*\(([^)]*)\)/
    );
    if (goFuncMatch) {
      const { total, required } = countParams(goFuncMatch[2]);
      return {
        name: goFuncMatch[1],
        kind: 'function',
        file: filePath,
        paramCount: total,
        requiredParamCount: required
      };
    }

    const goTypeMatch = trimmed.match(/^type\s+([A-Z][a-zA-Z0-9_]*)\s+(struct|interface)\b/);
    if (goTypeMatch) {
      return {
        name: goTypeMatch[1],
        kind: goTypeMatch[2] === 'interface' ? 'interface' : 'class',
        file: filePath
      };
    }
  }

  // 4. Rust public items (pub fn, pub struct, pub enum, pub trait)
  if (filePath.endsWith('.rs')) {
    const rsFnMatch = trimmed.match(
      /^pub\s+(?:async\s+)?(?:const\s+)?(?:unsafe\s+)?fn\s+([a-zA-Z0-9_]+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/
    );
    if (rsFnMatch) {
      const { total, required } = countParams(rsFnMatch[2], ['self', '&self', '&mut self', 'mut self']);
      return {
        name: rsFnMatch[1],
        kind: 'function',
        file: filePath,
        paramCount: total,
        requiredParamCount: required
      };
    }

    const rsTypeMatch = trimmed.match(/^pub\s+(struct|enum|trait)\s+([a-zA-Z0-9_]+)/);
    if (rsTypeMatch) {
      return {
        name: rsTypeMatch[2],
        kind: rsTypeMatch[1] === 'trait' ? 'interface' : 'class',
        file: filePath
      };
    }
  }

  return null;
}
