import test from 'node:test';
import assert from 'node:assert';
import { auditRepository } from '../src/core/repo-auditor.ts';

test('repo-auditor: should return audit results for valid directory', () => {
  const result = auditRepository(process.cwd());
  assert.strictEqual(typeof result.healthScore, 'number');
  assert.strictEqual(typeof result.grade, 'string');
  assert.strictEqual(Array.isArray(result.missingFiles), true);
  assert.strictEqual(Array.isArray(result.recommendations), true);
});
