/**
 * diff-sentinel: Dependency Change & Supply-Chain Risk Analyzer
 * Supports package.json, pnpm-lock.yaml, requirements.txt, poetry.lock, Cargo.toml, go.mod, and go.sum
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
  /^(?:lodash|express|axios|chalk|debug|react|vue|next|requests|urllib3|tokio|serde)[-_][a-z0-9]+$/i, // typosquatting patterns
  /[-_](?:security|fix|patch|update)$/i // deceptive suffixes
];

export function analyzeDependencies(parsedDiff: ParsedDiff): DependencyAnalysis {
  const changes: DependencyChange[] = [];
  const warnings: string[] = [];

  const manifestFiles = parsedDiff.files.filter(f => {
    const p = f.newPath || f.oldPath;
    return (
      /package\.json$/i.test(p) ||
      /pnpm-lock\.yaml$/i.test(p) ||
      /requirements.*\.txt$/i.test(p) ||
      /poetry\.lock$/i.test(p) ||
      /Cargo\.toml$/i.test(p) ||
      /go\.(mod|sum)$/i.test(p)
    );
  });

  for (const file of manifestFiles) {
    const filePath = file.newPath || file.oldPath;
    if (/package\.json$/i.test(filePath)) {
      parsePackageJsonDiff(file.hunks, changes, warnings);
    } else if (/pnpm-lock\.yaml$/i.test(filePath)) {
      parsePnpmLockDiff(file.hunks, changes, warnings);
    } else if (/requirements.*\.txt$/i.test(filePath)) {
      parseRequirementsTxtDiff(file.hunks, changes, warnings, /dev/i.test(filePath));
    } else if (/poetry\.lock$/i.test(filePath)) {
      parsePoetryLockDiff(file.hunks, changes, warnings);
    } else if (/Cargo\.toml$/i.test(filePath)) {
      parseCargoTomlDiff(file.hunks, changes, warnings);
    } else if (/go\.(mod|sum)$/i.test(filePath)) {
      parseGoModSumDiff(file.hunks, changes, warnings);
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

  correlateChanges(addedMap, removedMap, changes, warnings);
}

function parseRequirementsTxtDiff(
  hunks: { lines: string[] }[],
  changes: DependencyChange[],
  warnings: string[],
  isDevFile: boolean
): void {
  const addedMap = new Map<string, { version: string; isDev: boolean }>();
  const removedMap = new Map<string, { version: string; isDev: boolean }>();

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue;
      if (line.startsWith('+++') || line.startsWith('---')) continue;

      const sign = line[0];
      const content = line.substring(1).split('#')[0].trim();
      if (!content || content.startsWith('-')) continue;

      const match = content.match(/^([a-zA-Z0-9_.\-]+)\s*(?:([=<>~]+)\s*([a-zA-Z0-9_.\-*]+))?/);
      if (!match) continue;

      const pkgName = match[1].toLowerCase();
      const operator = match[2] || '';
      const ver = match[3] || '*';
      const versionStr = operator === '==' ? ver : `${operator}${ver}`;

      if (sign === '+') {
        addedMap.set(pkgName, { version: versionStr, isDev: isDevFile });
      } else if (sign === '-') {
        removedMap.set(pkgName, { version: versionStr, isDev: isDevFile });
      }
    }
  }

  correlateChanges(addedMap, removedMap, changes, warnings);
}

function parseCargoTomlDiff(
  hunks: { lines: string[] }[],
  changes: DependencyChange[],
  warnings: string[]
): void {
  const addedMap = new Map<string, { version: string; isDev: boolean }>();
  const removedMap = new Map<string, { version: string; isDev: boolean }>();

  let isDevSection = false;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const cleanLine = line.replace(/^[+-]\s*/, '').trim();
      if (/^\[.*dev-dependencies.*\]/i.test(cleanLine)) {
        isDevSection = true;
        continue;
      } else if (/^\[.*dependencies.*\]/i.test(cleanLine)) {
        isDevSection = false;
        continue;
      }

      if (!line.startsWith('+') && !line.startsWith('-')) continue;
      if (line.startsWith('+++') || line.startsWith('---')) continue;

      const sign = line[0];
      const body = line.substring(1).trim();

      // Match simple: serde = "1.0.190" or inline table: serde = { version = "1.0.190", ... }
      const simpleMatch = body.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
      const tableMatch = body.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);

      const match = simpleMatch || tableMatch;
      if (!match) continue;

      const pkgName = match[1];
      const version = match[2];

      if (sign === '+') {
        addedMap.set(pkgName, { version, isDev: isDevSection });
      } else if (sign === '-') {
        removedMap.set(pkgName, { version, isDev: isDevSection });
      }
    }
  }

  correlateChanges(addedMap, removedMap, changes, warnings);
}

