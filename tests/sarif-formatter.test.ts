import test from 'node:test';
import assert from 'node:assert';
import { generateSarifReport } from '../src/core/sarif-formatter.ts';
import type { BreakingChange, SecurityFinding } from '../src/types.ts';

test('sarif-formatter: should emit valid SARIF 2.1.0 schema structure', () => {
  const mockFindings: SecurityFinding[] = [
    {
      ruleId: 'SEC-001',
      category: 'secret',
      severity: 'critical',
      file: 'src/config.ts',
      line: 12,
      message: 'Detected OpenAI API Key',
      matchSnippet: 'sk-1234...',
      remediation: 'Revoke key immediately'
    }
  ];

  const mockBreaking: BreakingChange[] = [
    {
      symbolName: 'getUser',
      kind: 'function',
      changeType: 'removed',
      file: 'src/api.ts',
      description: 'Public function was removed',
      severity: 'breaking'
    }
  ];

  const sarif = generateSarifReport(mockFindings, mockBreaking);

  assert.strictEqual(sarif.version, '2.1.0');
  assert.strictEqual(sarif.runs.length, 1);
  assert.strictEqual(sarif.runs[0].tool.driver.name, 'diff-sentinel');
  assert.strictEqual(sarif.runs[0].results.length, 2);

  const secResult = sarif.runs[0].results.find(r => r.ruleId === 'SEC-001');
  assert.ok(secResult);
  assert.strictEqual(secResult.level, 'error');
  assert.strictEqual(secResult.locations[0].physicalLocation.artifactLocation.uri, 'src/config.ts');
  assert.strictEqual(secResult.locations[0].physicalLocation.region.startLine, 12);
});

test('sarif-formatter: should handle empty findings gracefully', () => {
  const sarif = generateSarifReport([]);
  assert.strictEqual(sarif.version, '2.1.0');
  assert.strictEqual(sarif.runs[0].results.length, 0);
  assert.strictEqual(sarif.runs[0].tool.driver.rules.length, 0);
});
