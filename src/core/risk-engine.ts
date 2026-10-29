/**
 * diff-sentinel: Multi-factor PR Risk Assessment Engine
 */

import type {
  BreakingChange,
  DiffRiskAssessment,
  ParsedDiff,
  RiskFactor,
  SecurityFinding
} from '../types.ts';

const SENSITIVE_PATHS = [
  /package\.json$/,
  /cargo\.toml$/i,
  /requirements.*\.txt$/i,
  /pyproject\.toml$/i,
  /\.github\/workflows\//i,
  /dockerfile/i,
  /docker-compose/i,
  /(?:auth|crypto|security|jwt|session|token)/i,
  /(?:migration|migrations)\//i
];

export function assessDiffRisk(
  parsedDiff: ParsedDiff,
  securityFindings: SecurityFinding[],
  breakingChanges: BreakingChange[]
): DiffRiskAssessment {
  const riskFactors: RiskFactor[] = [];
  const recommendations: string[] = [];

  // 1. Churn Factor (Size & Churn)
  const totalChurn = parsedDiff.totalAdditions + parsedDiff.totalDeletions;
  let churnScore = 0;
  if (totalChurn > 1000) churnScore = 90;
  else if (totalChurn > 500) churnScore = 65;
  else if (totalChurn > 200) churnScore = 40;
  else if (totalChurn > 50) churnScore = 15;
  else churnScore = 5;

  riskFactors.push({
    name: 'Code Churn',
    score: churnScore,
    weight: 0.2,
    description: `${parsedDiff.totalFiles} files changed, +${parsedDiff.totalAdditions}/-${parsedDiff.totalDeletions} lines.`
  });

  if (totalChurn > 500) {
    recommendations.push('Large PR size (>500 lines). Consider splitting into smaller atomic PRs for faster maintainer review.');
  }

  // 2. Blast Radius (Sensitive Paths & Architecture Impact)
  let sensitiveFileCount = 0;
  for (const file of parsedDiff.files) {
    const isSensitive = SENSITIVE_PATHS.some(rx => rx.test(file.newPath));
    if (isSensitive) sensitiveFileCount++;
  }

  const blastScore = Math.min(100, sensitiveFileCount * 25);
  riskFactors.push({
    name: 'Blast Radius',
    score: blastScore,
    weight: 0.25,
    description: `${sensitiveFileCount} sensitive core files modified (CI, dependencies, auth, or migrations).`
  });

  if (sensitiveFileCount > 0) {
    recommendations.push('Verify changes to CI/CD workflows and core dependencies closely.');
  }

  // 3. Security Findings Penalty
  let securityScore = 0;
  for (const finding of securityFindings) {
    if (finding.severity === 'critical') securityScore += 50;
    else if (finding.severity === 'high') securityScore += 30;
    else if (finding.severity === 'medium') securityScore += 15;
    else securityScore += 5;
  }
  securityScore = Math.min(100, securityScore);

  riskFactors.push({
    name: 'Security & Secrets',
    score: securityScore,
    weight: 0.3,
    description: `${securityFindings.length} security findings detected.`
  });

  if (securityFindings.length > 0) {
    recommendations.push('Block merge until all security alerts and exposed credentials are remediated.');
  }

  // 4. Breaking Changes Penalty
  const breakingScore = Math.min(100, breakingChanges.length * 40);
  riskFactors.push({
    name: 'API Breaking Changes',
    score: breakingScore,
    weight: 0.15,
    description: `${breakingChanges.length} public symbol modifications detected.`
  });

  if (breakingChanges.length > 0) {
    recommendations.push('Breaking changes found. Require a SemVer MAJOR version bump and deprecation warning.');
  }

  // 5. Test Coverage Discrepancy
  const hasTestFiles = parsedDiff.files.some(f =>
    /\.(test|spec)\.[a-z]+$/i.test(f.newPath) || f.newPath.includes('tests/')
  );
  const hasProdChanges = parsedDiff.files.some(f =>
    !/\.(test|spec)\.[a-z]+$/i.test(f.newPath) &&
    !f.newPath.includes('tests/') &&
    !f.newPath.endsWith('.md')
  );

  let testGapScore = 0;
  if (hasProdChanges && !hasTestFiles && totalChurn > 30) {
    testGapScore = 70;
    recommendations.push('Production logic modified with no accompanying test updates. Add unit or regression tests.');
  }

  riskFactors.push({
    name: 'Test Coverage Gap',
    score: testGapScore,
    weight: 0.1,
    description: hasProdChanges && !hasTestFiles && totalChurn > 30
      ? 'No test files included in PR'
      : 'Tests included or not required'
  });

  // Calculate composite weighted score (0 to 100)
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const factor of riskFactors) {
    totalWeightedScore += factor.score * factor.weight;
    totalWeight += factor.weight;
  }

  const finalScore = Math.round(totalWeightedScore / totalWeight);

  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
  if (finalScore >= 80) grade = 'F';
  else if (finalScore >= 60) grade = 'D';
  else if (finalScore >= 40) grade = 'C';
  else if (finalScore >= 20) grade = 'B';
  else grade = 'A';

  const isSafeToMerge = finalScore < 50 && securityScore === 0 && breakingScore === 0;

  const summary = isSafeToMerge
    ? `Safe to merge (Risk Score: ${finalScore}/100, Grade ${grade}). All core quality gates passed.`
    : `Attention required (Risk Score: ${finalScore}/100, Grade ${grade}). Requires maintainer review before merging.`;

  return {
    score: finalScore,
    grade,
    isSafeToMerge,
    riskFactors,
    summary,
    recommendations
  };
}
