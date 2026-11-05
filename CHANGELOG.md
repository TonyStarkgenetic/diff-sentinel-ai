# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-05

### Features

- **sarif-formatter**: Added native SARIF 2.1.0 report generation (`--sarif` flag and `export_sarif` MCP tool) for direct integration with GitHub Advanced Security and Code Scanning tabs.
- **diff-compressor**: Added token estimator and context packaging (`pack` command and `pack_diff_for_llm` MCP tool) to strip lockfiles and generated noise, saving 60-80% prompt tokens for Claude Code and LLMs.
- **ast-analyzer**: Expanded breaking change detection to cover Go (`func`, `struct`, `interface`) and Rust (`pub fn`, `pub struct`, `pub enum`, `pub trait`), with optional/default parameter awareness.
- **dep-analyzer**: Added manifest diff parsers for Python `requirements.txt` and Rust `Cargo.toml` alongside Node.js `package.json`.
- **config-loader**: Added support for `.sentinelrc.json` and `sentinel.config.json` configuration files with customizable ignore patterns, risk thresholds, and disabled rules.
- **mcp**: Expanded MCP server tools to 10 total tools including SARIF export and LLM diff packaging.
- **cli**: Refined CLI and PR comment formatting into clean, technical reports.

### Documentation

- Updated README.md with CLI examples, architecture diagrams, and SARIF workflow documentation.
- Updated repository URLs and badges across all project files.

## [1.2.0] - 2026-10-29

### Features

- **dep-analyzer**: New dependency change analyzer — detects risky upgrades, downgrades, version constraint loosening, and typosquatting patterns in manifest diffs.
- **complexity-analyzer**: New cognitive complexity estimator — calculates cyclomatic complexity, nesting depth, and identifies high-complexity hotspots from diff additions.
- **pr-formatter**: New GitHub PR comment formatter — generates Markdown review comments with tables, collapsible details, and actionable checklists.
- **security-scanner**: Added 8 new detection rules: Google Cloud Service Account keys, Slack/Discord webhooks, database connection strings with passwords, Terraform state credentials, insecure HTTP endpoints, wildcard CORS origins, and outdated copyright headers.
- **mcp**: Exposed `analyze_complexity` and `analyze_dependencies` as new MCP tools.

### Bug Fixes

- **security-scanner**: Fixed false-positive on Anthropic key detection when multiple rules match the same line.
- **diff-parser**: Improved handling of renamed files with similarity index headers.

### Documentation

- Added MCP integration guide for Claude Desktop, Claude Code, and Cursor.
- Added GitHub Action usage examples with strict mode and PR commenting.
- Added architecture diagram (Mermaid) to README.

## [1.1.0] - 2026-10-25

### Features

- **issue-triager**: Added complexity estimation (`trivial`, `medium`, `complex`, `epic`).
- **changelog-gen**: Added performance and refactor sections to changelog output.
- **repo-auditor**: Added check for SECURITY.md and CODE_OF_CONDUCT.md.

### Bug Fixes

- **risk-engine**: Fixed weight normalization producing NaN when all weights are zero.
- **ast-analyzer**: Fixed parameter counting for Python `self`/`cls` arguments.

## [1.0.0] - 2026-10-20

### Features

- Initial release of diff-sentinel.
- **diff-parser**: Fast unified git diff parser with hunk-level granularity.
- **ast-analyzer**: AST-level breaking change detection for TypeScript, JavaScript, and Python.
- **security-scanner**: Secret leak detection for OpenAI, Anthropic, AWS, GitHub, Stripe, and JWT tokens.
- **risk-engine**: Multi-factor PR risk scoring engine (0–100 scale with A–F grades).
- **issue-triager**: Automated GitHub issue classification and label suggestion.
- **changelog-gen**: Conventional Commits parser with SemVer bump recommendation.
- **repo-auditor**: Open-source repository health checker (README, LICENSE, CI, tests).
- **mcp**: Model Context Protocol (MCP) JSON-RPC 2.0 stdio server.
- **cli**: Command-line interface.
- **action.yml**: GitHub Action composite action for CI/CD integration.
