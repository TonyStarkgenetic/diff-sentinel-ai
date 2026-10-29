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
  parseUnifiedDiff,
  triageIssue
} from './index.ts';
import { startMCPServer } from './mcp/server.ts';

const VERSION = '1.2.0';

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
  let diffText = '';

  const filePath = subArgs.find(a => !a.startsWith('-'));
  if (filePath && fs.existsSync(filePath)) {
    diffText = fs.readFileSync(filePath, 'utf-8');
  } else {
    try {
      diffText = fs.readFileSync(0, 'utf-8');
    } catch {
      console.error('Error: Please provide a patch file or pipe git diff into stdin.');
      console.error('Example: git diff HEAD~1 | diff-sentinel diff');
      process.exit(1);
    }
  }

  const result = analyzeDiff(diffText);
  const isJson = subArgs.includes('--json');

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Format formatted console output
  console.log('\n🛡️  === DIFF-SENTINEL PULL REQUEST AUDIT ===');
  console.log(`📊 Churn: ${result.parsed.totalFiles} files changed (+${result.parsed.totalAdditions} / -${result.parsed.totalDeletions})`);
  console.log(`🎯 Risk Score: ${result.riskAssessment.score}/100 (Grade: ${result.riskAssessment.grade})`);
  console.log(`🚦 Status: ${result.riskAssessment.isSafeToMerge ? '✅ SAFE TO MERGE' : '⚠️ REVIEW REQUIRED'}`);

  if (result.securityFindings.length > 0) {
    console.log(`\n🚨 SECURITY FINDINGS (${result.securityFindings.length}):`);
    for (const f of result.securityFindings) {
      console.log(`   [${f.severity.toUpperCase()}] ${f.file}:${f.line} - ${f.message}`);
      console.log(`      Snippet: ${f.matchSnippet}`);
      console.log(`      Fix: ${f.remediation}`);
    }
  }

  if (result.breakingChanges.length > 0) {
    console.log(`\n⚠️  BREAKING CHANGES (${result.breakingChanges.length}):`);
    for (const b of result.breakingChanges) {
      console.log(`   [BREAKING] ${b.file} - ${b.description}`);
    }
  }

  if (result.testCoverageAlert.warning) {
    console.log(`\n⚠️  ${result.testCoverageAlert.warning}`);
  }

  if (result.riskAssessment.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    for (const rec of result.riskAssessment.recommendations) {
      console.log(`   - ${rec}`);
    }
  }
  console.log('\n==========================================\n');

  if (!result.riskAssessment.isSafeToMerge && subArgs.includes('--strict')) {
    process.exit(1);
  }
}

function handleScanCommand(subArgs: string[]): void {
  handleDiffCommand(subArgs);
}

function handleComplexityCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const parsed = parseUnifiedDiff(diffText);
  const metrics = analyzeComplexity(parsed);

  if (subArgs.includes('--json')) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log('\n🧠 === COGNITIVE COMPLEXITY AUDIT ===');
  console.log(`Cyclomatic Complexity: ${metrics.cyclomaticComplexity}`);
  console.log(`Maximum Nesting Depth: ${metrics.nestingDepth}`);
  console.log(`Cognitive Complexity:  ${metrics.cognitiveComplexity}`);
  console.log(`Rating:                ${metrics.summary}`);

  if (metrics.hotspots.length > 0) {
    console.log(`\n🔥 Complexity Hotspots (${metrics.hotspots.length}):`);
    for (const h of metrics.hotspots) {
      console.log(`   ${h.file}:${h.line} - ${h.reason} (score: ${h.score})`);
    }
  }
  console.log('=====================================\n');
}

