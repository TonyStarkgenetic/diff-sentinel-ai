/**
 * diff-sentinel: Standalone Model Context Protocol (MCP) Server
 * Follows MCP JSON-RPC 2.0 specification over stdio.
 */

import readline from 'node:readline';
import { MCP_TOOLS } from './tools.ts';
import { analyzeDiff, formatPRComment } from '../index.ts';
import { scanDiffForSecurity } from '../core/security-scanner.ts';
import { detectBreakingChanges } from '../core/ast-analyzer.ts';
import { parseUnifiedDiff } from '../core/diff-parser.ts';
import { triageIssue } from '../core/issue-triager.ts';
import { generateChangelog } from '../core/changelog-gen.ts';
import { auditRepository } from '../core/repo-auditor.ts';
import { analyzeComplexity } from '../core/complexity-analyzer.ts';
import { analyzeDependencies } from '../core/dep-analyzer.ts';
import { generateSarifReport } from '../core/sarif-formatter.ts';
import { packDiffForLlm } from '../core/diff-compressor.ts';

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

export const MAX_JSONRPC_LINE_LENGTH = 10 * 1024 * 1024; // 10 MB

export function sanitizeRpcId(id: unknown): string | number | null {
  if (typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id))) {
    return id;
  }
  return null;
}

export class MCPServer {
  private rl?: readline.Interface;

  constructor(bindStdio: boolean = true) {
    if (bindStdio) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });
    }
  }

  public start(): void {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });
    }

    this.rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.length > MAX_JSONRPC_LINE_LENGTH) {
        this.sendError(null, -32600, 'Invalid Request: payload exceeds maximum allowed length');
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          this.sendError(null, -32600, 'Invalid Request: expected JSON-RPC object');
          return;
        }
        this.handleRequest(parsed as JsonRpcRequest);
      } catch (err) {
        this.sendError(null, -32700, `Parse error: ${(err as Error).message}`);
      }
    });

    process.stderr.write('[diff-sentinel-mcp] MCP Server running on stdio.\n');
  }

  public handleRequest(request: JsonRpcRequest): void {
    const rawId = request?.id;
    const safeId = sanitizeRpcId(rawId);

    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      this.sendError(safeId, -32600, 'Invalid Request: jsonrpc must be "2.0" and method must be a string');
      return;
    }

    const { method, params } = request;

    // Handle notifications (no id)
    if (rawId === undefined || rawId === null) {
      if (method === 'notifications/initialized') {
        process.stderr.write('[diff-sentinel-mcp] Client initialized notification received.\n');
      }
      return;
    }

    if (safeId === null) {
      this.sendError(null, -32600, 'Invalid Request: id must be a string, finite number, or null');
      return;
    }

    switch (method) {
      case 'initialize': {
        this.sendResult(safeId, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'diff-sentinel',
            version: '1.4.0'
          }
        });
        break;
      }

      case 'tools/list': {
        this.sendResult(safeId, {
          tools: MCP_TOOLS
        });
        break;
      }

      case 'tools/call': {
        this.handleToolCall(safeId, params);
        break;
      }

      default: {
        this.sendError(safeId, -32601, `Method not found: ${method}`);
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

        case 'export_sarif': {
          const diff = String(args.diff || '');
          const parsed = parseUnifiedDiff(diff);
          const findings = scanDiffForSecurity(parsed);
          const breaking = detectBreakingChanges(parsed);
          const sarif = generateSarifReport(findings, breaking);
          outputText = JSON.stringify(sarif, null, 2);
          break;
        }

        case 'pack_diff_for_llm': {
          const diff = String(args.diff || '');
          const parsed = parseUnifiedDiff(diff);
          const maxLines = typeof args.maxLinesPerFile === 'number' ? args.maxLinesPerFile : 250;
          const packed = packDiffForLlm(parsed, { maxLinesPerFile: maxLines });
          outputText = JSON.stringify(packed, null, 2);
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
