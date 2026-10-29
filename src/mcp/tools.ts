/**
 * diff-sentinel: Model Context Protocol (MCP) Tool Definitions
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'analyze_diff',
    description:
      'Analyze a git unified diff or PR patch for open-source maintainers. Performs AST breaking change analysis, secret leak detection, churn calculation, and comprehensive risk scoring.',
    inputSchema: {
      type: 'object',
      properties: {
        diff: {
          type: 'string',
          description: 'The raw unified git diff or patch text to analyze.'
        }
      },
      required: ['diff']
    }
  },
  {
    name: 'scan_security',
    description:
      'Scan diff additions or source code for exposed API keys (OpenAI, Anthropic, AWS, GitHub), private keys, and insecure APIs (eval, SQL injection, exec).',
    inputSchema: {
      type: 'object',
      properties: {
        diff: {
          type: 'string',
          description: 'The unified diff or patch text to scan.'
        }
      },
      required: ['diff']
    }
  },
  {
    name: 'triage_issue',
    description:
      'Triage an incoming open-source GitHub issue or bug report. Classifies category, urgency, reproduction steps, and suggests labels.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the issue.'
        },
        body: {
          type: 'string',
          description: 'The full description or markdown body of the issue.'
        }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'generate_changelog',
    description:
      'Parse conventional commit messages, determine SemVer version bump (major/minor/patch), and generate structured Keep-a-Changelog Markdown release notes.',
    inputSchema: {
      type: 'object',
      properties: {
        commits: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of commit messages to process.'
        },
        version: {
          type: 'string',
          description: 'Next release version string (defaults to 1.0.0).'
        }
      },
      required: ['commits']
    }
  },
  {
    name: 'audit_repository',
    description:
      'Audit an open-source repository for community hygiene: checks presence of README, LICENSE, CONTRIBUTING, SECURITY.md, CI workflows, and test coverage.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Absolute or relative path to the repository root directory.'
        }
      },
      required: ['repoPath']
    }
  },
  {
    name: 'analyze_complexity',
    description:
      'Calculate cognitive and cyclomatic complexity metrics and detect complexity hotspots on added diff lines.',
    inputSchema: {
      type: 'object',
      properties: {
        diff: {
          type: 'string',
          description: 'The raw unified git diff to calculate complexity metrics for.'
        }
      },
      required: ['diff']
    }
  },
  {
    name: 'analyze_dependencies',
    description:
      'Analyze package.json and manifest diffs for risky upgrades, downgrades, loosened version pins, and typosquatting risks.',
    inputSchema: {
      type: 'object',
      properties: {
        diff: {
          type: 'string',
          description: 'The raw unified git diff containing package manifest changes.'
        }
      },
      required: ['diff']
    }
  },
  {
    name: 'format_pr_comment',
    description:
      'Generate a formatted, publication-ready GitHub PR Markdown audit comment with summary tables, collapsible finding details, and checklists.',
    inputSchema: {
      type: 'object',
      properties: {
        diff: {
          type: 'string',
          description: 'The raw unified git diff to audit and format.'
        }
      },
      required: ['diff']
    }
  }
];
