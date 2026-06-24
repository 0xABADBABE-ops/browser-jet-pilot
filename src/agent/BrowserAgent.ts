/**
 * BrowserAgent — AI-powered browser automation agent.
 *
 * Connects to the MCP Browser Server (stdio or HTTP) and orchestrates
 * tool calls via an LLM to accomplish natural-language browser tasks.
 *
 * Usage:
 *   const agent = new BrowserAgent({ serverUrl: 'http://localhost:3100/mcp' });
 *   const result = await agent.run('Go to start.gg and find the latest Tekken 7 tournament');
 *   console.log(result.summary);
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolResult } from '../types.js'

// ── Types ──────────────────────────────────────────────────

export interface BrowserAgentConfig {
  /** MCP server URL for HTTP transport (e.g. 'http://localhost:3100/mcp') */
  serverUrl?: string
  /** Command to spawn for stdio transport (e.g. 'node') */
  serverCommand?: string
  /** Args for stdio transport (e.g. ['./dist/index.js']) */
  serverArgs?: string[]
  /** Environment variables passed to stdio transport */
  serverEnv?: Record<string, string>
  /** AI provider: 'openai' | 'anthropic' | 'custom' */
  aiProvider?: string
  /** API key for the AI provider */
  aiApiKey?: string
  /** Model name (e.g. 'gpt-4o', 'claude-sonnet-4-20250514') */
  aiModel?: string
  /** Base URL for custom/OpenAI-compatible endpoints */
  aiBaseUrl?: string
  /** Maximum tool calls per task (safety limit) */
  maxSteps?: number
}

interface ToolDef {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

// OpenAI/Anthropic tool schema formats
interface OpenAIToolSchema {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

interface AnthropicToolSchema {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

// Anthropic API response content block types
interface AnthropicTextContentBlock {
  type: 'text'
  text: string
}

interface AnthropicToolUseContentBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

type AnthropicContentBlock =
  | AnthropicTextContentBlock
  | AnthropicToolUseContentBlock

export interface StepLog {
  step: number
  tool: string
  args: Record<string, unknown>
  result: string
  duration: number
}

export interface AgentResult {
  success: boolean
  summary: string
  steps: StepLog[]
  screenshots: string[] // base64 PNGs collected during execution
  totalDuration: number
}

// ── Agent ──────────────────────────────────────────────────

export class BrowserAgent {
  private client: Client
  private transport: StdioClientTransport | StreamableHTTPClientTransport
  private config: Required<Pick<BrowserAgentConfig, 'maxSteps'>> &
    BrowserAgentConfig
  private connected = false
  private tools: ToolDef[] = []
  private systemPrompt = BROWSER_SYSTEM_PROMPT

  constructor(config: BrowserAgentConfig = {}) {
    this.config = { maxSteps: 30, ...config }

    this.client = new Client({
      name: 'BrowserAgent',
      version: '1.0.0',
    })

    if (config.serverUrl) {
      this.transport = new StreamableHTTPClientTransport(
        new URL(config.serverUrl)
      )
    } else {
      this.transport = new StdioClientTransport({
        command: config.serverCommand ?? 'node',
        args: config.serverArgs ?? ['./dist/index.js'],
        env: {
          ...(process.env as Record<string, string>),
          ...config.serverEnv,
        },
      })
    }
  }

  /** Connect to the MCP server and discover available tools */
  async connect(): Promise<void> {
    await this.client.connect(this.transport)
    this.connected = true

    // Discover tools
    const { tools } = await this.client.listTools()
    this.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }))
  }

