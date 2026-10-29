import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { assessDiffRisk } from '../src/core/risk-engine.ts';
import type { SecurityFinding, BreakingChange } from '../src/types.ts';

test('risk-engine: should give safe grade A for small clean PR', () => {
  const smallDiff = `diff --git a/src/docs.ts b/src/docs.ts
--- a/src/docs.ts
+++ b/src/docs.ts
@@ -1,2 +1,3 @@
+// updated comment
`;

  const parsed = parseUnifiedDiff(smallDiff);
  const assessment = assessDiffRisk(parsed, [], []);

  assert.strictEqual(assessment.grade, 'A');
  assert.strictEqual(assessment.isSafeToMerge, true);
  assert.strictEqual(assessment.score < 25, true);
});

test('risk-engine: should flag critical security finding as unsafe to merge', () => {
  const parsed = parseUnifiedDiff(`diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n+foo`);
  const mockFinding: SecurityFinding = {
    ruleId: 'SEC-001',
    category: 'secret',
    severity: 'critical',
    file: 'a.ts',
    line: 1,
    message: 'Leaked API key',
    matchSnippet: 'sk-1234',
    remediation: 'Revoke key'
  };

  const assessment = assessDiffRisk(parsed, [mockFinding], []);
  assert.strictEqual(assessment.isSafeToMerge, false);
});
