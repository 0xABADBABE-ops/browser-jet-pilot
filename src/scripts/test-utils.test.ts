import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fileExists, readFile, execWithExitCode } from './test-utils.js'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const { existsSync, readFileSync } = await import('node:fs')
const { execSync } = await import('node:child_process')

describe('fileExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when file exists', () => {
    ;(existsSync as any).mockReturnValue(true)

    expect(fileExists('/root', 'package.json')).toBe(true)
    expect(existsSync).toHaveBeenCalled()
  })

  it('should return false when file does not exist', () => {
    ;(existsSync as any).mockReturnValue(false)

    expect(fileExists('/root', 'missing.txt')).toBe(false)
  })
})

describe('readFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should read file content as utf8', () => {
    ;(readFileSync as any).mockReturnValue('file content here')

    const result = readFile('/root', 'test.txt')
    expect(result).toBe('file content here')
  })
})

describe('execWithExitCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return exit code 0 and output on success', () => {
    ;(execSync as any).mockReturnValue('command output')

    const result = execWithExitCode('echo hello', {})
    expect(result.exitCode).toBe(0)
    expect(result.output).toBe('command output')
  })

  it('should return non-zero exit code on failure', () => {
    const error = new Error('command failed') as any
    error.status = 1
    ;(execSync as any).mockImplementation(() => {
      throw error
    })

    const result = execWithExitCode('bad-command', {})
    expect(result.exitCode).toBe(1)
    expect(result.output).toBeUndefined()
  })

  it('should return -1 exit code when error has no status', () => {
    const error = new Error('unknown error') as any
    ;(execSync as any).mockImplementation(() => {
      throw error
    })

    const result = execWithExitCode('mystery-command', {})
    expect(result.exitCode).toBe(-1)
  })
})
