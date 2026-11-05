/**
 * diff-sentinel: Command Line Interface (CLI)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeComplexity,
  analyzeDependencies,
  analyzeDiff,
  auditRepository,
  formatPRComment,
  generateChangelog,
  generateSarifReport,
  packDiffForLlm,
  parseUnifiedDiff,
  triageIssue
} from './index.ts';
import { startMCPServer } from './mcp/server.ts';

const VERSION = '1.3.0';

export function runCLI(args: string[] = process.argv.slice(2)): void {
  const command = args[0] || '--help';

  switch (command) {
    case 'diff':
    case 'review': {
      handleDiffCommand(args.slice(1));
      break;
    }

    case 'scan': {
      handleScanCommand(args.slice(1));
      break;
    }

    case 'pack':
    case 'compress': {
      handlePackCommand(args.slice(1));
      break;
    }

    case 'complexity': {
      handleComplexityCommand(args.slice(1));
      break;
    }

    case 'deps':
    case 'dependencies': {
      handleDepsCommand(args.slice(1));
      break;
    }

    case 'format':
    case 'comment': {
      handleFormatCommand(args.slice(1));
      break;
    }

    case 'triage': {
      handleTriageCommand(args.slice(1));
      break;
    }

    case 'changelog': {
      handleChangelogCommand(args.slice(1));
      break;
    }

    case 'audit': {
      handleAuditCommand(args.slice(1));
      break;
    }

    case 'mcp':
    case 'serve': {
      startMCPServer();
      break;
    }

    case '-v':
    case '--version': {
      console.log(`diff-sentinel v${VERSION}`);
      break;
    }

    case '-h':
    case '--help':
    default: {
      printHelp();
      break;
    }
  }
}

function handleDiffCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const result = analyzeDiff(diffText);

  if (subArgs.includes('--sarif')) {
    const sarif = generateSarifReport(result.securityFindings, result.breakingChanges);
    console.log(JSON.stringify(sarif, null, 2));
    return;
  }

  if (subArgs.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n--- diff-sentinel: Pull Request Audit ---');
  console.log(`Files Changed: ${result.parsed.totalFiles} (+${result.parsed.totalAdditions} / -${result.parsed.totalDeletions})`);
  console.log(`Risk Score:    ${result.riskAssessment.score}/100 (Grade: ${result.riskAssessment.grade})`);
  console.log(`Status:        ${result.riskAssessment.isSafeToMerge ? 'PASS (Safe to merge)' : 'BLOCKED (Review required)'}`);

  if (result.securityFindings.length > 0) {
    console.log(`\nSecurity Findings (${result.securityFindings.length}):`);
    for (const f of result.securityFindings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.file}:${f.line} - ${f.message}`);
      console.log(`    Snippet: ${f.matchSnippet}`);
      console.log(`    Remediation: ${f.remediation}`);
    }
  }

  if (result.breakingChanges.length > 0) {
    console.log(`\nBreaking Changes (${result.breakingChanges.length}):`);
    for (const b of result.breakingChanges) {
      console.log(`  [BREAKING] ${b.file} - ${b.description}`);
    }
  }

  if (result.testCoverageAlert.warning) {
    console.log(`\nCoverage Notice: ${result.testCoverageAlert.warning}`);
  }

  if (result.riskAssessment.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of result.riskAssessment.recommendations) {
      console.log(`  * ${rec}`);
    }
  }
  console.log('-----------------------------------------\n');

  if (!result.riskAssessment.isSafeToMerge && subArgs.includes('--strict')) {
    process.exit(1);
  }
}

function handleScanCommand(subArgs: string[]): void {
  handleDiffCommand(subArgs);
}

function handlePackCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const parsed = parseUnifiedDiff(diffText);
  const packed = packDiffForLlm(parsed);

  if (subArgs.includes('--json')) {
    console.log(JSON.stringify(packed, null, 2));
    return;
  }

  console.log(packed.formattedOutput);
  console.error(`\n[diff-sentinel: Token Optimization] Raw: ~${packed.rawEstimatedTokens} tokens | Packed: ~${packed.packedEstimatedTokens} tokens | Saved: ${packed.tokenSavingsPercent}%`);
}

function handleComplexityCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const parsed = parseUnifiedDiff(diffText);
  const metrics = analyzeComplexity(parsed);

  if (subArgs.includes('--json')) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log('\n--- diff-sentinel: Complexity Analysis ---');
  console.log(`Cyclomatic Complexity: ${metrics.cyclomaticComplexity}`);
  console.log(`Max Nesting Depth:     ${metrics.nestingDepth}`);
  console.log(`Cognitive Score:       ${metrics.cognitiveComplexity}`);
  console.log(`Rating:                ${metrics.summary}`);

  if (metrics.hotspots.length > 0) {
    console.log(`\nHotspots (${metrics.hotspots.length}):`);
    for (const h of metrics.hotspots) {
      console.log(`  ${h.file}:${h.line} - ${h.reason} (score: ${h.score})`);
    }
  }
  console.log('------------------------------------------\n');
}

function handleDepsCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const parsed = parseUnifiedDiff(diffText);
  const analysis = analyzeDependencies(parsed);

  if (subArgs.includes('--json')) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  console.log('\n--- diff-sentinel: Dependency Audit ---');
  console.log(`Summary: +${analysis.totalAdded} added, -${analysis.totalRemoved} removed, ${analysis.totalUpgraded} upgraded, ${analysis.totalDowngraded} downgraded`);
  console.log(`Supply-Chain Risk: ${analysis.riskScore}/100`);

  if (analysis.changes.length > 0) {
    console.log('\nPackage Changes:');
    for (const c of analysis.changes) {
      const devTag = c.isDev ? ' (dev)' : '';
      console.log(`  [${c.changeType.toUpperCase()}] ${c.name}${devTag} ${c.oldVersion || ''} -> ${c.newVersion || ''}`);
      for (const flag of c.riskFlags) {
        console.log(`    Notice: ${flag}`);
      }
    }
  }

  if (analysis.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of analysis.warnings) {
      console.log(`  * ${w}`);
    }
  }
  console.log('---------------------------------------\n');
}

function handleFormatCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const analysis = analyzeDiff(diffText);
  const comment = formatPRComment(analysis);
  console.log(comment);
}

function readDiffInput(subArgs: string[]): string {
  const filePath = subArgs.find(a => !a.startsWith('-'));
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    console.error('Error: Please provide a patch file or pipe git diff into stdin.');
    process.exit(1);
  }
}

function handleTriageCommand(subArgs: string[]): void {
  const title = subArgs[0] || 'Unknown issue';
  let body = '';
  if (subArgs[1]) {
    if (fs.existsSync(subArgs[1])) {
      body = fs.readFileSync(subArgs[1], 'utf-8');
    } else {
      body = subArgs.slice(1).join(' ');
    }
  }

  const result = triageIssue(title, body);
  console.log('\n--- diff-sentinel: Issue Triage ---');
  console.log(`Title:       ${result.title}`);
  console.log(`Category:    ${result.category.toUpperCase()}`);
  console.log(`Urgency:     ${result.urgency.toUpperCase()}`);
  console.log(`Labels:      ${result.suggestedLabels.join(', ')}`);
  console.log(`Repro Steps: ${result.hasReproductionSteps ? 'Yes' : 'No'}`);
  console.log(`Action:      ${result.recommendedAction}`);
  console.log('-----------------------------------\n');
}

function handleChangelogCommand(subArgs: string[]): void {
  const version = subArgs.find(a => !a.startsWith('-')) || '1.0.0';
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf-8');
  } catch {
    input = 'feat: initial release\nfix: handle edge case in diff parsing';
  }

  const commits = input.split('\n').filter(Boolean);
  const result = generateChangelog(commits, version);
  console.log(`Recommended Version Bump: [${result.recommendedBump.toUpperCase()}]\n`);
  console.log(result.markdown);
}

function handleAuditCommand(subArgs: string[]): void {
  const targetDir = subArgs[0] || process.cwd();
  const result = auditRepository(path.resolve(targetDir));

  console.log('\n--- diff-sentinel: Repository Hygiene Audit ---');
  console.log(`Target:       ${targetDir}`);
  console.log(`Health Score: ${result.healthScore}/100 (Grade: ${result.grade})`);
  console.log('\nChecks:');
  for (const [key, val] of Object.entries(result.checks)) {
    console.log(`  [${val ? 'PASS' : 'FAIL'}] ${key}`);
  }

  if (result.missingFiles.length > 0) {
    console.log(`\nMissing Files: ${result.missingFiles.join(', ')}`);
  }

  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of result.recommendations) {
      console.log(`  * ${rec}`);
    }
  }
  console.log('-----------------------------------------------\n');
}

function printHelp(): void {
  console.log(`
diff-sentinel v${VERSION}
Static AST git diff analyzer, secret detector, and Model Context Protocol (MCP) server.

USAGE:
  diff-sentinel <command> [options]

COMMANDS:
  diff [patch-file]       Analyze git diff for security risks, AST breaking changes & risk score
  scan [patch-file]       Deep scan for exposed API keys, private keys and vulnerabilities
  pack [patch-file]       Compress diff by omitting lockfiles/assets to optimize LLM tokens
  complexity [patch]      Calculate cyclomatic/cognitive complexity and detect hotspots
  deps [patch-file]       Audit package manifest changes for risky upgrades and typosquatting
  format, comment [patch] Output GitHub-ready Markdown PR review comment
  triage <title> [body]   Triage incoming GitHub issues and suggest labels & urgency
  changelog [version]     Generate conventional commits changelog & recommended SemVer bump
  audit [directory]       Audit open-source repository health, license and community files
  mcp, serve              Start the Model Context Protocol (MCP) JSON-RPC 2.0 stdio server

OPTIONS:
  --sarif                 Output SARIF 2.1.0 format (for GitHub Code Scanning)
  --json                  Output structured JSON
  --strict                Exit with code 1 if risk score is elevated or security findings exist
  -v, --version           Show version
  -h, --help              Show this help menu

EXAMPLES:
  git diff HEAD~1 | diff-sentinel diff
  git diff HEAD~1 | diff-sentinel diff --sarif > results.sarif
  git diff HEAD~1 | diff-sentinel pack
  git log -n 10 --oneline | diff-sentinel changelog 1.3.0
  diff-sentinel mcp
`);
}

if (process.argv[1] && process.argv[1].endsWith('cli.ts')) {
  runCLI();
}
