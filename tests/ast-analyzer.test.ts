import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { detectBreakingChanges } from '../src/core/ast-analyzer.ts';

test('ast-analyzer: should flag removed exported function as breaking', () => {
  const diff = `diff --git a/src/api.ts b/src/api.ts
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,4 +1,2 @@
-export function calculateMetric(a: number, b: number) {
-  return a + b;
-}
 export function other() {}
`;

  const parsed = parseUnifiedDiff(diff);
  const breaking = detectBreakingChanges(parsed);

  assert.strictEqual(breaking.length, 1);
  assert.strictEqual(breaking[0].symbolName, 'calculateMetric');
  assert.strictEqual(breaking[0].changeType, 'removed');
  assert.strictEqual(breaking[0].severity, 'breaking');
});

test('ast-analyzer: should flag added mandatory parameters as signature modification', () => {
  const diff = `diff --git a/src/service.ts b/src/service.ts
--- a/src/service.ts
+++ b/src/service.ts
@@ -1,3 +1,3 @@
-export function fetchData(endpoint: string) {}
+export function fetchData(endpoint: string, apiKey: string, timeout: number) {}
`;

  const parsed = parseUnifiedDiff(diff);
  const breaking = detectBreakingChanges(parsed);

  assert.strictEqual(breaking.length, 1);
  assert.strictEqual(breaking[0].symbolName, 'fetchData');
  assert.strictEqual(breaking[0].changeType, 'signature_modified');
});
