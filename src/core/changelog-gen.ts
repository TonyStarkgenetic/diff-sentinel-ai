/**
 * diff-sentinel: Semantic Changelog & Conventional Commit Generator
 */

import type { ChangelogRelease, ConventionalCommit } from '../types.ts';

export function parseConventionalCommit(message: string): ConventionalCommit | null {
  const firstLine = message.split('\n')[0].trim();
  const match = firstLine.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);

  if (!match) {
    return {
      type: 'chore',
      description: firstLine,
      isBreaking: message.includes('BREAKING CHANGE:'),
      body: message
    };
  }

  const type = match[1].toLowerCase();
  const scope = match[2];
  const isBreakingMarker = Boolean(match[3]) || message.includes('BREAKING CHANGE:');
  const description = match[4];

  return {
    type,
    scope,
    description,
    isBreaking: isBreakingMarker,
    body: message
  };
}

export function generateChangelog(
  commits: string[],
  nextVersion: string = '1.0.0'
): ChangelogRelease {
  const parsedCommits: ConventionalCommit[] = commits
    .map(c => parseConventionalCommit(c))
    .filter((c): c is ConventionalCommit => c !== null);

  const features: string[] = [];
  const fixes: string[] = [];
  const performance: string[] = [];
  const refactors: string[] = [];
  const breakingChanges: string[] = [];
  const other: string[] = [];

  let recommendedBump: 'major' | 'minor' | 'patch' = 'patch';

  for (const commit of parsedCommits) {
    const formatted = commit.scope
      ? `**${commit.scope}**: ${commit.description}`
      : commit.description;

    if (commit.isBreaking) {
      breakingChanges.push(formatted);
      recommendedBump = 'major';
    } else if (commit.type === 'feat') {
      features.push(formatted);
      if (recommendedBump !== 'major') {
        recommendedBump = 'minor';
      }
    } else if (commit.type === 'fix') {
      fixes.push(formatted);
    } else if (commit.type === 'perf') {
      performance.push(formatted);
    } else if (commit.type === 'refactor') {
      refactors.push(formatted);
    } else {
      other.push(formatted);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  lines.push(`## [${nextVersion}] - ${today}`);
  lines.push('');

  if (breakingChanges.length > 0) {
    lines.push('### ⚠️ BREAKING CHANGES');
    breakingChanges.forEach(b => lines.push(`- ${b}`));
    lines.push('');
  }

  if (features.length > 0) {
    lines.push('### 🚀 Features');
    features.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  if (fixes.length > 0) {
    lines.push('### 🐛 Bug Fixes');
    fixes.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  if (performance.length > 0) {
    lines.push('### ⚡ Performance Improvements');
    performance.forEach(p => lines.push(`- ${p}`));
    lines.push('');
  }

  if (refactors.length > 0) {
    lines.push('### 🛠️ Refactoring');
    refactors.forEach(r => lines.push(`- ${r}`));
    lines.push('');
  }

  return {
    version: nextVersion,
    recommendedBump,
    date: today,
    features,
    fixes,
    performance,
    refactors,
    breakingChanges,
    other,
    markdown: lines.join('\n')
  };
}
