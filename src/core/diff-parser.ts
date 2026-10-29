/**
 * diff-sentinel: Fast Unified Diff Parser
 */

import type { DiffFile, DiffHunk, ParsedDiff } from '../types.ts';

export function parseUnifiedDiff(rawDiff: string): ParsedDiff {
  if (!rawDiff || !rawDiff.trim()) {
    return {
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      totalFiles: 0,
      rawText: rawDiff || ''
    };
  }

  const lines = rawDiff.split(/\r?\n/);
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file header start: diff --git a/... b/...
    if (line.startsWith('diff --git ')) {
      if (currentHunk && currentFile) {
        currentFile.hunks.push(currentHunk);
        currentHunk = null;
      }
      if (currentFile) {
        files.push(currentFile);
      }

      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const oldPath = match ? match[1] : '';
      const newPath = match ? match[2] : '';

      currentFile = {
        oldPath: oldPath || 'unknown',
        newPath: newPath || 'unknown',
        isNew: false,
        isDeleted: false,
        isRenamed: oldPath !== newPath && oldPath !== '' && newPath !== '',
        additions: 0,
        deletions: 0,
        hunks: []
      };
      continue;
    }

    if (!currentFile) {
      // Diff without 'diff --git', e.g. from git show or standard patch
      if (line.startsWith('--- a/') || line.startsWith('--- ')) {
        const path = line.replace(/^---\s+(a\/)?/, '').trim();
        currentFile = {
          oldPath: path,
          newPath: path,
          isNew: false,
          isDeleted: false,
          isRenamed: false,
          additions: 0,
          deletions: 0,
          hunks: []
        };
        continue;
      }
    }

    if (currentFile) {
      if (line.startsWith('new file mode')) {
        currentFile.isNew = true;
        continue;
      }
      if (line.startsWith('deleted file mode')) {
        currentFile.isDeleted = true;
        continue;
      }
      if (line.startsWith('--- /dev/null')) {
        currentFile.isNew = true;
        continue;
      }
      if (line.startsWith('+++ /dev/null')) {
        currentFile.isDeleted = true;
        continue;
      }
      if (line.startsWith('--- a/')) {
        currentFile.oldPath = line.substring(6).trim();
        continue;
      }
      if (line.startsWith('+++ b/')) {
        currentFile.newPath = line.substring(6).trim();
        continue;
      }

      // Hunk header: @@ -12,4 +12,6 @@
      if (line.startsWith('@@ ')) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }

        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1], 10),
            oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
            newStart: parseInt(hunkMatch[3], 10),
            newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
            header: line,
            lines: []
          };
        } else {
          currentHunk = {
            oldStart: 0,
            oldLines: 0,
            newStart: 0,
            newLines: 0,
            header: line,
            lines: []
          };
        }
        continue;
      }

      if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentFile.additions++;
          totalAdditions++;
          currentHunk.lines.push(line);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentFile.deletions++;
          totalDeletions++;
          currentHunk.lines.push(line);
        } else if (line.startsWith(' ') || line === '') {
          currentHunk.lines.push(line);
        }
      }
    }
  }

  if (currentHunk && currentFile) {
    currentFile.hunks.push(currentHunk);
  }
  if (currentFile) {
    files.push(currentFile);
  }

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalFiles: files.length,
    rawText: rawDiff
  };
}

/**
 * Filter files by extension or pattern
 */
export function filterDiffByExtension(parsed: ParsedDiff, extensions: string[]): DiffFile[] {
  const exts = new Set(extensions.map(e => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`)));
  return parsed.files.filter(f => {
    const ext = f.newPath.slice(f.newPath.lastIndexOf('.')).toLowerCase();
    return exts.has(ext);
  });
}
