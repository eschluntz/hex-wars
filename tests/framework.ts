// ============================================================================
// HEX DOMINION - Test Framework
// ============================================================================

interface TestCase {
  name: string;
  fn: () => void;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
  children: TestSuite[];
  beforeEach: (() => void) | null;
  passed: number;
  failed: number;
}

interface TestResult {
  passed: number;
  failed: number;
  failures: Array<{ suite: string; test: string; error: string }>;
}

export class TestRunner {
  private suites: TestSuite[] = [];
  private suiteStack: TestSuite[] = [];

  describe(name: string, fn: () => void): void {
    const suite: TestSuite = {
      name,
      tests: [],
      children: [],
      beforeEach: null,
      passed: 0,
      failed: 0
    };

    if (this.suiteStack.length > 0) {
      this.suiteStack[this.suiteStack.length - 1]!.children.push(suite);
    } else {
      this.suites.push(suite);
    }

    this.suiteStack.push(suite);
    fn();
    this.suiteStack.pop();
  }

  beforeEach(fn: () => void): void {
    if (this.suiteStack.length > 0) {
      this.suiteStack[this.suiteStack.length - 1]!.beforeEach = fn;
    }
  }

  it(name: string, fn: () => void): void {
    if (this.suiteStack.length > 0) {
      this.suiteStack[this.suiteStack.length - 1]!.tests.push({ name, fn });
    }
  }

  run(): TestResult {
    let totalPassed = 0;
    let totalFailed = 0;
    const failures: Array<{ suite: string; test: string; error: string }> = [];

    const runSuite = (suite: TestSuite, indent: number = 0): void => {
      const prefix = '  '.repeat(indent);
      console.log(`${prefix}  ${suite.name}`);

      for (const test of suite.tests) {
        try {
          if (suite.beforeEach) {
            suite.beforeEach();
          }
          test.fn();
          console.log(`${prefix}    ✓ ${test.name}`);
          suite.passed++;
          totalPassed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.log(`${prefix}    ✗ ${test.name}`);
          console.log(`${prefix}      ${message}`);
          suite.failed++;
          totalFailed++;
          failures.push({ suite: suite.name, test: test.name, error: message });
        }
      }

      for (const child of suite.children) {
        runSuite(child, indent + 1);
      }
    };

    for (const suite of this.suites) {
      runSuite(suite);
    }

    console.log('\n' + '='.repeat(50));
    if (totalFailed === 0) {
      console.log(`  ✓ ${totalPassed} tests passed`);
    } else {
      console.log(`  ✗ ${totalFailed} failed, ${totalPassed} passed`);
    }
    console.log('='.repeat(50) + '\n');

    return { passed: totalPassed, failed: totalFailed, failures };
  }
}

export function assert(condition: boolean, message: string = 'Assertion failed'): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message: string = ''): void {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

export function assertDeepEqual<T>(actual: T, expected: T, message: string = ''): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertNull<T>(value: T | null, message: string = ''): void {
  if (value !== null) {
    throw new Error(`${message} Expected null, got ${value}`);
  }
}

export function assertNotNull<T>(value: T | null | undefined, message: string = ''): void {
  if (value === null || value === undefined) {
    throw new Error(`${message} Expected non-null value`);
  }
}

export function assertThrows(fn: () => void, message: string = ''): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(`${message} Expected function to throw`);
  }
}
