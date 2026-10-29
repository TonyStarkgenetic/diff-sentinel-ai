import test from 'node:test';
import assert from 'node:assert';
import { analyzeDiff } from '../src/index.ts';
import { formatPRComment } from '../src/core/pr-formatter.ts';

test('pr-formatter: should format clean PR as safe comment', () => {
  const cleanDiff = `diff --git a/src/docs.ts b/src/docs.ts
--- a/src/docs.ts
+++ b/src/docs.ts
@@ -1,2 +1,3 @@
+// documentation update
`;

  const analysis = analyzeDiff(cleanDiff);
  const comment = formatPRComment(analysis);

  assert.strictEqual(comment.includes('diff-sentinel PR Audit'), true);
  assert.strictEqual(comment.includes('Safe to Merge'), true);
  assert.strictEqual(comment.includes('Risk Score'), true);
});

test('pr-formatter: should format security findings and breaking changes with emojis', () => {
  const riskyDiff = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,3 @@
-export function login(email: string) {}
+export function login(email: string, apiKey: string) { const key = "sk-1234567890abcdef1234567890abcdef"; }
`;

  const analysis = analyzeDiff(riskyDiff);
  const comment = formatPRComment(analysis);

  assert.strictEqual(comment.includes('Security Findings'), true);
  assert.strictEqual(comment.includes('Breaking Changes'), true);
  assert.strictEqual(comment.includes('🔴'), true);
});
