/**
 * diff-sentinel: SARIF 2.1.0 Exporter
 * Compatible with GitHub Advanced Security & Code Scanning tabs
 */

import type { BreakingChange, SarifLog, SarifResult, SarifRule, SecurityFinding } from '../types.ts';

const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
const TOOL_NAME = 'diff-sentinel';
const TOOL_VERSION = '1.3.0';
const TOOL_URI = 'https://github.com/TonyStarkgenetic/diff-sentinel-ai';

export function generateSarifReport(
  securityFindings: SecurityFinding[],
  breakingChanges: BreakingChange[] = []
): SarifLog {
  const rulesMap = new Map<string, SarifRule>();
  const results: SarifResult[] = [];

  for (const finding of securityFindings) {
    if (!rulesMap.has(finding.ruleId)) {
      rulesMap.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.category,
        shortDescription: {
          text: finding.message
        },
        helpUri: `${TOOL_URI}#rules`,
        defaultConfiguration: {
          level: mapSeverityToSarifLevel(finding.severity)
        }
      });
    }

    results.push({
      ruleId: finding.ruleId,
      level: mapSeverityToSarifLevel(finding.severity),
      message: {
        text: `${finding.message}. Remediation: ${finding.remediation}`
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: normalizeFilePath(finding.file)
            },
            region: {
              startLine: Math.max(1, finding.line)
            }
          }
        }
      ]
    });
  }

  for (const breaking of breakingChanges) {
    const ruleId = 'BREAKING-001';
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        name: 'BreakingApiChange',
        shortDescription: {
          text: 'Public exported symbol removed or modified in breaking manner.'
        },
        helpUri: `${TOOL_URI}#breaking-changes`,
        defaultConfiguration: {
          level: 'error'
        }
      });
    }

    results.push({
      ruleId,
      level: 'error',
      message: {
        text: `Breaking Change detected in '${breaking.symbolName}': ${breaking.description}`
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: normalizeFilePath(breaking.file)
            },
            region: {
              startLine: 1
            }
          }
        }
      ]
    });
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: TOOL_URI,
            rules: Array.from(rulesMap.values())
          }
        },
        results
      }
    ]
  };
}

function mapSeverityToSarifLevel(severity: SecurityFinding['severity']): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'note';
  }
}

function normalizeFilePath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^\/+/, '');
}
