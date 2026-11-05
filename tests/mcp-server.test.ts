import test from 'node:test';
import assert from 'node:assert';
import { MCP_TOOLS } from '../src/mcp/tools.ts';

test('mcp-tools: should list required tools with valid schemas', () => {
  const toolNames = MCP_TOOLS.map(t => t.name);
  assert.strictEqual(toolNames.includes('analyze_diff'), true);
  assert.strictEqual(toolNames.includes('scan_security'), true);
  assert.strictEqual(toolNames.includes('triage_issue'), true);
  assert.strictEqual(toolNames.includes('generate_changelog'), true);
  assert.strictEqual(toolNames.includes('audit_repository'), true);
  assert.strictEqual(toolNames.includes('analyze_complexity'), true);
  assert.strictEqual(toolNames.includes('analyze_dependencies'), true);
  assert.strictEqual(toolNames.includes('format_pr_comment'), true);
  assert.strictEqual(toolNames.includes('export_sarif'), true);
  assert.strictEqual(toolNames.includes('pack_diff_for_llm'), true);

  for (const tool of MCP_TOOLS) {
    assert.strictEqual(typeof tool.name, 'string');
    assert.strictEqual(typeof tool.description, 'string');
    assert.strictEqual(tool.inputSchema.type, 'object');
    assert.strictEqual(typeof tool.inputSchema.properties, 'object');
  }
});
