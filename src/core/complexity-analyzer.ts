/**
 * diff-sentinel: Complexity Analyzer
 *
 * Analyzes a ParsedDiff and calculates complexity metrics for
 * added lines, detecting branching constructs, nesting depth,
 * cognitive complexity, and hotspot locations.
 */

import type { ParsedDiff } from '../types.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ComplexityMetrics {
  cyclomaticComplexity: number;  // estimated from branching keywords
  nestingDepth: number;          // max nesting level detected
  cognitiveComplexity: number;   // weighted complexity score
  hotspots: ComplexityHotspot[];
  summary: string;
}

export interface ComplexityHotspot {
  file: string;
  line: number;
  reason: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Patterns that each contribute +1 to cyclomatic complexity and are counted
 * individually when computing cognitive complexity.
 *
 * We match keyword-boundary patterns so that identifiers like `notify` or
 * `switcher` are not falsely flagged.
 */
const BRANCH_PATTERNS: RegExp[] = [
  /\bif\b/g,
  /\belse\b/g,
  /\bswitch\b/g,
  /\bcase\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bdo\b/g,
  /\btry\b/g,
  /\bcatch\b/g,
  /&&/g,
  /\|\|/g,
  // Ternary `?` — exclude `?.` (optional chaining) and `??` (nullish coalescing)
  /\?(?![.?])/g,
];

/** Threshold at which a single line is flagged as a hotspot. */
const HOTSPOT_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count total matches of all {@link BRANCH_PATTERNS} within a single line of
 * source code.
 */
function countBranchHits(line: string): number {
  let total = 0;
  for (const pattern of BRANCH_PATTERNS) {
    // Reset lastIndex since we reuse global regexes across lines.
    pattern.lastIndex = 0;
    let match = pattern.exec(line);
    while (match) {
      total++;
      match = pattern.exec(line);
    }
  }
  return total;
}

/**
 * Compute the net change in brace-nesting depth for a given line.
 * Ignores braces inside string literals and comments for a best-effort result.
 */
function braceBalanceDelta(line: string): number {
  let delta = 0;
  let inString: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    // Rudimentary string tracking (single/double/backtick)
    if (inString) {
      if (ch === '\\') {
        i++; // skip escaped character
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    // Skip single-line comment remainder
    if (ch === '/' && i + 1 < line.length) {
      const next = line[i + 1];
      if (next === '/') break;         // rest of line is comment
      if (next === '*') {
        // Skip block comment on same line (simplistic)
        const endIdx = line.indexOf('*/', i + 2);
        if (endIdx !== -1) {
          i = endIdx + 1; // jump past closing */
          continue;
        }
        break; // block comment spans beyond this line
      }
    }

    if (ch === '{') delta++;
    else if (ch === '}') delta--;
  }
  return delta;
}

/**
 * Resolve the effective line number of an added line inside a hunk.
 *
 * We walk through hunk lines and count only additions and context lines
 * against the new-file line counter to derive the correct new-file line
 * number for a given `+` line at `targetIndex` in the `lines` array.
 */
function resolveNewLineNumber(
  hunkNewStart: number,
  lines: string[],
  targetIndex: number,
): number {
  let newLine = hunkNewStart;
  for (let i = 0; i < targetIndex; i++) {
    const prefix = lines[i][0];
    if (prefix !== '-') {
      // Context lines (' ') and additions ('+') advance the new-file counter.
      newLine++;
    }
  }
  return newLine;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a {@link ParsedDiff} and return complexity metrics derived from all
 * added (`+`) lines across every file and hunk.
 */
export function analyzeComplexity(parsedDiff: ParsedDiff): ComplexityMetrics {
  let cyclomaticComplexity = 0;
  let cognitiveComplexity = 0;
  let maxNestingDepth = 0;
  const hotspots: ComplexityHotspot[] = [];

  // Per-file nesting depth tracked independently.
  for (const file of parsedDiff.files) {
    let currentNesting = 0;

    for (const hunk of file.hunks) {
      for (let idx = 0; idx < hunk.lines.length; idx++) {
        const rawLine = hunk.lines[idx];

        // Only inspect added lines.
        if (!rawLine.startsWith('+')) continue;

        // Strip the leading '+' prefix to get the actual source text.
        const line = rawLine.slice(1);

        // --- Brace nesting (computed *before* branch analysis so that we
        //     attribute the nesting level at the point of the branch) ---
        // Closing braces on this line reduce nesting before we score branches.
        const delta = braceBalanceDelta(line);

        // If the line starts by closing braces, adjust nesting first so that
        // e.g. `} else {` is scored at the reduced level.
        // Strategy: apply negative delta before counting, then apply positive
        // delta after, so that `} else {` keeps nesting level stable.
        const closingDelta = Math.min(delta, 0);
        const openingDelta = Math.max(delta, 0);

        currentNesting = Math.max(0, currentNesting + closingDelta);

        // --- Branch analysis ---
        const hits = countBranchHits(line);

        if (hits > 0) {
          cyclomaticComplexity += hits;

          // Cognitive: nested branches carry extra weight.
          for (let h = 0; h < hits; h++) {
            cognitiveComplexity += 1 + currentNesting;
          }
        }

        // --- Hotspot detection (3+ branching constructs on one line) ---
        if (hits >= HOTSPOT_THRESHOLD) {
          const lineNumber = resolveNewLineNumber(
            hunk.newStart,
            hunk.lines,
            idx,
          );
          hotspots.push({
            file: file.newPath,
            line: lineNumber,
            reason: `Line contains ${hits} branching construct(s)`,
            score: hits * (1 + currentNesting),
          });
        }

        // Update nesting with the opening side.
        currentNesting += openingDelta;

        if (currentNesting > maxNestingDepth) {
          maxNestingDepth = currentNesting;
        }
      }
    }
  }

  const summary = buildSummary(cognitiveComplexity);

  return {
    cyclomaticComplexity,
    nestingDepth: maxNestingDepth,
    cognitiveComplexity,
    hotspots,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

function buildSummary(score: number): string {
  if (score < 10) {
    return `Low complexity (score: ${score})`;
  }
  if (score < 30) {
    return `Moderate complexity (score: ${score})`;
  }
  return `High complexity (score: ${score})`;
}
