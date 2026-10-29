/**
 * diff-sentinel: Standalone Model Context Protocol (MCP) Server
 * Follows MCP JSON-RPC 2.0 specification over stdio.
 */

import readline from 'node:readline';
import { MCP_TOOLS } from './tools.ts';
import { analyzeDiff, formatPRComment } from '../index.ts';
import { scanDiffForSecurity } from '../core/security-scanner.ts';
import { parseUnifiedDiff } from '../core/diff-parser.ts';
import { triageIssue } from '../core/issue-triager.ts';
import { generateChangelog } from '../core/changelog-gen.ts';
import { auditRepository } from '../core/repo-auditor.ts';
import { analyzeComplexity } from '../core/complexity-analyzer.ts';
import { analyzeDependencies } from '../core/dep-analyzer.ts';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class MCPServer {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
  }

  public start(): void {
    this.rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;
        this.handleRequest(request);
      } catch (err) {
        this.sendError(null, -32700, `Parse error: ${(err as Error).message}`);
      }
    });

    process.stderr.write('[diff-sentinel-mcp] MCP Server running on stdio.\n');
  }

  private handleRequest(request: JsonRpcRequest): void {
    const { id, method, params } = request;

    // Handle notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        process.stderr.write('[diff-sentinel-mcp] Client initialized notification received.\n');
      }
      return;
    }

    switch (method) {
      case 'initialize': {
        this.sendResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'diff-sentinel',
            version: '1.0.0'
          }
        });
        break;
      }

      case 'tools/list': {
        this.sendResult(id, {
          tools: MCP_TOOLS
        });
        break;
      }

      case 'tools/call': {
        this.handleToolCall(id, params);
        break;
      }

      default: {
        this.sendError(id, -32601, `Method not found: ${method}`);
        break;
      }
    }
  }

  private handleToolCall(id: string | number, params?: Record<string, unknown>): void {
    if (!params || typeof params.name !== 'string') {
      this.sendError(id, -32602, 'Invalid params: name is required');
      return;
    }

    const toolName = params.name;
    const args = (params.arguments || {}) as Record<string, unknown>;

    try {
      let outputText = '';

      switch (toolName) {
        case 'analyze_diff': {
          const diff = String(args.diff || '');
          const result = analyzeDiff(diff);
          outputText = JSON.stringify(result, null, 2);
          break;
        }

        case 'scan_security': {
          const diff = String(args.diff || '');
          const parsed = parseUnifiedDiff(diff);
          const findings = scanDiffForSecurity(parsed);
          outputText = JSON.stringify(findings, null, 2);
          break;
        }

        case 'triage_issue': {
          const title = String(args.title || '');
          const body = String(args.body || '');
          const result = triageIssue(title, body);
          outputText = JSON.stringify(result, null, 2);
          break;
        }

        case 'generate_changelog': {
          const commits = Array.isArray(args.commits) ? args.commits.map(String) : [];
          const version = String(args.version || '1.0.0');
          const result = generateChangelog(commits, version);
          outputText = result.markdown;
          break;
        }

        case 'audit_repository': {
          const repoPath = String(args.repoPath || process.cwd());
          const result = auditRepository(repoPath);
          outputText = JSON.stringify(result, null, 2);
          break;
        }

        case 'analyze_complexity': {
          const diff = String(args.diff || '');
          const parsed = parseUnifiedDiff(diff);
          const result = analyzeComplexity(parsed);
          outputText = JSON.stringify(result, null, 2);
          break;
        }

        case 'analyze_dependencies': {
          const diff = String(args.diff || '');
          const parsed = parseUnifiedDiff(diff);
          const result = analyzeDependencies(parsed);
          outputText = JSON.stringify(result, null, 2);
          break;
        }

        case 'format_pr_comment': {
          const diff = String(args.diff || '');
          const analysis = analyzeDiff(diff);
          outputText = formatPRComment(analysis);
          break;
        }

        default: {
          this.sendError(id, -32601, `Unknown tool: ${toolName}`);
          return;
        }
      }

      this.sendResult(id, {
        content: [
          {
            type: 'text',
            text: outputText
          }
        ],
        isError: false
      });
    } catch (err) {
      this.sendResult(id, {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${toolName}': ${(err as Error).message}`
          }
        ],
        isError: true
      });
    }
  }

  private sendResult(id: string | number, result: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  private sendError(id: string | number | null, code: number, message: string): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message }
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}

export function startMCPServer(): void {
  const server = new MCPServer();
  server.start();
}
