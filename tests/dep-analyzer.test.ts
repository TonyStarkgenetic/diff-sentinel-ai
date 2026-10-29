import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { analyzeDependencies } from '../src/core/dep-analyzer.ts';

test('dep-analyzer: should detect added and upgraded dependencies', () => {
  const packageDiff = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -10,3 +10,4 @@
   "dependencies": {
-    "lodash": "^4.17.20",
+    "lodash": "^4.17.21",
+    "fast-glob": "^3.3.2"
   }
`;

  const parsed = parseUnifiedDiff(packageDiff);
  const analysis = analyzeDependencies(parsed);

  assert.strictEqual(analysis.totalAdded, 1);
  assert.strictEqual(analysis.totalUpgraded, 1);
  assert.strictEqual(analysis.changes.some(c => c.name === 'fast-glob'), true);
  assert.strictEqual(analysis.changes.some(c => c.name === 'lodash' && c.changeType === 'upgraded'), true);
});

test('dep-analyzer: should flag downgraded dependency and loosened version pins', () => {
  const downgradeDiff = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -10,2 +10,2 @@
-    "react": "18.3.1"
+    "react": "^18.2.0"
`;

  const parsed = parseUnifiedDiff(downgradeDiff);
  const analysis = analyzeDependencies(parsed);

  assert.strictEqual(analysis.totalDowngraded, 1);
  assert.strictEqual(analysis.riskScore > 30, true);
  const reactChange = analysis.changes.find(c => c.name === 'react');
  assert.ok(reactChange);
  assert.strictEqual(reactChange.riskFlags.some(f => f.includes('loosened')), true);
});
