/**
 * Browser Skill — Integrates MCP Browser Server into agent skill systems.
 *
 * This module wraps the BrowserAgent with a standardized skill interface.
 * It can be loaded by any skill-compatible agent framework.
 *
 * Usage:
 *   import { BrowserSkill } from './skill/BrowserSkill.js';
 *
 *   const skill = new BrowserSkill({
 *     serverUrl: 'http://localhost:3100/mcp',
 *     saveScreenshots: true,
 *     screenshotDir: './screenshots',
 *   });
 *
 *   await skill.execute('Go to start.gg/tournament/12345 and extract the bracket standings');
 */

import { BrowserAgent, type BrowserAgentConfig } from '../agent/BrowserAgent.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface BrowserSkillConfig extends BrowserAgentConfig {
  /** Save screenshots as PNG files */
  saveScreenshots?: boolean
  /** Directory to save screenshots */
  screenshotDir?: string
}

export interface SkillContext {
  /** Workspace or project directory for file output */
  workDir?: string
  /** Additional context passed from the parent agent */
  metadata?: Record<string, unknown>
}

export class BrowserSkill {
  private config: Required<
    Pick<BrowserSkillConfig, 'saveScreenshots' | 'screenshotDir'>
  > &
    BrowserSkillConfig
  private agent: BrowserAgent | null = null
  private connected = false

  constructor(config: BrowserSkillConfig = {}) {
    this.config = {
      saveScreenshots: true,
      screenshotDir: './screenshots',
      ...config,
    }
  }

  /** Skill name and metadata */
  get info() {
    return {
      name: 'browser',
      version: '1.0.0',
      description:
        'Self-hosted browser automation via MCP. Navigate websites, fill forms, take screenshots, extract content, automate browser tasks.',
      capabilities: [
        'web-navigation',
        'form-filling',
        'screenshot',
        'content-extraction',
        'web-scraping',
        'multi-tab',
        'javascript-evaluation',
      ],
    }
  }

  /** Initialize the skill (connect to MCP server) */
  async init(): Promise<void> {
    this.agent = new BrowserAgent(this.config)
    await this.agent.connect()
    this.connected = true
  }

  /** Cleanup */
  async destroy(): Promise<void> {
    if (this.agent) {
      await this.agent.disconnect()
      this.connected = false
    }
  }

  /**
   * Execute a browser task.
   * This is the main skill interface called by agent frameworks.
   */
  async execute(
    task: string,
    context?: SkillContext
  ): Promise<{
    success: boolean
    summary: string
    files: string[]
    data?: unknown
    metadata: Record<string, unknown>
  }> {
    if (!this.connected) await this.init()

    const result = await this.agent!.run(task)
    const files: string[] = []
    const screenshotDir = context?.workDir
      ? join(context.workDir, this.config.screenshotDir!)
      : this.config.screenshotDir!

    // Save screenshots
    if (this.config.saveScreenshots && result.screenshots.length > 0) {
      mkdirSync(screenshotDir, { recursive: true })
      for (let i = 0; i < result.screenshots.length; i++) {
        const filename = `step-${result.steps[i]?.step ?? i + 1}-${Date.now()}.png`
        const filepath = join(screenshotDir, filename)
        writeFileSync(filepath, Buffer.from(result.screenshots[i], 'base64'))
        files.push(filepath)
      }
    }

    // Try to parse structured data from the last step
    let data: unknown
    const lastText = result.steps[result.steps.length - 1]?.result
    if (lastText) {
      try {
        data = JSON.parse(lastText)
      } catch {
        data = undefined
      }
    }

    return {
      success: result.success,
      summary: result.summary,
      files,
      data,
      metadata: {
        steps: result.steps.length,
        screenshots: result.screenshots.length,
        totalDuration: result.totalDuration,
        toolCalls: result.steps.map((s) => ({
          tool: s.tool,
          args: s.args,
        })),
      },
    }
  }

  /**
   * Quick helper methods for common operations.
   * These bypass the AI and execute deterministic tool sequences.
   */

  /** Navigate to a URL and return page info */
  async goto(url: string): Promise<{ title: string; url: string }> {
    if (!this.connected) await this.init()
    const result = await this.agent!.executeSequence([
      { tool: 'browser_start' },
      { tool: 'browser_navigate', args: { url } },
      { tool: 'browser_get_info' },
    ])
    const info = JSON.parse(result.steps[2].result)
    return { title: info.title, url: info.url }
  }

  /** Navigate and extract text content */
  async read(url: string, selector?: string): Promise<string> {
    if (!this.connected) await this.init()
    const calls: Array<{ tool: string; args?: Record<string, unknown> }> = [
      { tool: 'browser_start' },
      { tool: 'browser_navigate', args: { url } },
    ]
    if (selector) {
      calls.push({
        tool: 'browser_get_content',
        args: { type: 'text', selector },
      })
    } else {
      calls.push({ tool: 'browser_get_content', args: { type: 'text' } })
    }
    const result = await this.agent!.executeSequence(calls)
    return result.steps[result.steps.length - 1].result
  }

  /** Navigate and take a screenshot. Returns the file path if saveScreenshots is on. */
  async capture(
    url: string,
    fullPage = false
  ): Promise<{ base64: string; file?: string }> {
    if (!this.connected) await this.init()
    const result = await this.agent!.executeSequence([
      { tool: 'browser_start' },
      { tool: 'browser_navigate', args: { url } },
      { tool: 'browser_screenshot', args: { fullPage } },
    ])
    const base64 = result.screenshots[0]

    let file: string | undefined
    if (this.config.saveScreenshots && base64) {
      mkdirSync(this.config.screenshotDir!, { recursive: true })
      file = join(this.config.screenshotDir!, `capture-${Date.now()}.png`)
      writeFileSync(file, Buffer.from(base64, 'base64'))
    }

    return { base64, file }
  }

  /** Extract structured data using JavaScript */
  async extract<T = unknown>(url: string, script: string): Promise<T> {
    if (!this.connected) await this.init()
    const result = await this.agent!.executeSequence([
      { tool: 'browser_start' },
      { tool: 'browser_navigate', args: { url } },
      { tool: 'browser_evaluate', args: { script } },
    ])
    return JSON.parse(result.steps[2].result) as T
  }
}
