/**
 * diff-sentinel: Intelligent Issue Triage Engine
 */

import type { IssueTriageResult } from '../types.ts';

export function triageIssue(title: string, body: string): IssueTriageResult {
  const fullText = `${title}\n${body}`.toLowerCase();

  // 1. Detect Category
  let category: IssueTriageResult['category'] = 'question';
  const suggestedLabels: string[] = [];

  const isSecurity =
    /\b(vulnerability|cve|exploit|rce|injection|xss|secret leak|privilege escalation)\b/i.test(
      fullText
    );
  const isBug =
    /\b(bug|error|crash|exception|fail|failed|broken|panic|segfault|not working|cannot)\b/i.test(
      fullText
    );
  const isFeature =
    /\b(feature|enhancement|request|support|add|proposal|rfc|suggestion)\b/i.test(
      fullText
    );
  const isPerformance =
    /\b(slow|performance|memory leak|latency|cpu|bottleneck|optimize)\b/i.test(
      fullText
    );
  const isDocumentation =
    /\b(docs|documentation|typo|readme|guide|tutorial|example)\b/i.test(
      fullText
    );

  if (isSecurity) {
    category = 'security';
    suggestedLabels.push('security', 'high-priority');
  } else if (isBug) {
    category = 'bug';
    suggestedLabels.push('bug', 'needs-triage');
  } else if (isPerformance) {
    category = 'performance';
    suggestedLabels.push('performance', 'enhancement');
  } else if (isFeature) {
    category = 'feature';
    suggestedLabels.push('enhancement', 'feature-request');
  } else if (isDocumentation) {
    category = 'documentation';
    suggestedLabels.push('documentation', 'good-first-issue');
  } else {
    category = 'question';
    suggestedLabels.push('question');
  }

  // 2. Detect Quality Signals (Repro steps & System details)
  const hasReproductionSteps =
    /(?:steps to reproduce|how to reproduce|reproduction|reproduce|to reproduce)/i.test(
      body
    ) || /(?:1\.|2\.|- step)/i.test(body);

  const hasSystemDetails =
    /(?:node|python|os|windows|linux|macos|version|browser|runtime|arch)/i.test(
      body
    );

  // 3. Urgency
  let urgency: IssueTriageResult['urgency'] = 'medium';
  if (category === 'security' || fullText.includes('critical') || fullText.includes('production outage')) {
    urgency = 'critical';
  } else if (category === 'bug' && !hasReproductionSteps) {
    urgency = 'low'; // Needs more info from author
    suggestedLabels.push('needs-repro');
  } else if (category === 'bug' && hasReproductionSteps) {
    urgency = 'high';
  }

  // 4. Complexity
  let estimatedComplexity: IssueTriageResult['estimatedComplexity'] = 'medium';
  if (category === 'documentation') {
    estimatedComplexity = 'trivial';
  } else if (category === 'security' || category === 'performance') {
    estimatedComplexity = 'complex';
  }

  const recommendedAction = !hasReproductionSteps && category === 'bug'
    ? 'Request minimal reproduction repository or reproduction steps before debugging.'
    : category === 'security'
    ? 'Escalate privately according to SECURITY.md policy; do not discuss exploit publicly.'
    : 'Ready for maintainer backlog assignment.';

  return {
    title,
    category,
    urgency,
    suggestedLabels,
    hasReproductionSteps,
    hasSystemDetails,
    summary: `Triaged as [${category.toUpperCase()}] with ${urgency.toUpperCase()} urgency.`,
    recommendedAction,
    estimatedComplexity
  };
}
