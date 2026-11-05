import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_CONFIG, loadSentinelConfig } from '../src/core/config-loader.ts';

test('config-loader: should load default configuration when no file specified', () => {
  const config = loadSentinelConfig();
  assert.strictEqual(config.strictMode, false);
  assert.strictEqual(config.riskThreshold, 50);
  assert.strictEqual(Array.isArray(config.ignorePatterns), true);
});

test('config-loader: should return defaults for non-existent path', () => {
  const config = loadSentinelConfig('./non-existent-config.json');
  assert.strictEqual(config.riskThreshold, DEFAULT_CONFIG.riskThreshold);
});
