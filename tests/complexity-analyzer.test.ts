import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { analyzeComplexity } from '../src/core/complexity-analyzer.ts';

test('complexity-analyzer: should calculate low complexity for simple code', () => {
  const diff = `diff --git a/src/math.ts b/src/math.ts
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,2 +1,3 @@
+const sum = (a: number, b: number) => a + b;
`;

  const parsed = parseUnifiedDiff(diff);
  const metrics = analyzeComplexity(parsed);

  assert.strictEqual(metrics.cyclomaticComplexity, 0);
  assert.strictEqual(metrics.hotspots.length, 0);
  assert.strictEqual(metrics.summary.includes('Low complexity'), true);
});

test('complexity-analyzer: should flag nested branching and hotspots', () => {
  const complexDiff = `diff --git a/src/processor.ts b/src/processor.ts
--- a/src/processor.ts
+++ b/src/processor.ts
@@ -1,2 +1,10 @@
+function process(data: any) {
+  if (data && data.valid) {
+    for (let i = 0; i < data.items.length; i++) {
+      if (data.items[i].active && data.items[i].score > 10 || data.force) {
+        doSomething();
+      }
+    }
+  }
+}
`;

  const parsed = parseUnifiedDiff(complexDiff);
  const metrics = analyzeComplexity(parsed);

  assert.strictEqual(metrics.cyclomaticComplexity > 3, true);
  assert.strictEqual(metrics.nestingDepth >= 3, true);
  assert.strictEqual(metrics.hotspots.length > 0, true);
});
