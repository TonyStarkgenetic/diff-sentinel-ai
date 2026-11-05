import test from 'node:test';
import assert from 'node:assert';
import { parseUnifiedDiff } from '../src/core/diff-parser.ts';
import { estimateTokens, packDiffForLlm } from '../src/core/diff-compressor.ts';

test('diff-compressor: estimateTokens should calculate reasonable token count', () => {
  const sample = 'function test() { return 42; }';
  const tokens = estimateTokens(sample);
  assert.strictEqual(tokens > 5 && tokens < 15, true);
});

test('diff-compressor: should strip lockfiles and report token savings', () => {
  const diffWithLockfile = `diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,500 @@
+line1
+line2
+line3
diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+export const version = '1.3.0';
`;

  const parsed = parseUnifiedDiff(diffWithLockfile);
  const packed = packDiffForLlm(parsed);

  assert.strictEqual(packed.totalFiles, 2);
  assert.strictEqual(packed.omittedFiles, 1);
  assert.strictEqual(packed.formattedOutput.includes('[Omitted generated/lockfile content'), true);
  assert.strictEqual(packed.formattedOutput.includes('src/index.ts'), true);
  assert.strictEqual(packed.tokenSavingsPercent >= 0, true);
});
