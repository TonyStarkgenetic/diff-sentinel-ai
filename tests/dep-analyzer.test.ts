import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { analyzeDependencies } from '../src/core/dep-analyzer.ts';

test('dep-analyzer: should detect added and upgraded dependencies in package.json', () => {
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

test('dep-analyzer: should parse requirements.txt and Cargo.toml dependency diffs', () => {
  const polyglotDepDiff = `diff --git a/requirements.txt b/requirements.txt
--- a/requirements.txt
+++ b/requirements.txt
@@ -1,2 +1,3 @@
-requests==2.32.0
+requests==2.28.0
+pydantic==2.9.0
diff --git a/Cargo.toml b/Cargo.toml
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -6,2 +6,3 @@
 [dependencies]
-serde = "1.0.190"
+serde = { version = "1.0.210", features = ["derive"] }
+tokio = "1.40.0"
`;

  const parsed = parseUnifiedDiff(polyglotDepDiff);
  const analysis = analyzeDependencies(parsed);

  assert.strictEqual(analysis.totalAdded, 2);
  assert.strictEqual(analysis.totalUpgraded, 1);
  assert.strictEqual(analysis.totalDowngraded, 1);
  assert.strictEqual(analysis.changes.some(c => c.name === 'requests' && c.changeType === 'downgraded'), true);
  assert.strictEqual(analysis.changes.some(c => c.name === 'serde' && c.changeType === 'upgraded'), true);
  assert.strictEqual(analysis.changes.some(c => c.name === 'tokio' && c.changeType === 'added'), true);
});
