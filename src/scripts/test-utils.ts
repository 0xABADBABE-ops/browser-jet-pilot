/**
 * Shared test utilities for script testing.
 *
 * This module provides common constants and helpers used across
 * typecheck, format, lint, and coding style test suites.
 */

/**
 * Core source files that should be checked by all test suites.
 * These are the main entry points and implementation files.
 */
export const SOURCE_FILES = [
  'src/index.ts',
  'src/types.ts',
  'src/config.ts',
  'src/session.ts',
  'src/tools/index.ts',
  'src/agent/index.ts',
  'src/agent/cli.ts',
  'src/agent/BrowserAgent.ts',
  'src/skill/index.ts',
  'src/skill/BrowserSkill.ts',
] as const

/**
 * Test files that should also be checked.
 */
export const TEST_FILES = [
  'src/session.test.ts',
  'src/tools/__tests__/index.test.ts',
] as const

/**
 * Configuration files that should be checked.
 */
export const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'vitest.config.ts',
  'eslint.config.js',
  '.prettierrc.json',
] as const

/**
 * Helper to check if a file exists.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExecSyncOptions } from 'node:child_process'

export function fileExists(projectRoot: string, filePath: string): boolean {
  return existsSync(join(projectRoot, filePath))
}

/**
 * Helper to read a file.
 */
export function readFile(projectRoot: string, filePath: string): string {
  return readFileSync(join(projectRoot, filePath), 'utf8')
}

/**
 * Helper to execute a command and get exit code.
 */
import { execSync } from 'node:child_process'

export function execWithExitCode(
  command: string,
  options: ExecSyncOptions
): { exitCode: number; output?: string } {
  try {
    const output = execSync(command, { ...options, encoding: 'utf8' }) as string
    return { exitCode: 0, output }
  } catch (error: unknown) {
    const exitCode = (error as { status?: number }).status ?? -1
    return { exitCode }
  }
}

/**
 * Test fixtures for failure path testing.
 */
export const FIXTURES = {
  /**
   * TypeScript code with deliberate type errors.
   */
  typeError: `
    // This file contains deliberate type errors for testing
    const stringVariable: string = 123;  // Type error: number assigned to string
    const numberVariable: number = "not a number";  // Type error: string assigned to number

    function returnsString(): string {
      return 456;  // Type error: number returned from string function
    }

    interface User {
      name: string;
      age: number;
    }

    const user: User = { name: "Alice" };  // Type error: missing 'age' property
  `,

  /**
   * Code with deliberate formatting violations.
   */
  formatViolation: `
const x={a:1,b:2}
function foo( ){return x}
const arr=[1,2,3]
  `,

  /**
   * Code with deliberate lint violations.
   */
  lintViolation: `
    // This file contains deliberate lint violations for testing
    const unused_variable = 123;

    function unusedFunction() {
      console.log('debug output');
    }

    const obj = { a: 1, b: 2 };
    const value = obj["a"];
  `,
} as const
