/**
 * diff-sentinel: Core Type Definitions
 */

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: string[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  rawText: string;
}

export interface SecurityFinding {
  ruleId: string;
  category: 'secret' | 'vulnerability' | 'dangerous_api' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  message: string;
  matchSnippet: string;
  remediation: string;
}

export interface BreakingChange {
  symbolName: string;
  kind: 'function' | 'method' | 'class' | 'interface' | 'variable' | 'export';
  changeType: 'removed' | 'signature_modified' | 'visibility_reduced' | 'type_narrowed';
  file: string;
  description: string;
  severity: 'breaking' | 'warning';
}

export interface RiskFactor {
  name: string;
  score: number; // 0 - 100
  weight: number; // 0.0 - 1.0
  description: string;
}

export interface DiffRiskAssessment {
  score: number; // 0 (safest) - 100 (highest risk)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  isSafeToMerge: boolean;
  riskFactors: RiskFactor[];
  summary: string;
  recommendations: string[];
}

export interface DiffAnalysisResult {
  parsed: ParsedDiff;
  securityFindings: SecurityFinding[];
  breakingChanges: BreakingChange[];
  riskAssessment: DiffRiskAssessment;
  testCoverageAlert: {
    hasTestChanges: boolean;
    productionCodeChanged: boolean;
    warning?: string;
  };
}

export interface IssueTriageResult {
  title: string;
  category: 'bug' | 'feature' | 'security' | 'documentation' | 'performance' | 'question';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  suggestedLabels: string[];
  hasReproductionSteps: boolean;
  hasSystemDetails: boolean;
  summary: string;
  recommendedAction: string;
  estimatedComplexity: 'trivial' | 'medium' | 'complex' | 'epic';
}

export interface ConventionalCommit {
  type: string;
  scope?: string;
  description: string;
  isBreaking: boolean;
  body?: string;
  hash?: string;
}

export interface ChangelogRelease {
  version: string;
  recommendedBump: 'major' | 'minor' | 'patch';
  date: string;
  features: string[];
  fixes: string[];
  performance: string[];
  refactors: string[];
  breakingChanges: string[];
  other: string[];
  markdown: string;
}

export interface RepoAuditResult {
  healthScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  checks: {
    hasReadme: boolean;
    hasLicense: boolean;
    hasContributing: boolean;
    hasSecurityPolicy: boolean;
    hasCodeOfConduct: boolean;
    hasIssueTemplates: boolean;
    hasWorkflows: boolean;
    hasTestSuites: boolean;
    hasPackageManifest: boolean;
  };
  missingFiles: string[];
  recommendations: string[];
}

export interface ComplexityHotspot {
  file: string;
  line: number;
  reason: string;
  score: number;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  nestingDepth: number;
  cognitiveComplexity: number;
  hotspots: ComplexityHotspot[];
  summary: string;
}

export interface DependencyChange {
  name: string;
  oldVersion?: string;
  newVersion?: string;
  changeType: 'added' | 'removed' | 'upgraded' | 'downgraded';
  isDev: boolean;
  riskFlags: string[];
}

export interface DependencyAnalysis {
  changes: DependencyChange[];
  totalAdded: number;
  totalRemoved: number;
  totalUpgraded: number;
  totalDowngraded: number;
  riskScore: number;
  warnings: string[];
}

