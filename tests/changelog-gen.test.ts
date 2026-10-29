import test from 'node:test';
import assert from 'node:assert';
import { generateChangelog, parseConventionalCommit } from '../src/core/changelog-gen.ts';

test('changelog-gen: should parse conventional commits correctly', () => {
  const commit = parseConventionalCommit('feat(parser): add support for binary diffs');
  assert.strictEqual(commit?.type, 'feat');
  assert.strictEqual(commit?.scope, 'parser');
  assert.strictEqual(commit?.description, 'add support for binary diffs');
  assert.strictEqual(commit?.isBreaking, false);
});

test('changelog-gen: should recommend MAJOR bump for breaking change', () => {
  const commits = [
    'feat!: drop support for Node 16',
    'fix: resolve memory leak in watcher'
  ];

  const release = generateChangelog(commits, '2.0.0');
  assert.strictEqual(release.recommendedBump, 'major');
  assert.strictEqual(release.breakingChanges.length, 1);
  assert.strictEqual(release.fixes.length, 1);
  assert.strictEqual(release.markdown.includes('BREAKING CHANGES'), true);
});

test('changelog-gen: should recommend MINOR bump for feat commit', () => {
  const commits = [
    'feat(mcp): add audit_repo tool',
    'fix: typo in readme'
  ];

  const release = generateChangelog(commits, '1.1.0');
  assert.strictEqual(release.recommendedBump, 'minor');
  assert.strictEqual(release.features.length, 1);
  assert.strictEqual(release.fixes.length, 1);
});
