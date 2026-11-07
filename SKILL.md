---
name: diff-sentinel
description: Git diff analyzer, secret detector, and PR audit tool. Scans patches for leaked API keys, breaking API signature changes, dependency risks, and cyclomatic complexity. Use when reviewing code, checking uncommitted diffs, packaging patches for LLMs, or running pre-commit checks.
license: Apache-2.0
compatibility: Node.js 22+ and git. Zero external runtime dependencies.
metadata:
  author: TonyStarkgenetic
  version: "1.3.0"
  repository: https://github.com/TonyStarkgenetic/diff-sentinel-ai
  mcp-protocol: "2024-11-05"
---

# diff-sentinel

A lightweight git diff analyzer and Model Context Protocol (MCP) server for inspecting code changes before merging.

## When to Use

Use this skill when:
- Reviewing pull requests or checking local uncommitted changes (`git diff`).
- Scanning diffs for exposed credentials (API keys, tokens, database passwords) and dangerous functions (`eval`, shell exec).
- Checking for breaking changes in exported functions, classes, and interfaces (TypeScript, JavaScript, Python, Go, Rust).
- Compressing large diffs to avoid wasting LLM context window tokens on lockfiles or generated bundles.
- Auditing dependency changes in `package.json`, `requirements.txt`, or `Cargo.toml`.

---

## Instructions

### 1. Get the Diff
If a diff is not provided, generate one:
```bash
# Unstaged + staged changes:
git diff HEAD

# Branch comparison against main:
git diff origin/main...HEAD
```

### 2. Run the Audit

#### Via MCP (if configured):
- `analyze_diff`: Run a full check on `{ "diff": "<patch>" }` (secrets, breaking changes, test coverage warning, risk score).
- `scan_security`: Quick secret scan on `{ "diff": "<patch>" }`.
- `pack_diff_for_llm`: Strip lockfiles/assets from `{ "diff": "<patch>" }` to save context tokens.
- `analyze_dependencies`: Inspect package manifest changes in `{ "diff": "<patch>" }`.
- `analyze_complexity`: Calculate cyclomatic complexity and flag deeply nested blocks.
- `format_pr_comment`: Output a formatted Markdown summary table for PR comments.
- `export_sarif`: Generate SARIF 2.1.0 for GitHub Code Scanning.
- `triage_issue`: Classify GitHub issue bug reports by urgency and suggested labels.
- `generate_changelog`: Parse commit history into Conventional Changelog notes.
- `audit_repository`: Audit repo hygiene against open-source community standards.

#### Via CLI:
```bash
# Standard review:
git diff HEAD | npx diff-sentinel diff

# Strict mode (exit code 1 on secrets or high risk):
git diff origin/main...HEAD | npx diff-sentinel diff --strict

# Token-optimized patch for LLM prompt:
git diff HEAD | npx diff-sentinel pack

# Check dependencies:
git diff HEAD | npx diff-sentinel deps

# Check complexity:
git diff HEAD | npx diff-sentinel complexity
```

### 3. Review Findings
- **Secrets (`SEC-*`)**: Warn immediately with the file, line, and remediation. Do not print unmasked secret values in chat.
- **Breaking changes**: Check if new parameters have default values or are optional. If required parameters were added to exported functions, warn that callers will break.
- **Status**:
  - `[PASS]`: Safe to merge (no credentials exposed, low churn, no breaking changes).
  - `[REVIEW]`: Review required (complexity hotspot, missing tests, or dependency downgrade).
  - `[BLOCKED]`: Merge blocked (critical secret or unhandled breaking change).

---

## Configuration

In **Claude Code**:
```bash
claude mcp add diff-sentinel -- node --experimental-strip-types /path/to/diff-sentinel/src/cli.ts mcp
```

In `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "diff-sentinel": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/path/to/diff-sentinel/src/cli.ts",
        "mcp"
      ]
    }
  }
}
```
