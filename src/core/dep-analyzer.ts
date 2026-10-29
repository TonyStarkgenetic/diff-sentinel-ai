/**
 * diff-sentinel: Dependency Change & Supply-Chain Risk Analyzer
 */

import type { ParsedDiff } from '../types.ts';

export interface DependencyChange {
  name: string;
  oldVersion?: string;
  newVersion?: string;
  changeType: 'added' | 'removed' | 'upgraded' | 'downgraded';
  isDev: boolean;
  riskFlags: string[];
}

export interface DependencyAnalysis {
  changes: DependencyChange[];
  totalAdded: number;
  totalRemoved: number;
  totalUpgraded: number;
  totalDowngraded: number;
  riskScore: number; // 0 - 100
  warnings: string[];
}

const SUSPICIOUS_PACKAGE_NAMES = [
  /^[a-z]$/i, // single letter packages
  /^(?:lodash|express|axios|chalk|debug|react|vue|next)[-_][a-z0-9]+$/i, // typosquatting patterns
  /[-_](?:security|fix|patch|update)$/i // deceptive suffixes
];

export function analyzeDependencies(parsedDiff: ParsedDiff): DependencyAnalysis {
  const changes: DependencyChange[] = [];
  const warnings: string[] = [];

  const manifestFiles = parsedDiff.files.filter(f =>
    /package\.json$/i.test(f.newPath || f.oldPath) ||
    /requirements.*\.txt$/i.test(f.newPath || f.oldPath) ||
    /Cargo\.toml$/i.test(f.newPath || f.oldPath)
  );

  for (const file of manifestFiles) {
    const isPackageJson = /package\.json$/i.test(file.newPath || file.oldPath);

    if (isPackageJson) {
      parsePackageJsonDiff(file.hunks, changes, warnings);
    }
  }

  let totalAdded = 0;
  let totalRemoved = 0;
  let totalUpgraded = 0;
  let totalDowngraded = 0;

  for (const c of changes) {
    if (c.changeType === 'added') totalAdded++;
    else if (c.changeType === 'removed') totalRemoved++;
    else if (c.changeType === 'upgraded') totalUpgraded++;
    else if (c.changeType === 'downgraded') totalDowngraded++;
  }

  // Calculate dependency risk score (0-100)
  let riskScore = 0;
  if (totalDowngraded > 0) riskScore += 40;
  if (totalAdded > 5) riskScore += 25;
  if (changes.some(c => c.riskFlags.length > 0)) riskScore += 30;
  riskScore = Math.min(100, riskScore);

  if (totalAdded > 5) {
    warnings.push(`Large dependency addition (+${totalAdded} packages). Audit third-party licenses and bundle size impact.`);
  }
  if (totalDowngraded > 0) {
    warnings.push(`${totalDowngraded} dependencies were downgraded. Ensure this does not reintroduce known CVEs.`);
  }

  return {
    changes,
    totalAdded,
    totalRemoved,
    totalUpgraded,
    totalDowngraded,
    riskScore,
    warnings
  };
}

function parsePackageJsonDiff(
  hunks: { lines: string[] }[],
  changes: DependencyChange[],
  warnings: string[]
): void {
  const addedMap = new Map<string, { version: string; isDev: boolean }>();
  const removedMap = new Map<string, { version: string; isDev: boolean }>();

  let isInsideDevDeps = false;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.includes('"devDependencies"')) {
        isInsideDevDeps = true;
      } else if (line.includes('"dependencies"')) {
        isInsideDevDeps = false;
      }

      const match = line.match(/^([+-])\s*"(@?[a-zA-Z0-9_\-./]+)"\s*:\s*"([^"]+)"/);
      if (!match) continue;

      const sign = match[1];
      const pkgName = match[2];
      const version = match[3];

      if (sign === '+') {
        addedMap.set(pkgName, { version, isDev: isInsideDevDeps });
      } else if (sign === '-') {
        removedMap.set(pkgName, { version, isDev: isInsideDevDeps });
      }
    }
  }

  // Correlate additions and removals
  for (const [pkgName, addInfo] of addedMap.entries()) {
    const riskFlags: string[] = [];

    // Check suspicious package name
    if (SUSPICIOUS_PACKAGE_NAMES.some(rx => rx.test(pkgName))) {
      riskFlags.push('Suspicious or potentially typosquatted package name');
      warnings.push(`Potential typosquatting detected for package: '${pkgName}'`);
    }

    if (removedMap.has(pkgName)) {
      const remInfo = removedMap.get(pkgName)!;
      const isDowngrade = compareSemverLike(remInfo.version, addInfo.version) > 0;

      if (isDowngrade) {
        riskFlags.push('Dependency downgraded to older version');
      }

      // Check if version was pinned and now loosened
      if (/^[0-9]/.test(remInfo.version) && /^[~^]/.test(addInfo.version)) {
        riskFlags.push('Version constraint loosened from pinned to loose (^/~)');
      }

      changes.push({
        name: pkgName,
        oldVersion: remInfo.version,
        newVersion: addInfo.version,
        changeType: isDowngrade ? 'downgraded' : 'upgraded',
        isDev: addInfo.isDev,
        riskFlags
      });
      removedMap.delete(pkgName);
    } else {
      changes.push({
        name: pkgName,
        newVersion: addInfo.version,
        changeType: 'added',
        isDev: addInfo.isDev,
        riskFlags
      });
    }
  }

  for (const [pkgName, remInfo] of removedMap.entries()) {
    changes.push({
      name: pkgName,
      oldVersion: remInfo.version,
      changeType: 'removed',
      isDev: remInfo.isDev,
      riskFlags: []
    });
  }
}

/**
 * Basic version comparator for x.y.z strings
 */
function compareSemverLike(v1: string, v2: string): number {
  const clean1 = v1.replace(/[^0-9.]/g, '').split('.').map(Number);
  const clean2 = v2.replace(/[^0-9.]/g, '').split('.').map(Number);

  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
