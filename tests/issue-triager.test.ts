import test from 'node:test';
import assert from 'node:assert';
import { triageIssue } from '../src/core/issue-triager.ts';

test('issue-triager: should categorize bug reports with reproduction steps', () => {
  const title = 'Crash when parsing empty unified diff';
  const body = `
### Environment
- Node: 22.0.0
- OS: Windows 11

### Steps to reproduce
1. Run diff-sentinel diff with empty file
2. See uncaught exception
`;

  const result = triageIssue(title, body);
  assert.strictEqual(result.category, 'bug');
  assert.strictEqual(result.hasReproductionSteps, true);
  assert.strictEqual(result.hasSystemDetails, true);
  assert.strictEqual(result.suggestedLabels.includes('bug'), true);
});

test('issue-triager: should categorize security issue with critical urgency', () => {
  const title = 'Potential RCE vulnerability in diff parser';
  const body = 'Found arbitrary code execution vulnerability when processing malformed patch.';

  const result = triageIssue(title, body);
  assert.strictEqual(result.category, 'security');
  assert.strictEqual(result.urgency, 'critical');
});

test('issue-triager: should categorize feature request', () => {
  const title = 'Add support for GitLab diff format';
  const body = 'It would be great to support GitLab merge request diffs.';

  const result = triageIssue(title, body);
  assert.strictEqual(result.category, 'feature');
  assert.strictEqual(result.suggestedLabels.includes('feature-request'), true);
});
