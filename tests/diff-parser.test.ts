import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff, sanitizeDiffPath } from '../src/core/diff-parser.ts';

test('parseUnifiedDiff: should handle empty diff gracefully', () => {
  const result = parseUnifiedDiff('');
  assert.strictEqual(result.totalFiles, 0);
  assert.strictEqual(result.totalAdditions, 0);
  assert.strictEqual(result.totalDeletions, 0);
});

test('parseUnifiedDiff: should parse git diff with additions and deletions', () => {
  const sampleDiff = `diff --git a/src/index.ts b/src/index.ts
index 1234567..89abcdef 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
 const a = 1;
-const b = 2;
+const b = 20;
+const c = 30;
 export default a;
`;

  const result = parseUnifiedDiff(sampleDiff);
  assert.strictEqual(result.totalFiles, 1);
  assert.strictEqual(result.files[0].oldPath, 'src/index.ts');
  assert.strictEqual(result.files[0].newPath, 'src/index.ts');
  assert.strictEqual(result.totalAdditions, 2);
  assert.strictEqual(result.totalDeletions, 1);
  assert.strictEqual(result.files[0].hunks.length, 1);
});

test('parseUnifiedDiff: should recognize new files and renames', () => {
  const newFileDiff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,2 @@
+export const name = 'diff-sentinel';
+export const version = '1.0.0';
`;

  const result = parseUnifiedDiff(newFileDiff);
  assert.strictEqual(result.totalFiles, 1);
  assert.strictEqual(result.files[0].isNew, true);
  assert.strictEqual(result.totalAdditions, 2);
});

test('sanitizeDiffPath: should neutralize directory traversal and drive-letter prefixes', () => {
  assert.strictEqual(sanitizeDiffPath('../../../etc/passwd'), 'etc/passwd');
  assert.strictEqual(sanitizeDiffPath('C:\\Windows\\System32\\cmd.exe'), 'Windows/System32/cmd.exe');
  assert.strictEqual(sanitizeDiffPath('/var/run/../../src/app.ts'), 'var/run/src/app.ts');

  const traversalDiff = `diff --git a/../../../../etc/shadow b/../../../../etc/shadow
--- a/../../../../etc/shadow
+++ b/../../../../etc/shadow
@@ -1,1 +1,1 @@
-root:x
+root:y
`;
  const parsed = parseUnifiedDiff(traversalDiff);
  assert.strictEqual(parsed.files[0].newPath, 'etc/shadow');
  assert.strictEqual(parsed.files[0].newPath.includes('..'), false);
});
