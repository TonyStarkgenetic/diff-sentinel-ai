---
name: diff-sentinel
description: Audit git diffs, pull requests, and patches for exposed secrets, AST breaking changes (TypeScript, JavaScript, Python, Go, Rust), supply-chain dependency risks, and cognitive complexity. Use whenever reviewing a PR, inspecting staged/unstaged git changes, compressing large diffs for LLM context windows, exporting SARIF 2.1.0 security reports, or gating merges in CI/CD.
license: Apache-2.0
compatibility: Requires Node.js >= 22.0.0 and git. Zero external npm dependencies.
metadata:
  author: TonyStarkgenetic
  version: "1.3.0"
  repository: https://github.com/TonyStarkgenetic/diff-sentinel-ai
  mcp-protocol: "2024-11-05"
---

# diff-sentinel Agent Skill

Autonomous git diff analysis, secret scanning, AST breaking-change detection, and context compression for coding agents (Claude Code, Cursor, Codex, Windsurf, OpenHands).

## When to Activate This Skill

Trigger this skill whenever the user or workflow requires:
1. **Pre-Merge PR / Diff Review**: Checking uncommitted changes (`git diff`), staged changes (`git diff --cached`), or branch comparisons (`git diff origin/main...HEAD`) before committing or opening/merging a pull request.
2. **Secret & Vulnerability Scanning**: Verifying that no API keys (OpenAI, Anthropic, AWS, GCP, GitHub, Stripe, Slack, Discord), database connection strings, JWTs, or dangerous runtime calls (`eval`, command injection, SQL string concatenation) were introduced.
3. **Public API Breaking-Change Detection**: Checking whether exported functions, classes, structs, or interfaces in TypeScript, JavaScript, Python, Go, or Rust had required parameters added or symbols removed.
4. **LLM Prompt Token Compression**: Stripping lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`), sourcemaps, and minified bundles from large diffs to save 60–80% of context window tokens.
5. **Supply-Chain Dependency Auditing**: Inspecting `package.json`, `requirements.txt`, or `Cargo.toml` diffs for version downgrades, loosened pins, or typosquatting patterns.

---

## Standard Operating Procedure (Playbook)

### Step 1: Acquire the Target Diff
If the user has not provided a `.patch` or `.diff` string directly, generate it using `git`:
```bash
# For current working tree + staged changes:
git diff HEAD

# For a feature branch compared against main:
git diff origin/main...HEAD
```

### Step 2: Execute Analysis (MCP Preferred, CLI Fallback)

#### Option A: Via Model Context Protocol (MCP Tools)
If the `diff-sentinel` MCP server is registered in your environment, invoke the appropriate tool directly:
- **`analyze_diff`**: Pass `{ "diff": "<raw_diff>" }` for a full multi-factor audit (security findings, breaking changes, test coverage alert, and 0–100 risk score).
- **`pack_diff_for_llm`**: Pass `{ "diff": "<raw_diff>", "maxLinesPerFile": 250 }` before feeding a large diff into your own reasoning context.
- **`scan_security`**: Pass `{ "diff": "<raw_diff>" }` for rapid 22-rule credential and vulnerability scanning.
- **`analyze_dependencies`**: Pass `{ "diff": "<raw_diff>" }` when `package.json`, `requirements.txt`, or `Cargo.toml` is modified.
- **`analyze_complexity`**: Pass `{ "diff": "<raw_diff>" }` to pinpoint deeply nested loops/conditionals and cyclomatic hotspots.
- **`format_pr_comment`**: Pass `{ "diff": "<raw_diff>" }` to generate a ready-to-post GitHub PR Markdown review comment.
- **`export_sarif`**: Pass `{ "diff": "<raw_diff>" }` to produce an OASIS SARIF 2.1.0 JSON report for GitHub Code Scanning.
- **`triage_issue`**: Pass `{ "title": "...", "body": "..." }` to classify GitHub issues by urgency, reproduction steps, and suggested labels.
- **`generate_changelog`**: Pass `{ "commits": ["feat: ...", "fix: ..."], "version": "1.3.0" }` to compute the SemVer bump and Keep-a-Changelog Markdown.
- **`audit_repository`**: Pass `{ "repoPath": "." }` to verify repository hygiene (LICENSE, README, SECURITY.md, CI workflows, tests).

#### Option B: Via Direct CLI Execution
If running via terminal/shell without MCP attached, execute `diff-sentinel` directly using Node.js 22+:
```bash
# Full PR audit report
git diff HEAD | npx diff-sentinel diff

# Strict CI gate (exits with code 1 if unsafe to merge or secrets detected)
git diff origin/main...HEAD | npx diff-sentinel diff --strict

# Structured JSON output for programmatic parsing
git diff HEAD | npx diff-sentinel diff --json

# Compress diff to save 60-80% tokens
git diff HEAD | npx diff-sentinel pack

# Supply-chain dependency audit
git diff HEAD | npx diff-sentinel deps

# Cyclomatic & cognitive complexity check
git diff HEAD | npx diff-sentinel complexity

# Export SARIF 2.1.0 report
git diff HEAD | npx diff-sentinel diff --sarif > results.sarif
```

---

## Step 3: Interpret Results & Act

When reporting findings back to the developer, follow these decision rules:

1. **Critical / High Security Findings (`SEC-001` through `SEC-022`)**:
   - **Action**: Immediately halt the commit or block the PR merge.
   - **Report**: Cite the exact file path, line number, rule ID, redacted snippet, and remediation steps. Never echo the full unredacted secret in chat.
2. **Breaking API Changes (`removed` or `signature_modified`)**:
   - **Action**: Warn the developer that downstream callers may break.
   - **Report**: Recommend either adding a default value / optional flag to the new parameter or bumping the package version to a `MAJOR` SemVer release.
3. **Risk Score & Grade (`0–100`, Grade `A` to `F`)**:
   - **Grade A / B (`score < 50`, no secrets or breaking changes)**: Confirm the patch is `[PASS] Safe to Merge`.
   - **Grade C / D (`score 50–79`)**: Flag as `[REVIEW] Review Required` and highlight missing test coverage or high-complexity hotspots.
   - **Grade F (`score >= 80` or critical secrets)**: Mark as `[BLOCKED] Merge Blocked` and list the required checklist items before merging.

---

## MCP Server Registration Reference

To register `diff-sentinel` in **Claude Code**:
```bash
claude mcp add diff-sentinel -- node --experimental-strip-types /path/to/diff-sentinel-ai/src/cli.ts mcp
```

To register in **Claude Desktop** or **Cursor** (`mcp.json` / `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "diff-sentinel": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/path/to/diff-sentinel-ai/src/cli.ts",
        "mcp"
      ]
    }
  }
}
```