  /** Disconnect from the MCP server */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close()
      this.connected = false
    }
  }

  /**
   * Execute a browser task described in natural language.
   * The LLM plans tool calls and the agent executes them sequentially.
   */
  async run(task: string): Promise<AgentResult> {
    if (!this.connected) await this.connect()

    const startTime = Date.now()
    const steps: StepLog[] = []
    const screenshots: string[] = []

    const messages: Array<Record<string, unknown>> = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: task },
    ]

    let stepCount = 0
    let finalAnswer = ''

    while (stepCount < this.config.maxSteps!) {
      stepCount++

      // Ask the LLM what to do next
      const response = await this.chatCompletion(messages)

      const assistantMsg = response.content
      messages.push({ role: 'assistant', content: assistantMsg })

      // Check if the LLM thinks it's done
      if (response.done) {
        finalAnswer = response.content
        break
      }

      // The LLM should return a tool call
      if (!response.toolCall) {
        finalAnswer = response.content
        break
      }

      // Execute the tool call
      const { toolName, toolArgs } = response.toolCall
      const stepStart = Date.now()

      let toolResult: ToolResult
      try {
        toolResult = (await this.client.callTool({
          name: toolName,
          arguments: toolArgs,
        })) as unknown as ToolResult
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        toolResult = {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        }
      }

      const stepDuration = Date.now() - stepStart

      // Extract text result
      const textParts = toolResult.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n')

      // Collect any screenshots
      const imgParts = toolResult.content
        .filter((c) => c.type === 'image' && c.data)
        .map((c) => c.data!)
      screenshots.push(...imgParts)

      steps.push({
        step: stepCount,
        tool: toolName,
        args: toolArgs,
        result: textParts || '(no text output)',
        duration: stepDuration,
      })

      // Feed result back to the LLM
      messages.push({
        role: 'user',
        content: `Tool "${toolName}" result:\n${textParts}`,
      })
    }

    return {
      success: finalAnswer.length > 0 && stepCount <= this.config.maxSteps!,
      summary: finalAnswer || `Reached max steps (${this.config.maxSteps})`,
      steps,
      screenshots,
      totalDuration: Date.now() - startTime,
    }
  }

  /**
   * Execute a predefined sequence of tool calls (no AI, deterministic).
   * Useful for scripts and automation pipelines.
   */
  async executeSequence(
    calls: Array<{ tool: string; args?: Record<string, unknown> }>
  ): Promise<AgentResult> {
    if (!this.connected) await this.connect()

    const startTime = Date.now()
    const steps: StepLog[] = []
    const screenshots: string[] = []

    for (let i = 0; i < calls.length; i++) {
      const { tool: toolName, args: toolArgs = {} } = calls[i]
      const stepStart = Date.now()

      let toolResult: ToolResult
      try {
        toolResult = (await this.client.callTool({
          name: toolName,
          arguments: toolArgs,
        })) as unknown as ToolResult
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        toolResult = {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        }
      }

      const stepDuration = Date.now() - stepStart
      const textParts = toolResult.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n')

      const imgParts = toolResult.content
        .filter((c) => c.type === 'image' && c.data)
        .map((c) => c.data!)
      screenshots.push(...imgParts)

      steps.push({
        step: i + 1,
        tool: toolName,
        args: toolArgs,
        result: textParts || '(no text output)',
        duration: stepDuration,
      })
    }

    return {
      success: true,
      summary: `Executed ${calls.length} tool calls`,
      steps,
      screenshots,
      totalDuration: Date.now() - startTime,
    }
  }

  /** Customize the system prompt for the LLM */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
  }

  // ── LLM Integration ──────────────────────────────────────

  private async chatCompletion(
    messages: Array<Record<string, unknown>>
  ): Promise<{
    content: string
    done: boolean
    toolCall?: { toolName: string; toolArgs: Record<string, unknown> }
  }> {
    const provider = this.config.aiProvider ?? 'openai'
    const apiKey = this.config.aiApiKey ?? process.env.OPENAI_API_KEY
    const model = this.config.aiModel ?? 'gpt-4o'
    const baseUrl = this.config.aiBaseUrl

    // Build tools schema for the LLM
    const toolsSchema: OpenAIToolSchema[] = this.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }))

    // Add a "finish" tool so the LLM can signal completion
    toolsSchema.push({
      type: 'function',
      function: {
        name: 'finish',
        description:
          'Call this when the browser task is complete. Provide a summary of what was accomplished.',
        parameters: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Summary of what was accomplished',
            },
          },
          required: ['summary'],
        },
      },
    })

    if (provider === 'anthropic' || model.includes('claude')) {
      return this.anthropicCompletion(
        messages,
        toolsSchema,
        apiKey!,
        model,
        baseUrl
      )
    }

    return this.openaiCompletion(messages, toolsSchema, apiKey!, model, baseUrl)
  }

  private async openaiCompletion(
    messages: Array<Record<string, unknown>>,
    tools: OpenAIToolSchema[],
    apiKey: string,
    model: string,
    baseUrl?: string
  ): Promise<{
    content: string
    done: boolean
    toolCall?: { toolName: string; toolArgs: Record<string, unknown> }
  }> {
    const endpoint = baseUrl ?? 'https://api.openai.com/v1'
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const choice = data.choices[0]
    const msg = choice.message

    // Tool call
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const tc = msg.tool_calls[0]
      if (tc.function.name === 'finish') {
        const args = JSON.parse(tc.function.arguments)
        return { content: args.summary, done: true }
      }
      return {
        content: msg.content ?? '',
        done: false,
        toolCall: {
          toolName: tc.function.name,
          toolArgs: JSON.parse(tc.function.arguments),
        },
      }
    }

    // No tool call — the model is done or confused
    return { content: msg.content ?? '', done: true }
  }

  private async anthropicCompletion(
    messages: Array<Record<string, unknown>>,
    tools: OpenAIToolSchema[],
    apiKey: string,
    model: string,
    baseUrl?: string
  ): Promise<{
    content: string
    done: boolean
    toolCall?: { toolName: string; toolArgs: Record<string, unknown> }
  }> {
    // Convert messages format for Anthropic
    const systemMsg = messages.find((m) => m.role === 'system')
    const chatMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    const anthropicTools: AnthropicToolSchema[] = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters ?? {},
    }))

    const endpoint = baseUrl ?? 'https://api.anthropic.com'
    const res = await fetch(`${endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMsg?.content ?? '',
        messages: chatMsgs,
        tools: anthropicTools,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const content: AnthropicContentBlock[] = data.content ?? []

    // Check for tool use
    const toolBlock = content.find(
      (b): b is AnthropicToolUseContentBlock => b.type === 'tool_use'
    )
    if (toolBlock) {
      if (toolBlock.name === 'finish') {
        const summary =
          typeof toolBlock.input?.summary === 'string'
            ? toolBlock.input.summary
            : ''
        return { content: summary, done: true }
      }
      return {
        content: '',
        done: false,
        toolCall: {
          toolName: toolBlock.name,
          toolArgs: toolBlock.input ?? {},
        },
      }
    }

    const text = content
      .filter((b): b is AnthropicTextContentBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    return { content: text, done: true }
  }
}

// ── System Prompt ──────────────────────────────────────────

const BROWSER_SYSTEM_PROMPT = `You are a browser automation agent. You control a real browser through MCP tools.

## Available Tools
You have access to browser_ tools: navigate, click, fill, type, screenshot, get_content, evaluate, wait_for, scroll, hover, select, and tab management tools.

## Rules
1. ALWAYS call browser_start first before any other tool.
2. After navigating, use browser_get_content or browser_screenshot to observe the page before acting.
3. Use browser_wait_for when pages load dynamically.
4. When you find the answer or complete the task, call the "finish" tool with a summary.
5. If a tool call fails, adapt your approach and try again (different selectors, wait longer, etc.).
6. For forms, prefer browser_fill over browser_type unless the page requires keystroke events.
7. Extract data using browser_get_content or browser_evaluate — do not rely on screenshots for text data.
8. Take screenshots (browser_screenshot) to verify visual state when needed.

## Strategy
- Plan ahead: think about what sequence of actions will accomplish the task.
- Observe before acting: always check what's on the page before clicking or filling.
- Be efficient: minimize unnecessary navigation and tool calls.
- Handle errors gracefully: if a selector fails, try alternatives or inspect the page structure.`
