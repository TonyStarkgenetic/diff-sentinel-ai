#!/usr/bin/env node

/**
 * diff-sentinel executable binary entry point
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliTsPath = path.resolve(__dirname, '../src/cli.ts');

const child = spawn(
  process.execPath,
  ['--experimental-strip-types', cliTsPath, ...process.argv.slice(2)],
  {
    stdio: 'inherit'
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
