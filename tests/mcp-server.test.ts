import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
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

test('SKILL.md: should adhere to Agent Skills specification and document all MCP tools', () => {
  const skillPath = path.resolve(process.cwd(), 'SKILL.md');
  assert.strictEqual(fs.existsSync(skillPath), true, 'SKILL.md must exist in repository root');

  const content = fs.readFileSync(skillPath, 'utf-8').replace(/\r\n/g, '\n');
  assert.strictEqual(content.startsWith('---\n'), true, 'SKILL.md must start with YAML frontmatter');

  const frontmatterEnd = content.indexOf('\n---\n', 4);
  assert.strictEqual(frontmatterEnd > 0, true, 'SKILL.md must have closing YAML frontmatter delimiter');

  const frontmatter = content.slice(4, frontmatterEnd);
  assert.strictEqual(/^name:\s*diff-sentinel$/m.test(frontmatter), true, 'frontmatter must contain name: diff-sentinel');
  assert.strictEqual(/^description:\s*.+/m.test(frontmatter), true, 'frontmatter must contain description');
  assert.strictEqual(/^license:\s*Apache-2\.0$/m.test(frontmatter), true, 'frontmatter must contain license: Apache-2.0');
  assert.strictEqual(/^compatibility:\s*.+/m.test(frontmatter), true, 'frontmatter must contain compatibility');

  for (const tool of MCP_TOOLS) {
    assert.strictEqual(
      content.includes(tool.name),
      true,
      `SKILL.md should document MCP tool: ${tool.name}`
    );
  }
});