function parsePnpmLockDiff(
  hunks: { lines: string[] }[],
  changes: DependencyChange[],
  warnings: string[]
): void {
  const addedMap = new Map<string, { version: string; isDev: boolean }>();
  const removedMap = new Map<string, { version: string; isDev: boolean }>();
  const reservedKeys = new Set([
    'lockfileVersion',
    'specifier',
    'version',
    'resolution',
    'integrity',
    'tarball',
    'dev',
    'optional',
    'dependencies',
    'devDependencies',
    'packages',
    'snapshots'
  ]);

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue;
      if (line.startsWith('+++') || line.startsWith('---')) continue;

      const sign = line[0];
      const body = line.substring(1);

      if (sign === '+' && /tarball:\s*['"]?http:\/\//i.test(body)) {
        warnings.push('Unencrypted HTTP tarball URL detected in pnpm-lock.yaml resolution.');
      }

      // Match pnpm package key: /@scope/pkg@1.2.3: or 'lodash@4.17.21':
      const pkgKeyMatch = body.match(/^\s{2,4}['"]?\/?(@?[a-zA-Z0-9_\-./]+)@([0-9][a-zA-Z0-9_.\-+]*)['"]?\s*:/);
      if (pkgKeyMatch) {
        const pkgName = pkgKeyMatch[1];
        const version = pkgKeyMatch[2].split('(')[0];
        if (sign === '+') {
          addedMap.set(pkgName, { version, isDev: false });
        } else {
          removedMap.set(pkgName, { version, isDev: false });
        }
        continue;
      }

      // Match importer direct version mapping: pkg: 1.2.3
      const directMatch = body.match(/^\s{2,6}['"]?(@?[a-zA-Z0-9_\-./]+)['"]?\s*:\s*([0-9][a-zA-Z0-9_.\-+]*)/);
      if (directMatch && !reservedKeys.has(directMatch[1])) {
        const pkgName = directMatch[1];
        const version = directMatch[2].split('(')[0];
        if (sign === '+') {
          addedMap.set(pkgName, { version, isDev: false });
        } else {
          removedMap.set(pkgName, { version, isDev: false });
        }
      }
    }
  }

  correlateChanges(addedMap, removedMap, changes, warnings);
}

function parsePoetryLockDiff(
  hunks: { lines: string[] }[],
  changes: DependencyChange[],
  warnings: string[]
): void {
  const addedMap = new Map<string, { version: string; isDev: boolean }>();
  const removedMap = new Map<string, { version: string; isDev: boolean }>();

  let currentPkgName: string | null = null;
  let currentPkgSign: string = ' ';

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+++') || line.startsWith('---')) continue;

      const sign = line[0] === '+' || line[0] === '-' ? line[0] : ' ';
      const trimmed = line.substring(1).trim();

      if (trimmed === '[[package]]') {
        currentPkgName = null;
        currentPkgSign = sign;
        continue;
      }

      const nameMatch = trimmed.match(/^name\s*=\s*"([^"]+)"/);
      if (nameMatch) {
        currentPkgName = nameMatch[1].toLowerCase();
        currentPkgSign = sign;
        continue;
      }

      const versionMatch = trimmed.match(/^version\s*=\s*"([^"]+)"/);
      if (versionMatch && currentPkgName) {
        const version = versionMatch[1];
        const effectiveSign = sign !== ' ' ? sign : currentPkgSign;
        if (effectiveSign === '+') {
          addedMap.set(currentPkgName, { version, isDev: false });
        } else if (effectiveSign === '-') {
          removedMap.set(currentPkgName, { version, isDev: false });
        }
      }
    }
  }

  correlateChanges(addedMap, removedMap, changes, warnings);
}

function parseGoModSumDiff(
  hunks: { lines: string[] }[],
  changes: DependencyChange[],
  warnings: string[]
): void {
  const addedMap = new Map<string, { version: string; isDev: boolean }>();
  const removedMap = new Map<string, { version: string; isDev: boolean }>();

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue;
      if (line.startsWith('+++') || line.startsWith('---')) continue;

      const sign = line[0];
      const trimmed = line.substring(1).trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('module ') || trimmed.startsWith('go ')) {
        continue;
      }

      // Match go.mod require line or go.sum entry: github.com/owner/repo v1.2.3
      const match = trimmed.match(/^(?:require\s+)?([a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-/]+)\s+v([0-9][a-zA-Z0-9_.\-+]*?)(?:\/go\.mod)?(?:\s|$)/);
      if (!match) continue;

      const pkgName = match[1];
      const version = match[2];
      const isIndirect = /\/\/\s*indirect\b/.test(trimmed);

      if (sign === '+') {
        addedMap.set(pkgName, { version, isDev: isIndirect });
      } else if (sign === '-') {
        removedMap.set(pkgName, { version, isDev: isIndirect });
      }
    }
  }

  correlateChanges(addedMap, removedMap, changes, warnings);
}

function correlateChanges(
  addedMap: Map<string, { version: string; isDev: boolean }>,
  removedMap: Map<string, { version: string; isDev: boolean }>,
  changes: DependencyChange[],
  warnings: string[]
): void {
  for (const [pkgName, addInfo] of addedMap.entries()) {
    const riskFlags: string[] = [];

    if (SUSPICIOUS_PACKAGE_NAMES.some(rx => rx.test(pkgName))) {
      riskFlags.push('Suspicious or potentially typosquatted package name');
      warnings.push(`Potential typosquatting detected for package: '${pkgName}'`);
    }

    if (/^(?:git\+)?http:\/\//i.test(addInfo.version)) {
      riskFlags.push('Unencrypted HTTP dependency source');
      warnings.push(`Dependency '${pkgName}' uses an unencrypted HTTP source ('${addInfo.version}').`);
    }

    if (removedMap.has(pkgName)) {
      const remInfo = removedMap.get(pkgName)!;
      const isDowngrade = compareSemverLike(remInfo.version, addInfo.version) > 0;

      if (isDowngrade) {
        riskFlags.push('Dependency downgraded to older version');
      }

      if (/^[0-9]/.test(remInfo.version) && /^[~^>=*]/.test(addInfo.version)) {
        riskFlags.push('Version constraint loosened from pinned to range');
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
