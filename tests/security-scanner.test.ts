import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { scanDiffForSecurity } from '../src/core/security-scanner.ts';

test('security-scanner: should detect OpenAI key in diff additions', () => {
  const diffWithKey = `diff --git a/config.ts b/config.ts
--- a/config.ts
+++ b/config.ts
@@ -1,2 +1,3 @@
+// hardcoded key
+const OPENAI_KEY = "sk-abcdef1234567890abcdef1234567890abcdef12";
`;

  const parsed = parseUnifiedDiff(diffWithKey);
  const findings = scanDiffForSecurity(parsed);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'SEC-001');
  assert.strictEqual(findings[0].severity, 'critical');
  assert.strictEqual(findings[0].file, 'config.ts');
});

test('security-scanner: should detect Anthropic key in diff additions', () => {
  const diffWithKey = `diff --git a/llm.py b/llm.py
--- a/llm.py
+++ b/llm.py
@@ -1,2 +1,3 @@
+api_key = "sk-ant-api03-abcdef1234567890abcdef1234567890abcdef1234567890"
`;

  const parsed = parseUnifiedDiff(diffWithKey);
  const findings = scanDiffForSecurity(parsed);

  const anthropicFinding = findings.find(f => f.ruleId === 'SEC-002');
  assert.ok(anthropicFinding, 'Should detect SEC-002 Anthropic API key');
  assert.strictEqual(anthropicFinding.severity, 'critical');
});

test('security-scanner: should detect dangerous eval call', () => {
  const diffWithEval = `diff --git a/runner.ts b/runner.ts
--- a/runner.ts
+++ b/runner.ts
@@ -1,2 +1,3 @@
+const res = eval('console.log(' + userInput + ')');
`;

  const parsed = parseUnifiedDiff(diffWithEval);
  const findings = scanDiffForSecurity(parsed);

  assert.strictEqual(findings.some(f => f.ruleId === 'VULN-001'), true);
});