function handleDepsCommand(subArgs: string[]): void {
  const diffText = readDiffInput(subArgs);
  const parsed = parseUnifiedDiff(diffText);
  const analysis = analyzeDependencies(parsed);

  if (subArgs.includes('--json')) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  console.log('\n📦 === DEPENDENCY & SUPPLY CHAIN AUDIT ===');
  console.log(`Changes: +${analysis.totalAdded} added, -${analysis.totalRemoved} removed, ${analysis.totalUpgraded} upgraded, ${analysis.totalDowngraded} downgraded`);
  console.log(`Supply-Chain Risk Score: ${analysis.riskScore}/100`);

  if (analysis.changes.length > 0) {
    console.log('\nDetected Dependency Changes:');
    for (const c of analysis.changes) {
      const devTag = c.isDev ? ' (dev)' : '';
      console.log(`   [${c.changeType.toUpperCase()}] ${c.name}${devTag} ${c.oldVersion || ''} -> ${c.newVersion || ''}`);
      if (c.riskFlags.length > 0) {
        c.riskFlags.forEach(f => console.log(`      ⚠️ ${f}`));
      }
    }
  }

  if (analysis.warnings.length > 0) {
    console.log('\nWarnings:');
    analysis.warnings.forEach(w => console.log(`   - ${w}`));
  }
  console.log('==========================================\n');
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
  console.log('\n📋 === ISSUE TRIAGE RESULT ===');
  console.log(`Title: ${result.title}`);
  console.log(`Category: [${result.category.toUpperCase()}]`);
  console.log(`Urgency: [${result.urgency.toUpperCase()}]`);
  console.log(`Suggested Labels: ${result.suggestedLabels.join(', ')}`);
  console.log(`Has Repro Steps: ${result.hasReproductionSteps ? 'Yes' : 'No'}`);
  console.log(`Action: ${result.recommendedAction}`);
  console.log('==============================\n');
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
  console.log(`\nRecommended Version Bump: [${result.recommendedBump.toUpperCase()}]\n`);
  console.log(result.markdown);
}

function handleAuditCommand(subArgs: string[]): void {
  const targetDir = subArgs[0] || process.cwd();
  const result = auditRepository(path.resolve(targetDir));

  console.log('\n🏛️  === REPOSITORY HEALTH AUDIT ===');
  console.log(`Target: ${targetDir}`);
  console.log(`Health Score: ${result.healthScore}/100 (Grade: ${result.grade})`);
  console.log('\nChecks:');
  for (const [key, val] of Object.entries(result.checks)) {
    console.log(`  ${val ? '✅' : '❌'} ${key}`);
  }

  if (result.missingFiles.length > 0) {
    console.log(`\nMissing Files: ${result.missingFiles.join(', ')}`);
  }

  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of result.recommendations) {
      console.log(`  - ${rec}`);
    }
  }
  console.log('\n===================================\n');
}

function printHelp(): void {
  console.log(`
🛡️  diff-sentinel v${VERSION}
Autonomous Open-Source Maintainer Sentinel & Model Context Protocol (MCP) Server

USAGE:
  diff-sentinel <command> [options]

COMMANDS:
  diff [patch-file]       Analyze git diff for security risks, AST breaking changes & risk score
  scan [patch-file]       Deep scan for exposed API keys, private keys and vulnerabilities
  complexity [patch]      Calculate cyclomatic/cognitive complexity & detect hotspots
  deps [patch-file]       Audit package manifest changes for risky upgrades & typosquatting
  format, comment [patch] Output GitHub-ready Markdown PR review comment with tables
  triage <title> [body]   Triage incoming GitHub issues and suggest labels & urgency
  changelog [version]     Generate conventional commits changelog & recommended SemVer bump
  audit [directory]       Audit open-source repository health, license and community files
  mcp, serve              Start the Model Context Protocol (MCP) JSON-RPC 2.0 stdio server

OPTIONS:
  --json                  Output raw JSON
  --strict                Exit with code 1 if risk score is elevated or security findings exist
  -v, --version           Show version
  -h, --help              Show this help menu

EXAMPLES:
  git diff HEAD~1 | diff-sentinel diff
  git diff HEAD~1 | diff-sentinel diff --strict
  git log -n 10 --oneline | diff-sentinel changelog 1.1.0
  diff-sentinel audit .
  diff-sentinel mcp
`);
}

// Run CLI if invoked directly
if (process.argv[1] && process.argv[1].endsWith('cli.ts')) {
  runCLI();
}
