/**
 * diff-sentinel: Open-Source Repository Hygiene & Health Auditor
 */

import fs from 'node:fs';
import path from 'node:path';
import type { RepoAuditResult } from '../types.ts';

export function auditRepository(repoPath: string): RepoAuditResult {
  const checkExists = (relPath: string): boolean => {
    try {
      return fs.existsSync(path.join(repoPath, relPath));
    } catch {
      return false;
    }
  };

  const hasReadme = checkExists('README.md') || checkExists('readme.md');
  const hasLicense = checkExists('LICENSE') || checkExists('LICENSE.md') || checkExists('LICENSE.txt');
  const hasContributing = checkExists('CONTRIBUTING.md') || checkExists('.github/CONTRIBUTING.md');
  const hasSecurityPolicy = checkExists('SECURITY.md') || checkExists('.github/SECURITY.md');
  const hasCodeOfConduct = checkExists('CODE_OF_CONDUCT.md') || checkExists('.github/CODE_OF_CONDUCT.md');

  const hasIssueTemplates =
    checkExists('.github/ISSUE_TEMPLATE') ||
    checkExists('.github/issue_template.md');

  const hasWorkflows =
    checkExists('.github/workflows/ci.yml') ||
    checkExists('.github/workflows/main.yml') ||
    checkExists('.github/workflows/test.yml') ||
    checkExists('.github/workflows');

  const hasTestSuites =
    checkExists('tests') ||
    checkExists('test') ||
    checkExists('__tests__') ||
    checkExists('src/tests');

  const hasPackageManifest =
    checkExists('package.json') ||
    checkExists('Cargo.toml') ||
    checkExists('pyproject.toml') ||
    checkExists('go.mod');

  const checks = {
    hasReadme,
    hasLicense,
    hasContributing,
    hasSecurityPolicy,
    hasCodeOfConduct,
    hasIssueTemplates,
    hasWorkflows,
    hasTestSuites,
    hasPackageManifest
  };

  const missingFiles: string[] = [];
  const recommendations: string[] = [];

  if (!hasReadme) missingFiles.push('README.md');
  if (!hasLicense) {
    missingFiles.push('LICENSE');
    recommendations.push('Add an OSI-approved license (Apache-2.0 or MIT) to qualify for open-source grants.');
  }
  if (!hasContributing) {
    missingFiles.push('CONTRIBUTING.md');
    recommendations.push('Add CONTRIBUTING.md guidelines to welcome external contributors.');
  }
  if (!hasSecurityPolicy) {
    missingFiles.push('SECURITY.md');
    recommendations.push('Add a SECURITY.md file outlining vulnerability disclosure procedures.');
  }
  if (!hasCodeOfConduct) {
    missingFiles.push('CODE_OF_CONDUCT.md');
    recommendations.push('Add a CODE_OF_CONDUCT.md based on Contributor Covenant.');
  }
  if (!hasIssueTemplates) {
    missingFiles.push('.github/ISSUE_TEMPLATE');
    recommendations.push('Add GitHub Issue Templates for structured bug reports and feature requests.');
  }
  if (!hasWorkflows) {
    missingFiles.push('.github/workflows/ci.yml');
    recommendations.push('Configure GitHub Actions CI workflow to run automated tests on every PR.');
  }
  if (!hasTestSuites) {
    missingFiles.push('tests/');
    recommendations.push('Add automated unit/integration test suites.');
  }

  // Calculate score out of 100
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const healthScore = Math.round((passedChecks / totalChecks) * 100);

  let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'A';
  if (healthScore >= 95) grade = 'A+';
  else if (healthScore >= 80) grade = 'A';
  else if (healthScore >= 65) grade = 'B';
  else if (healthScore >= 50) grade = 'C';
  else grade = 'F';

  return {
    healthScore,
    grade,
    checks,
    missingFiles,
    recommendations
  };
}
