/**
 * diff-sentinel: Configuration Loader
 * Supports .sentinelrc.json and sentinel.config.json
 */

import fs from 'node:fs';
import path from 'node:path';
import type { SentinelConfig } from '../types.ts';

const CONFIG_FILENAMES = [
  '.sentinelrc.json',
  '.sentinelrc',
  'sentinel.config.json'
];

export const DEFAULT_CONFIG: SentinelConfig = {
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.min.js',
    '**/coverage/**'
  ],
  strictMode: false,
  riskThreshold: 50,
  maxAllowedComplexity: 35,
  disableRuleIds: []
};

export function loadSentinelConfig(customPath?: string): SentinelConfig {
  if (customPath) {
    const resolved = path.resolve(customPath);
    if (fs.existsSync(resolved)) {
      try {
        const raw = fs.readFileSync(resolved, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch (err) {
        console.warn(`[diff-sentinel] Warning: Failed to parse config file at ${customPath}: ${(err as Error).message}`);
      }
    }
  }

  const cwd = process.cwd();
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, filename);
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch {
        // Fall back to next or default
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}
