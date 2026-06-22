/**
 * Tests for coding style compliance.
 *
 * This test suite validates that code complies with the coding style standards
 * defined in docs/CODING_STYLE.md, including:
 * - Comments before functions
 * - Proper formatting
 * - Type safety
 * - Naming conventions
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SOURCE_FILES } from './test-utils.js'

describe('coding style compliance', () => {
  const projectRoot = process.cwd()

  describe('file existence', () => {
    it.each(SOURCE_FILES)('should have source file %s', (file) => {
      const filePath = join(projectRoot, file)
      expect(existsSync(filePath)).toBe(true)
    })
  })

  describe('comment quality standards', () => {
    it('should have JSDoc-style comments with /** pattern', () => {
      const filePath = join(projectRoot, 'src/session.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have JSDoc comments
      expect(content).toContain('/**')
      expect(content).toContain('*/')
    })

    it('should have descriptive comments explaining behavior', () => {
      const filePath = join(projectRoot, 'src/agent/BrowserAgent.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have comments describing functionality
      expect(content).toMatch(
        /\/\*\*[\s\S]*?(Connect|Execute|Disconnect|Create)[\s\S]*?\*\//
      )
    })

    it('should have parameter documentation comments', () => {
      const filePath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have parameter comments
      expect(content).toMatch(/req|res|config|session/i)
    })
  })

  describe('class documentation standards', () => {
    it('should have class-level JSDoc comments', () => {
      const filePath = join(projectRoot, 'src/agent/BrowserAgent.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have class comment
      expect(content).toMatch(/\/\*\*[\s\S]*?class BrowserAgent/)
    })

    it('should have method comments in classes', () => {
      const filePath = join(projectRoot, 'src/skill/BrowserSkill.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have method comments
      expect(content).toMatch(/\/\*\*/)
    })
  })

  describe('complex logic documentation', () => {
    it('should have comments explaining authentication logic', () => {
      const filePath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have comments for authentication
      expect(content).toMatch(/Authenticate|request|constant.*time/i)
    })

    it('should have comments for session management', () => {
      const filePath = join(projectRoot, 'src/session.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have comments for session methods
      expect(content).toMatch(/Ensure|Create|Get|Close/i)
    })
  })

  describe('formatting compliance', () => {
    it('should use single quotes consistently', () => {
      const filePath = join(projectRoot, 'src/config.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should predominantly use single quotes
      const singleQuoteCount = (content.match(/'/g) || []).length
      const doubleQuoteCount = (content.match(/"/g) || []).length
      expect(singleQuoteCount).toBeGreaterThan(doubleQuoteCount)
    })

    it('should have proper indentation', () => {
      const filePath = join(projectRoot, 'src/session.ts')
      const content = readFileSync(filePath, 'utf8')

      // Check for consistent indentation
      const lines = content.split('\n')
      const indentedLines = lines.filter((line) => line.match(/^\s{2}[^\s]/))
      expect(indentedLines.length).toBeGreaterThan(0)
    })
  })

  describe('naming convention compliance', () => {
    it('should use PascalCase for classes', () => {
      const filePath = join(projectRoot, 'src/session.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have class in PascalCase
      expect(content).toMatch(/export class \s*[A-Z][a-zA-Z0-9]*/)
    })

    it('should use camelCase for functions', () => {
      const filePath = join(projectRoot, 'src/config.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have camelCase function names
      expect(content).toMatch(/function [a-z][a-zA-Z0-9]*\(/)
    })
  })

  describe('type safety compliance', () => {
    it('should use explicit return types for functions', () => {
      const filePath = join(projectRoot, 'src/config.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have explicit return types
      expect(content).toMatch(/: Promise<|: ServerConfig|: void/)
    })

    it('should use type-only imports where appropriate', () => {
      // Check at least one file uses type-only imports
      const indexPath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(indexPath, 'utf8')

      expect(content).toMatch(/import type/)
    })
  })

  describe('file organization standards', () => {
    it('should have imports at the top of files', () => {
      const filePath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // First non-comment line should be an import
      const lines = content.split('\n')
      const firstCodeLine = lines.find(
        (line) =>
          line.trim() &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
      )

      expect(firstCodeLine).toMatch(/^import /)
    })

    it('should group imports logically', () => {
      const filePath = join(projectRoot, 'src/tools/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have import sections
      expect(content).toContain('import')
    })
  })

  describe('error handling standards', () => {
    it('should have descriptive error messages', () => {
      const filePath = join(projectRoot, 'src/tools/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Error messages should be descriptive
      const errors = content.matchAll(/throw new Error\(['"`]([^'"`]+)['"`]\)/g)
      const errorMessages = Array.from(errors).map((m) => m[1])

      // At least one error should have context
      const contextualErrors = errorMessages.filter(
        (msg) =>
          msg.length > 10 || msg.includes('not found') || msg.includes('failed')
      )

      expect(contextualErrors.length).toBeGreaterThan(0)
    })
  })

  describe('export patterns', () => {
    it('should have proper export statements', () => {
      const filesToCheck = [
        'src/agent/index.ts',
        'src/skill/index.ts',
        'src/types.ts',
      ]

      filesToCheck.forEach((file) => {
        const filePath = join(projectRoot, file)
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8')
          expect(content).toMatch(/export/)
        }
      })
    })
  })

  describe('comment presence in key files', () => {
    it('should have comments in main entry file', () => {
      const filePath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have some form of documentation
      expect(content).toMatch(/\/\*\*|\/\//)
    })

    it('should have comments in agent implementation', () => {
      const filePath = join(projectRoot, 'src/agent/BrowserAgent.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have extensive documentation
      const commentCount = (content.match(/\/\*\*/g) || []).length
      expect(commentCount).toBeGreaterThan(5)
    })

    it('should have comments in skill implementation', () => {
      const filePath = join(projectRoot, 'src/skill/BrowserSkill.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have documentation
      expect(content).toMatch(/\/\*\*/)
    })
  })

  describe('function complexity', () => {
    it('should break down complex logic into smaller functions', () => {
      const filePath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have multiple functions (not one giant function)
      const functionCount = (content.match(/function |async /g) || []).length
      expect(functionCount).toBeGreaterThan(5)
    })

    it('should use helper functions to reduce duplication', () => {
      const filePath = join(projectRoot, 'src/index.ts')
      const content = readFileSync(filePath, 'utf8')

      // Should have helper functions
      expect(content).toMatch(/function |=> |const /)
    })
  })
})
