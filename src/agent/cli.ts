/**
 * CLI entry point for the Browser Agent.
 *
 * Usage:
 *   # Via HTTP transport
 *   npx tsx src/agent/cli.ts --server-url http://localhost:3100/mcp "Go to example.com and get the title"
 *
 *   # Via stdio transport
 *   npx tsx src/agent/cli.ts --server-command node --server-args "./dist/index.js" "Search Google for Tekken 7"
 *
 *   # Deterministic mode (no AI)
 *   npx tsx src/agent/cli.ts --server-url http://localhost:3100/mcp --sequence \
 *     'browser_start' \
 *     'browser_navigate?url=https://example.com' \
 *     'browser_screenshot'
 */

import {
  BrowserAgent,
  type BrowserAgentConfig,
  type AgentResult,
} from './BrowserAgent.js'

function parseArgs(raw: string[]): {
  config: BrowserAgentConfig
  task?: string
  sequence?: string[]
} {
  const args = raw.slice(2)
  const config: BrowserAgentConfig = {}
  const sequence: string[] = []
  let task: string | undefined

  let i = 0
  while (i < args.length) {
    switch (args[i]) {
      case '--server-url':
        config.serverUrl = args[++i]
        break
      case '--server-command':
        config.serverCommand = args[++i]
        break
      case '--server-args':
        config.serverArgs = args[++i].split(' ')
        break
      case '--server-env':
        config.serverEnv = JSON.parse(args[++i])
        break
      case '--ai-provider':
        config.aiProvider = args[++i]
        break
      case '--ai-model':
        config.aiModel = args[++i]
        break
      case '--ai-api-key':
        config.aiApiKey = args[++i]
        break
      case '--ai-base-url':
        config.aiBaseUrl = args[++i]
        break
      case '--max-steps':
        config.maxSteps = parseInt(args[++i], 10)
        break
      case '--sequence':
        // Everything after --sequence is tool call specs
        while (++i < args.length) sequence.push(args[i])
        i = args.length // break outer loop
        break
      default:
        if (!args[i].startsWith('--')) {
          task = args[i]
        }
        break
    }
    i++
  }

  return { config, task, sequence }
}

function printResult(result: AgentResult): void {
  console.log('\n' + '═'.repeat(60))
  console.log(`  ${result.success ? 'SUCCESS' : 'INCOMPLETE'}`)
  console.log('═'.repeat(60))
  console.log(`\n  Summary: ${result.summary}`)
  console.log(`  Steps: ${result.steps.length}`)
  console.log(`  Screenshots: ${result.screenshots.length}`)
  console.log(`  Duration: ${(result.totalDuration / 1000).toFixed(1)}s`)

  if (result.steps.length > 0) {
    console.log('\n  Steps:')
    for (const step of result.steps) {
      const duration =
        step.duration >= 1000
          ? `${(step.duration / 1000).toFixed(1)}s`
          : `${step.duration}ms`
      const argsStr = Object.entries(step.args)
        .map(
          ([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`
        )
        .join(' ')
      console.log(`    ${step.step}. [${step.tool}] ${argsStr} → (${duration})`)
      if (step.result.length < 200) {
        console.log(`       ${step.result}`)
      } else {
        console.log(`       ${step.result.slice(0, 200)}...`)
      }
    }
  }

  if (result.screenshots.length > 0) {
    console.log(
      `\n  Screenshots saved as base64 (first ${result.screenshots[0].slice(0, 30)}...)`
    )
  }

  console.log('')
}

async function main(): Promise<void> {
  const { config, task, sequence } = parseArgs(process.argv)

  if (!task && (sequence ?? []).length === 0) {
    console.error(`Browser Agent CLI — AI-powered browser automation

Usage:
  agent <task description>                    AI-powered mode
  agent --sequence <tool> [tool...]          Deterministic mode

Options:
  --server-url <url>         MCP server HTTP endpoint
  --server-command <cmd>     MCP server command (stdio mode)
  --server-args <args>       MCP server args (space-separated)
  --server-env <json>        Environment variables for stdio
  --ai-provider <name>       AI provider (openai, anthropic)
  --ai-model <name>          Model name
  --ai-api-key <key>         API key (or set env OPENAI_API_KEY / ANTHROPIC_API_KEY)
  --ai-base-url <url>        Custom API endpoint
  --max-steps <n>            Max tool calls per task (default: 30)

Examples:
  agent --server-url http://localhost:3100/mcp "Go to start.gg and find Tekken 7 tournaments"
  agent --sequence browser_start browser_navigate?url=https://example.com browser_screenshot
`)
    process.exit(1)
  }

  const agent = new BrowserAgent(config)

  try {
    let result: AgentResult
    if ((sequence ?? []).length > 0) {
      // Deterministic mode
      const calls = (sequence ?? []).map((spec) => {
        const [tool, ...rest] = spec.split('?')
        const args: Record<string, unknown> = {}
        if (rest.length > 0) {
          for (const pair of rest.join('?').split('&')) {
            const [k, v = ''] = pair.split('=')
            const raw = decodeURIComponent(v)
            let val: unknown

            if (raw === 'true') {
              val = true
            } else if (raw === 'false') {
              val = false
            } else if (/^-?\d+$/.test(raw)) {
              val = parseInt(raw, 10)
            } else if (/^-?\d+\.\d+$/.test(raw)) {
              val = parseFloat(raw)
            } else {
              try {
                val = JSON.parse(raw)
              } catch {
                val = raw
              }
            }

            args[k] = val
          }
        }
        return { tool, args }
      })
      result = await agent.executeSequence(calls)
    } else {
      // AI-powered mode
      result = await agent.run(task!)
    }
    printResult(result)
  } finally {
    await agent.disconnect()
  }
}

main().catch((err) => {
  console.error('Agent error:', err.message)
  process.exit(1)
})
