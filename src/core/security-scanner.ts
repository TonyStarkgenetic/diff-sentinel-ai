/**
 * diff-sentinel: Deep Security & Secret Scanner
 */

import type { ParsedDiff, SecurityFinding } from '../types.ts';

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  category: 'secret' | 'vulnerability' | 'dangerous_api' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  remediation: string;
}

const SECURITY_RULES: SecretRule[] = [
  // Secrets & Credentials
  {
    id: 'SEC-001',
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,48}/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Revoke key immediately and move to environment variables or GitHub Secrets.'
  },
  {
    id: 'SEC-002',
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9_\-]{32,100}/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Revoke Anthropic API key and store in ANTHROPIC_API_KEY environment variable.'
  },
  {
    id: 'SEC-003',
    name: 'AWS Access Key ID',
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Rotate AWS credentials in IAM and use AWS IAM Roles or OIDC in CI/CD.'
  },
  {
    id: 'SEC-004',
    name: 'GitHub Personal Access Token',
    pattern: /gh[pousr]_[0-9a-zA-Z]{36}/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Revoke GitHub token and use secrets.GITHUB_TOKEN in actions.'
  },
  {
    id: 'SEC-005',
    name: 'Private RSA / OpenSSH Key',
    pattern: /-----BEGIN\s+(?:RSA|OPENSSH|EC|PGP)?\s*PRIVATE KEY-----/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Never commit private cryptographic keys. Add *.pem, *.key to .gitignore.'
  },
  {
    id: 'SEC-006',
    name: 'Generic Hardcoded Secret or Password',
    pattern: /(?:password|secret|passwd|api_key|token)\s*[:=]\s*["'][A-Za-z0-9_\-!@#$%^&*]{8,}["']/i,
    category: 'secret',
    severity: 'high',
    remediation: 'Remove hardcoded credentials; supply through config file or environment variables.'
  },
  {
    id: 'SEC-007',
    name: 'JSON Web Token (JWT)',
    pattern: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/,
    category: 'secret',
    severity: 'high',
    remediation: 'Do not commit active JWT bearer tokens to git history.'
  },
  {
    id: 'SEC-008',
    name: 'Stripe API Key',
    pattern: /(?:sk_live|rk_live)_[0-9a-zA-Z]{24,99}/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Stripe live key detected! Invalidate immediately in Stripe Dashboard.'
  },

  // Dangerous APIs & Code Vulnerabilities
  {
    id: 'VULN-001',
    name: 'Unsafe Dynamic Code Execution (eval)',
    pattern: /\b(?:eval|exec)\s*\([^)]*\$|\b(?:eval|exec)\s*\([^)]*\+/,
    category: 'dangerous_api',
    severity: 'high',
    remediation: 'Avoid eval() / exec() on dynamic input; use safer structured parsers (e.g. JSON.parse).'
  },
  {
    id: 'VULN-002',
    name: 'Shell Injection via Child Process',
    pattern: /child_process\.(?:exec|execSync)\s*\([^)]*\+/i,
    category: 'dangerous_api',
    severity: 'high',
    remediation: 'Use child_process.execFile() or spawn() with argument arrays rather than string concatenation.'
  },
  {
    id: 'VULN-003',
    name: 'Potential SQL Injection',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?WHERE.*?["']\s*\+\s*[a-zA-Z0-9_]+/i,
    category: 'vulnerability',
    severity: 'high',
    remediation: 'Use parameterized queries or prepared statements instead of string concatenation.'
  },
  {
    id: 'VULN-004',
    name: 'Insecure TLS Certificate Rejection Disabled',
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"]|rejectUnauthorized:\s*false/i,
    category: 'vulnerability',
    severity: 'high',
    remediation: 'Do not disable TLS validation. Ensure proper root certificates are configured.'
  },

  // Additional Secrets & Credentials
  {
    id: 'SEC-009',
    name: 'Google Cloud Service Account Key',
    pattern: /"type"\s*:\s*"service_account"/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Do not commit GCP service account key JSON files. Use Workload Identity Federation or store in a secrets manager.'
  },
  {
    id: 'SEC-010',
    name: 'Slack Bot/Webhook Token',
    pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}|xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}|https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[a-zA-Z0-9]{24}/,
    category: 'secret',
    severity: 'high',
    remediation: 'Revoke Slack token and store in environment variables. Rotate webhook URLs if exposed.'
  },
  {
    id: 'SEC-011',
    name: 'Discord Webhook URL',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/,
    category: 'secret',
    severity: 'high',
    remediation: 'Delete the exposed Discord webhook and create a new one. Store webhook URLs in secrets.'
  },
  {
    id: 'SEC-012',
    name: 'Database Connection String with Password',
    pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@[^\s]+/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Remove credentials from connection strings. Use environment variables or a secrets manager for database passwords.'
  },
  {
    id: 'SEC-013',
    name: 'Terraform State Backend Credential',
    pattern: /(?:access_key|secret_key)\s*=\s*"[A-Za-z0-9\/+=]{20,}"/,
    category: 'secret',
    severity: 'critical',
    remediation: 'Remove hardcoded credentials from Terraform files. Use environment variables or backend credential helpers.'
  },

  // Additional Vulnerabilities
  {
    id: 'VULN-005',
    name: 'Insecure HTTP URL in Production Config',
    pattern: /(?:api_url|endpoint|base_url|server_url)\s*[:=]\s*["']http:\/\/(?!localhost|127\.0\.0\.1)/,
    category: 'vulnerability',
    severity: 'medium',
    remediation: 'Use HTTPS for all non-local URLs in production configuration to prevent man-in-the-middle attacks.'
  },
  {
    id: 'VULN-006',
    name: 'Disabled CORS or Wildcard Origin',
    pattern: /(?:Access-Control-Allow-Origin|cors.*origin)\s*[:=]\s*["']\*["']/,
    category: 'vulnerability',
    severity: 'medium',
    remediation: 'Replace wildcard CORS origin with an explicit allowlist of trusted domains.'
  },

  // Compliance
  {
    id: 'COMP-001',
    name: 'Missing License Header Check',
    pattern: /Copyright\s+(?:©|\(c\))?\s*20(?:1[0-9]|2[0-3])\b/,
    category: 'compliance',
    severity: 'low',
    remediation: 'Update copyright year to current year.'
  }
];

export function scanDiffForSecurity(parsedDiff: ParsedDiff): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const file of parsedDiff.files) {
    // Skip test files or example files for generic secrets, but still scan for raw API keys
    const isTestOrFixture = /\.(test|spec)\.[a-z]+$/i.test(file.newPath) ||
      file.newPath.includes('fixtures/') ||
      file.newPath.includes('__tests__/');

    for (const hunk of file.hunks) {
      let currentLineNumber = hunk.newStart;

      for (const line of hunk.lines) {
        if (line.startsWith('+')) {
          const content = line.substring(1);

          for (const rule of SECURITY_RULES) {
            // If test fixture, only check critical secrets (e.g. real API keys)
            if (isTestOrFixture && rule.severity !== 'critical') {
              continue;
            }

            const match = content.match(rule.pattern);
            if (match) {
              findings.push({
                ruleId: rule.id,
                category: rule.category,
                severity: rule.severity,
                file: file.newPath,
                line: currentLineNumber,
                message: `Detected ${rule.name}`,
                matchSnippet: maskSnippet(match[0]),
                remediation: rule.remediation
              });
            }
          }
          currentLineNumber++;
        } else if (!line.startsWith('-')) {
          currentLineNumber++;
        }
      }
    }
  }

  return findings;
}

function maskSnippet(match: string): string {
  if (match.length <= 8) {
    return '***';
  }
  return match.slice(0, 4) + '...' + match.slice(-4);
}
