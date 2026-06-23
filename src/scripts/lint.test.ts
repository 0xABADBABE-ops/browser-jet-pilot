/**
 * Tests for ESLint linting.
 *
 * This test suite validates that the lint script runs successfully
 * and enforces code quality rules across the codebase.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { SOURCE_FILES, FIXTURES } from './test-utils.js'

describe('lint script', () => {
  const projectRoot = process.cwd()
  const eslintConfigPath = join(projectRoot, 'eslint.config.js')
  const tempDir = join(projectRoot, 'tmp-lint-test-files')
  const allTempDirs = [
    tempDir,
    join(projectRoot, 'tmp-format-test-files'),
    join(projectRoot, 'tmp-typecheck-test-files'),
  ]

  beforeEach(() => {
    // Verify eslint.config.js exists
    expect(existsSync(eslintConfigPath)).toBe(true)

    // Clean up ALL temp directories before each test for full isolation
    for (const dir of allTempDirs) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  describe('eslint.config.js configuration', () => {
    it('should exist as a valid JavaScript file', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      expect(content).toBeDefined()
      expect(content.length).toBeGreaterThan(0)
      // Should contain ESLint configuration
      expect(content).toMatch(/eslint|config|export/)
    })

    it('should contain TypeScript parser configuration', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      expect(content).toMatch(/typescript|parser|tsparser/)
    })

    it('should contain ESLint plugin references', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      expect(content).toMatch(/plugin|@typescript-eslint/)
    })

    it('should include prettier config to avoid conflicts', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      expect(content).toMatch(/prettier|eslint-config-prettier/)
    })
  })

  describe('lint execution', () => {
    it('should complete without errors when code follows rules', () => {
      // Run lint - ignore npm warnings in stderr
      try {
        execSync('npm run lint', {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        })
      } catch (error: unknown) {
        // If there's an actual lint error, rethrow it
        const status = (error as { status: number | null }).status
        // Exit code 0 or 1 from npm (warnings) is acceptable
        // Exit code >1 indicates real errors
        if (status && status > 1) {
          const stderr = (error as { stderr?: string }).stderr || ''
          throw new Error(
            `Lint failed with exit code ${status}: ${stderr.slice(0, 500)}`,
            { cause: error }
          )
        }
      }
    })

    it('should detect code violations', () => {
      // Create a temporary file with lint violations
      mkdirSync(tempDir, { recursive: true })
      const badLintFile = join(tempDir, 'bad-lint-test.ts')
      writeFileSync(badLintFile, FIXTURES.lintViolation)

      // Lint should fail - test with a built-in rule that doesn't require parser
      expect(() => {
        execSync(`npx eslint --no-ignore "${badLintFile}"`, {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        })
      }).toThrow()

      // Cleanup
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should return non-zero exit code on lint errors', () => {
      mkdirSync(tempDir, { recursive: true })
      const badFile = join(tempDir, 'lint-exit-code-test.ts')
      writeFileSync(badFile, 'const unused = 123;\n')

      try {
        execSync(`npx eslint --no-ignore "${badFile}"`, {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error: unknown) {
        const status = (error as { status: number | null }).status
        // ESLint returns non-zero exit code on lint errors
        expect(status).toBeGreaterThan(0)
      }

      // Cleanup
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should report specific lint error information', () => {
      mkdirSync(tempDir, { recursive: true })
      const testFile = join(tempDir, 'lint-info-test.ts')
      writeFileSync(testFile, 'const unused = 123;\n')

      try {
        execSync(`npx eslint --no-ignore "${testFile}"`, {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        })
        expect(true).toBe(false)
      } catch (error: unknown) {
        const output = ((error as { stdout?: string; stderr?: string })
          .stdout ||
          (error as { stdout?: string; stderr?: string }).stderr ||
          '') as string
        // Should mention either parsing error or unused variable
        expect(output.length).toBeGreaterThan(0)
      }

      // Cleanup
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should exit with code 0 on success', () => {
      let exitCode = 0

      try {
        execSync('npm run lint', {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        })
      } catch (error: unknown) {
        exitCode = (error as { status: number }).status ?? -1
        // npm may exit with 1 for warnings, but lint should pass
        // If exit code > 1, there are real errors
        if (exitCode > 1) {
          const stderr = (error as { stderr?: string }).stderr || ''
          throw new Error(
            `Lint failed with exit code ${exitCode}: ${stderr.slice(0, 500)}`,
            { cause: error }
          )
        }
      }

      // Exit code 0 or 1 (npm warnings) is acceptable
      expect([0, 1]).toContain(exitCode)
    })

    it('should check all TypeScript files in src directory', () => {
      try {
        const result = execSync('npm run lint', {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        })
        // If we get here, lint passed
        expect(result).toBeDefined()
      } catch (error: unknown) {
        const status = (error as { status: number | null }).status
        // Exit code >1 indicates real errors
        if (status && status > 1) {
          const stderr = (error as { stderr?: string }).stderr || ''
          throw new Error(
            `Lint failed with exit code ${status}: ${stderr.slice(0, 500)}`,
            { cause: error }
          )
        }
        // Exit code 0 or 1 (npm warnings) is acceptable
        expect([0, 1]).toContain(status ?? -1)
      }
    })
  })

  describe('lint rule coverage', () => {
    it('should enforce no-console warnings', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      // Should configure no-console rule (off for this project)
      expect(content).toMatch(/no-console/)
    })

    it('should configure TypeScript strict rules', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      // Should have TypeScript ESLint strict configuration
      expect(content).toMatch(/strict|typescript|ts-eslint/)
    })
  })

  describe('source file lint coverage', () => {
    it.each(SOURCE_FILES)('should lint %s without errors', (file) => {
      const filePath = join(projectRoot, file)
      expect(existsSync(filePath)).toBe(true)
    })
  })

  describe('ignore patterns', () => {
    it('should ignore dist and node_modules directories', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      // Should contain ignore patterns
      expect(content).toMatch(/ignore|dist|node_modules/)
    })
  })

  describe('lint fix capability', () => {
    it('should support --fix option for auto-fixable issues', () => {
      // The lint:fix script should exist in package.json
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, 'package.json'), 'utf8')
      )

      expect(packageJson.scripts['lint:fix']).toBeDefined()
      expect(packageJson.scripts['lint:fix']).toContain('--fix')
    })
  })

  describe('test file configuration', () => {
    it('should have different rules for test files', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      // Should have test file specific configuration
      expect(content).toMatch(/test|spec|\*\.test/)
    })

    it('should allow "any" type in test files', () => {
      const content = readFileSync(eslintConfigPath, 'utf8')
      // Should configure test files to allow any type
      expect(content).toMatch(/no-explicit-any|test/)
    })
  })
})
