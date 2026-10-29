/**
 * diff-sentinel: PR Comment Formatter
 *
 * Formats a DiffAnalysisResult as a beautiful GitHub PR review comment
 * rendered in Markdown with tables, collapsible sections, and emoji.
 */

import type { DiffAnalysisResult, SecurityFinding, BreakingChange } from '../types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_EMOJI: Record<SecurityFinding['severity'], string> = {
  critical: '🔴',
  high: '🟡',
  medium: '🟠',
  low: '⚪',
};

const STATUS_EMOJI: Record<string, string> = {
  safe: '✅',
  review: '⚠️',
  block: '🚫',
};

function severityLabel(severity: SecurityFinding['severity']): string {
  return `${SEVERITY_EMOJI[severity]} ${severity.toUpperCase()}`;
}

/**
 * Determine an overall PR status string from the risk assessment.
 */
function resolveStatus(result: DiffAnalysisResult): string {
  const { riskAssessment, securityFindings } = result;

  const hasCritical = securityFindings.some((f) => f.severity === 'critical');
  if (hasCritical || riskAssessment.grade === 'F') {
    return `${STATUS_EMOJI.block} Merge Blocked`;
  }
  if (!riskAssessment.isSafeToMerge || riskAssessment.grade === 'D') {
    return `${STATUS_EMOJI.review} Review Required`;
  }
  if (riskAssessment.grade === 'C') {
    return `${STATUS_EMOJI.review} Review Required`;
  }
  return `${STATUS_EMOJI.safe} Safe to Merge`;
}

/**
 * Map a `BreakingChange.changeType` value to a human-readable label.
 */
function changeTypeLabel(changeType: BreakingChange['changeType']): string {
  switch (changeType) {
    case 'removed':
      return 'Removed';
    case 'signature_modified':
      return 'Signature modified';
    case 'visibility_reduced':
      return 'Visibility reduced';
    case 'type_narrowed':
      return 'Type narrowed';
    default:
      return changeType;
  }
}

/**
 * Escape pipe characters inside Markdown table cells so they don't break
 * column alignment.
 */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ---------------------------------------------------------------------------
// Section Builders
// ---------------------------------------------------------------------------

function buildHeader(): string {
  return '## 🛡️ diff-sentinel PR Audit';
}

function buildSummaryTable(result: DiffAnalysisResult): string {
  const { parsed, riskAssessment } = result;
  const status = resolveStatus(result);

  const rows: [string, string][] = [
    ['**Risk Score**', `${riskAssessment.score}/100 (Grade: ${riskAssessment.grade})`],
    ['**Status**', status],
    ['**Files Changed**', String(parsed.totalFiles)],
    ['**Churn**', `+${parsed.totalAdditions} / -${parsed.totalDeletions}`],
  ];

  const lines = [
    '| Metric | Value |',
    '|--------|-------|',
    ...rows.map(([metric, value]) => `| ${metric} | ${value} |`),
  ];

  return lines.join('\n');
}

function buildSecuritySection(findings: SecurityFinding[]): string {
  if (findings.length === 0) {
    return '### 🔒 Security Findings\n\n✅ No issues found';
  }

  const header = `### 🚨 Security Findings (${findings.length})`;

  const tableLines = [
    '| Severity | File | Line | Finding | Remediation |',
    '|----------|------|------|---------|-------------|',
    ...findings.map(
      (f) =>
        `| ${severityLabel(f.severity)} | ${escapeCell(f.file)} | ${f.line} | ${escapeCell(f.message)} | ${escapeCell(f.remediation)} |`,
    ),
  ];

  const body = [
    '<details>',
    '<summary>Click to expand</summary>',
    '',
    ...tableLines,
    '',
    '</details>',
  ];

  return [header, '', ...body].join('\n');
}

function buildBreakingChangesSection(changes: BreakingChange[]): string {
  if (changes.length === 0) {
    return '### 🔄 Breaking Changes\n\n✅ No breaking changes detected';
  }

  const header = `### ⚠️ Breaking Changes (${changes.length})`;

  const bullets = changes.map(
    (c) => `- \`${c.symbolName}\` in \`${c.file}\`: ${changeTypeLabel(c.changeType)} — ${c.description}`,
  );

  return [header, '', ...bullets].join('\n');
}

function buildTestCoverageSection(result: DiffAnalysisResult): string {
  const { testCoverageAlert } = result;

  if (!testCoverageAlert.warning) {
    return '';
  }

  return ['### 🧪 Test Coverage', '', `> ⚠️ ${testCoverageAlert.warning}`].join('\n');
}

function buildRecommendations(recommendations: string[]): string {
  if (recommendations.length === 0) {
    return '';
  }

  const header = '### 💡 Recommendations';
  const checkboxes = recommendations.map((r) => `- [ ] ${r}`);

  return [header, '', ...checkboxes].join('\n');
}

function buildFooter(): string {
  return '---\n*Powered by [diff-sentinel](https://github.com/your-username/diff-sentinel) 🛡️*';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a `DiffAnalysisResult` as a GitHub-flavoured Markdown PR comment.
 *
 * The returned string is ready to be posted as a PR review comment via the
 * GitHub API.
 */
export function formatPRComment(result: DiffAnalysisResult): string {
  const sections: string[] = [
    buildHeader(),
    '',
    buildSummaryTable(result),
    '',
    buildSecuritySection(result.securityFindings),
    '',
    buildBreakingChangesSection(result.breakingChanges),
  ];

  const testCoverage = buildTestCoverageSection(result);
  if (testCoverage) {
    sections.push('', testCoverage);
  }

  const recommendations = buildRecommendations(result.riskAssessment.recommendations);
  if (recommendations) {
    sections.push('', recommendations);
  }

  sections.push('', buildFooter());

  return sections.join('\n');
}
