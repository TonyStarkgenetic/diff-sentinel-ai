/**
 * diff-sentinel: Token Estimator & Diff Compressor for LLM Context Windows
 * Strips lockfiles, generated assets, and hunk noise to save 60-80% of prompt tokens.
 */

import type { DiffFile, PackedDiffResult, ParsedDiff } from '../types.ts';

const NOISE_FILE_PATTERNS = [
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock)$/i,
  /\.(?:min\.js|min\.css|map|svg|wasm|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i,
  /(?:^|\/)(?:dist|build|\.next|\.nuxt|out|coverage)\//i,
  /\.(?:csv|tsv|jsonl)$/i
];

export interface PackOptions {
  includeOmittedSummaries?: boolean;
  maxLinesPerFile?: number;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // BPE average for mixed source code and unified diffs is ~3.7-3.9 chars per token
  return Math.ceil(text.length / 3.8);
}

export function packDiffForLlm(
  parsedDiff: ParsedDiff,
  options: PackOptions = {}
): PackedDiffResult {
  const includeSummaries = options.includeOmittedSummaries ?? true;
  const maxLines = options.maxLinesPerFile ?? 250;

  const rawText = parsedDiff.rawText || '';
  const rawChars = rawText.length;
  const rawEstimatedTokens = estimateTokens(rawText);

  let omittedCount = 0;
  const outputLines: string[] = [];

  outputLines.push('# Compact Diff for LLM Code Review');
  outputLines.push(`Summary: ${parsedDiff.totalFiles} files changed (+${parsedDiff.totalAdditions} / -${parsedDiff.totalDeletions})`);
  outputLines.push('');

  for (const file of parsedDiff.files) {
    const isNoise = isNoiseFile(file.newPath || file.oldPath);

    if (isNoise) {
      omittedCount++;
      if (includeSummaries) {
        outputLines.push(`--- a/${file.oldPath}`);
        outputLines.push(`+++ b/${file.newPath}`);
        outputLines.push(`[Omitted generated/lockfile content: +${file.additions}/-${file.deletions} lines]`);
        outputLines.push('');
      }
      continue;
    }

    // Format active code file
    outputLines.push(`diff --git a/${file.oldPath} b/${file.newPath}`);
    if (file.isNew) outputLines.push('new file mode 100644');
    if (file.isDeleted) outputLines.push('deleted file mode 100644');
    outputLines.push(`--- a/${file.oldPath}`);
    outputLines.push(`+++ b/${file.newPath}`);

    let fileLineCount = 0;
    let truncated = false;

    for (const hunk of file.hunks) {
      outputLines.push(hunk.header);
      for (const line of hunk.lines) {
        if (fileLineCount >= maxLines) {
          truncated = true;
          break;
        }
        outputLines.push(line);
        fileLineCount++;
      }
      if (truncated) {
        outputLines.push(`[Hunk truncated after ${maxLines} lines for token efficiency]`);
        break;
      }
    }
    outputLines.push('');
  }

  const packedOutput = outputLines.join('\n');
  const packedChars = packedOutput.length;
  const packedEstimatedTokens = estimateTokens(packedOutput);

  const savings = rawEstimatedTokens > 0
    ? Math.max(0, Math.round(((rawEstimatedTokens - packedEstimatedTokens) / rawEstimatedTokens) * 100))
    : 0;

  return {
    totalFiles: parsedDiff.totalFiles,
    omittedFiles: omittedCount,
    rawChars,
    packedChars,
    rawEstimatedTokens,
    packedEstimatedTokens,
    tokenSavingsPercent: savings,
    formattedOutput: packedOutput
  };
}

function isNoiseFile(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  return NOISE_FILE_PATTERNS.some(rx => rx.test(normalized));
}
