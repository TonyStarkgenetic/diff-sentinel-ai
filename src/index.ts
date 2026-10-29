/**
 * diff-sentinel: Autonomous Open-Source Maintainer Sentinel
 * Main programmatic export entry
 */

import { parseUnifiedDiff } from './core/diff-parser.ts';
import { scanDiffForSecurity } from './core/security-scanner.ts';
import { detectBreakingChanges } from './core/ast-analyzer.ts';
import { assessDiffRisk } from './core/risk-engine.ts';
import { triageIssue } from './core/issue-triager.ts';
import { generateChangelog, parseConventionalCommit } from './core/changelog-gen.ts';
import { auditRepository } from './core/repo-auditor.ts';
import { analyzeComplexity } from './core/complexity-analyzer.ts';
import { analyzeDependencies } from './core/dep-analyzer.ts';
import { formatPRComment } from './core/pr-formatter.ts';
import type { DiffAnalysisResult } from './types.ts';

export type * from './types.ts';
export {
  parseUnifiedDiff,
  scanDiffForSecurity,
  detectBreakingChanges,
  assessDiffRisk,
  triageIssue,
  generateChangelog,
  parseConventionalCommit,
  auditRepository,
  analyzeComplexity,
  analyzeDependencies,
  formatPRComment
};

/**
 * Perform complete end-to-end audit on a git unified diff
 */
export function analyzeDiff(rawDiff: string): DiffAnalysisResult {
  const parsed = parseUnifiedDiff(rawDiff);
  const securityFindings = scanDiffForSecurity(parsed);
  const breakingChanges = detectBreakingChanges(parsed);
  const riskAssessment = assessDiffRisk(parsed, securityFindings, breakingChanges);

  const hasTestChanges = parsed.files.some(f =>
    /\.(test|spec)\.[a-z]+$/i.test(f.newPath) || f.newPath.includes('tests/')
  );
  const productionCodeChanged = parsed.files.some(f =>
    !/\.(test|spec)\.[a-z]+$/i.test(f.newPath) &&
    !f.newPath.includes('tests/') &&
    !f.newPath.endsWith('.md')
  );

  return {
    parsed,
    securityFindings,
    breakingChanges,
    riskAssessment,
    testCoverageAlert: {
      hasTestChanges,
      productionCodeChanged,
      warning:
        productionCodeChanged && !hasTestChanges
          ? 'Warning: Production code was modified without test updates.'
          : undefined
    }
  };
}
