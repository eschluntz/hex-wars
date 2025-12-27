#!/usr/bin/env node
// ============================================================================
// HEX DOMINION - Test Runner CLI
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m'
} as const;

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function findTestFiles(dir: string): string[] {
  const testFiles: string[] = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (file.endsWith('.test.ts')) {
      testFiles.push(path.join(dir, file));
    }
  }

  return testFiles;
}

async function main(): Promise<void> {
  console.log('\n' + colorize('HEX DOMINION - Test Suite', 'blue'));
  console.log(colorize('='.repeat(50), 'dim'));

  const testsDir = path.join(__dirname, 'tests');
  const testFiles = findTestFiles(testsDir);

  if (testFiles.length === 0) {
    console.log(colorize('No test files found!', 'yellow'));
    process.exit(1);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  const allFailures: Array<{ suite: string; test: string; error: string }> = [];

  for (const file of testFiles) {
    const fileName = path.basename(file);
    console.log(colorize(`\n📁 ${fileName}`, 'blue'));

    try {
      const module = await import(file);
      const runner = module.default;
      const result = runner.run();
      totalPassed += result.passed;
      totalFailed += result.failed;
      allFailures.push(...result.failures);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(colorize(`  Error loading test file: ${message}`, 'red'));
      totalFailed++;
    }
  }

  console.log('\n' + colorize('='.repeat(50), 'dim'));
  console.log(colorize('SUMMARY', 'blue'));
  console.log(colorize('='.repeat(50), 'dim'));

  if (totalFailed === 0) {
    console.log(colorize(`\n✓ All ${totalPassed} tests passed!\n`, 'green'));
    process.exit(0);
  } else {
    console.log(colorize(`\n✗ ${totalFailed} failed`, 'red') +
                colorize(`, ${totalPassed} passed\n`, 'green'));

    if (allFailures.length > 0) {
      console.log(colorize('Failures:', 'red'));
      for (const f of allFailures) {
        console.log(`  ${f.suite} > ${f.test}`);
        console.log(colorize(`    ${f.error}`, 'dim'));
      }
      console.log('');
    }

    process.exit(1);
  }
}

main();
