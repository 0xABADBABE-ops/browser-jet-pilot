/**
 * LLM Provider abstraction for BrowserAgent.
 *
 * Decouples the agent from specific LLM API implementations.
 * New providers implement the LLMProvider interface without
 * modifying BrowserAgent core logic.
 */

/** Schema for a tool that the LLM can call. */
export interface LLMTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/** Configuration passed to a provider for each completion call. */
export interface LLMProviderConfig {
  apiKey: string
  model: string
  baseUrl?: string
}

/** A completion response from the LLM. */
export interface LLMResponse {
  content: string
  done: boolean
  toolCall?: { toolName: string; toolArgs: Record<string, unknown> }
}

/**
 * Interface all LLM providers must implement.
 * Each provider translates the generic messages + tools into
 * the provider-specific API format.
 */
export interface LLMProvider {
  complete(
    messages: Array<Record<string, unknown>>,
    tools: LLMTool[],
    config: LLMProviderConfig
  ): Promise<LLMResponse>
}

// ── OpenAI-compatible provider ─────────────────────────────

/** Creates an OpenAI-compatible provider (works with any /v1/chat/completions endpoint). */
export function createOpenAIProvider(): LLMProvider {
  return {
    async complete(messages, tools, config) {
      const endpoint = config.baseUrl ?? 'https://api.openai.com/v1'
      const openaiTools = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }))

      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: openaiTools,
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

      return { content: msg.content ?? '', done: true }
    },
  }
}

// ── Anthropic provider ─────────────────────────────────────

/** Creates an Anthropic provider. */
export function createAnthropicProvider(): LLMProvider {
  return {
    async complete(messages, tools, config) {
      const systemMsg = messages.find((m) => m.role === 'system')
      const chatMsgs = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      const anthropicTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema ?? {},
      }))

      const endpoint = config.baseUrl ?? 'https://api.anthropic.com'
      const res = await fetch(`${endpoint}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: config.model,
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
      const content: Array<{
        type: string
        text?: string
        id?: string
        name?: string
        input?: Record<string, unknown>
      }> = data.content ?? []

      // Check for tool use
      const toolBlock = content.find((b) => b.type === 'tool_use')
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
            toolName: toolBlock.name ?? 'unknown',
            toolArgs: toolBlock.input ?? {},
          },
        }
      }

      const text = content
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
      return { content: text, done: true }
    },
  }
}

// ── Provider factory ───────────────────────────────────────

/** Resolve a provider name to an LLMProvider instance. */
export function resolveProvider(provider: string, model: string): LLMProvider {
  if (provider === 'anthropic' || model.includes('claude')) {
    return createAnthropicProvider()
  }
  return createOpenAIProvider()
}
