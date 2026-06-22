# BrowserAgent and BrowserSkill Documentation

This document describes the AI-powered autonomous browser automation features of the Browser Jet Pilot.

## ⚠️ AGENT MANDATE

**ALL AGENTS MUST READ `docs\CODING_STYLE.md` BEFORE TOUCHING ANY CODE.**

Before making any code changes, agents are required to:

1. Read and understand the coding style standards in `docs\CODING_STYLE.md`
2. Ensure all changes comply with the formatting, documentation, and type safety standards
3. Run compliance checks: `npm run typecheck`, `npm run lint`, `npm run format:check`
4. Verify all tests pass: `npm test`

Code that violates these standards will not be accepted.

## Overview

The Browser Jet Pilot provides two primary interfaces for browser automation:

- **BrowserAgent**: An autonomous AI agent that plans and executes browser tasks using natural language
- **BrowserSkill**: A standardized skill interface for integrating browser capabilities into agent frameworks

Both interfaces connect to the Browser Jet Pilot (via stdio or HTTP transport) and provide access to browser automation tools through the Chrome DevTools Protocol (CDP) using Playwright.

---

## BrowserAgent

BrowserAgent is an AI-powered autonomous browser automation agent. It connects to the Browser Jet Pilot and uses an LLM to plan and execute tool calls for natural language browser tasks.

### Features

- **Multi-Provider AI Support**: Works with OpenAI, Anthropic, and OpenAI-compatible endpoints
- **Dual Transport Modes**: Connect via HTTP (to a running MCP server) or spawn via stdio
- **Autonomous Planning**: The LLM decides which tools to call and in what order
- **Deterministic Mode**: Execute predefined tool sequences without AI
- **Built-in Safety**: Configurable maximum tool calls per task

### Supported AI Providers

| Provider  | Models                                   | API Key Environment Variable          |
| --------- | ---------------------------------------- | ------------------------------------- |
| OpenAI    | GPT-4o, GPT-4, GPT-3.5                   | `OPENAI_API_KEY`                      |
| Anthropic | Claude Sonnet, Claude Opus, Claude Haiku | `ANTHROPIC_API_KEY`                   |
| Custom    | OpenAI-compatible endpoints              | `OPENAI_API_KEY` (or pass via config) |

### CLI Usage

The BrowserAgent CLI is available via `npm run agent` or the `browser-agent` binary after building.

#### AI-Powered Mode

```bash
# Using HTTP transport (requires MCP server running)
npm run agent -- --server-url http://localhost:3100/mcp "Go to start.gg and find Tekken 7 tournaments"

# Using stdio transport (spawns MCP server automatically)
npm run agent -- --server-command node --server-args "./dist/index.js" "Search Google for TypeScript tutorials"

# With custom AI provider
npm run agent -- --ai-provider anthropic --ai-model claude-sonnet-4-20250514 "Navigate to example.com"

# With custom endpoint
npm run agent -- --ai-base-url https://api.example.com/v1 "Go to mysite.com"
```

#### Deterministic Mode (No AI)

Execute a predefined sequence of tool calls without AI inference:

```bash
npm run agent:seq browser_start browser_navigate?url=https://example.com browser_screenshot
```

Tool call format: `tool_name?key1=value1&key2=value2`

#### CLI Options

| Option                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `--server-url <url>`     | MCP server HTTP endpoint                      |
| `--server-command <cmd>` | Command to spawn (stdio mode)                 |
| `--server-args <args>`   | Arguments for stdio command (space-separated) |
| `--server-env <json>`    | Environment variables for stdio               |
| `--ai-provider <name>`   | AI provider (openai, anthropic)               |
| `--ai-model <name>`      | Model name                                    |
| `--ai-api-key <key>`     | API key (overrides env vars)                  |
| `--ai-base-url <url>`    | Custom API endpoint                           |
| `--max-steps <n>`        | Max tool calls per task (default: 30)         |
| `--sequence`             | Enable deterministic mode                     |

### Programmatic Usage

#### Basic Example

```typescript
import { BrowserAgent } from 'browser-jet-pilot/agent'

const agent = new BrowserAgent({
  serverUrl: 'http://localhost:3100/mcp',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
})

await agent.connect()
const result = await agent.run('Go to example.com and get the main heading')
console.log(result.summary)
await agent.disconnect()
```

#### With Custom Configuration

```typescript
const agent = new BrowserAgent({
  serverUrl: 'http://localhost:3100/mcp',
  aiProvider: 'anthropic',
  aiModel: 'claude-sonnet-4-20250514',
  aiApiKey: 'sk-ant-...', // or use ANTHROPIC_API_KEY env var
  maxSteps: 50,
})

const result = await agent.run(`
  Go to start.gg/tournament/12345
  Find the bracket standings
  Extract the top 8 players
`)
```

#### Deterministic Sequence Execution

```typescript
const result = await agent.executeSequence([
  { tool: 'browser_start' },
  { tool: 'browser_navigate', args: { url: 'https://example.com' } },
  { tool: 'browser_screenshot', args: { fullPage: true } },
  { tool: 'browser_get_content', args: { type: 'text', selector: 'h1' } },
])
```

#### Using Stdio Transport

```typescript
const agent = new BrowserAgent({
  serverCommand: 'node',
  serverArgs: ['./dist/index.js'],
  serverEnv: {
    CDP_URL: 'http://localhost:9222',
    LAUNCH: 'false',
  },
})
```

### Result Structure

```typescript
interface AgentResult {
  success: boolean // Whether task completed successfully
  summary: string // Natural language summary from the AI
  steps: StepLog[] // Individual tool call logs
  screenshots: string[] // Base64-encoded PNG screenshots
  totalDuration: number // Total execution time in ms
}

interface StepLog {
  step: number // Step number
  tool: string // Tool name called
  args: Record<string, unknown> // Arguments passed
  result: string // Text result from the tool
  duration: number // Step duration in ms
}
```

### Configuration Options

| Option          | Type     | Default               | Description                     |
| --------------- | -------- | --------------------- | ------------------------------- |
| `serverUrl`     | string   | -                     | MCP server HTTP endpoint        |
| `serverCommand` | string   | `'node'`              | Command for stdio transport     |
| `serverArgs`    | string[] | `['./dist/index.js']` | Args for stdio command          |
| `serverEnv`     | Record   | -                     | Environment variables for stdio |
| `aiProvider`    | string   | `'openai'`            | AI provider (openai, anthropic) |
| `aiApiKey`      | string   | from env              | API key for AI provider         |
| `aiModel`       | string   | `'gpt-4o'`            | Model name                      |
| `aiBaseUrl`     | string   | -                     | Custom API endpoint             |
| `maxSteps`      | number   | `30`                  | Maximum tool calls per task     |

---

## BrowserSkill

BrowserSkill is a standardized skill interface that wraps BrowserAgent for integration into agent frameworks. It provides a consistent API for executing browser tasks within multi-agent systems.

### Features

- **Standardized Skill Interface**: Compatible with skill-based agent frameworks
- **Automatic Screenshot Management**: Optionally save screenshots to disk
- **Structured Data Extraction**: Attempts to parse JSON from tool results
- **Helper Methods**: Quick access to common browser operations

### Programmatic Usage

#### Basic Usage

```typescript
import { BrowserSkill } from 'browser-jet-pilot/skill'

const skill = new BrowserSkill({
  serverUrl: 'http://localhost:3100/mcp',
  saveScreenshots: true,
  screenshotDir: './screenshots',
})

await skill.init()
const result = await skill.execute(
  'Go to start.gg/tournament/12345 and extract the bracket standings'
)
console.log(result.summary)
await skill.destroy()
```

#### Skill Result Structure

```typescript
interface SkillResult {
  success: boolean // Whether task completed
  summary: string // Natural language summary
  files: string[] // Paths to saved screenshots
  data?: any // Parsed structured data (if available)
  metadata: {
    steps: number // Number of tool calls executed
    screenshots: number // Number of screenshots captured
    totalDuration: number // Total execution time in ms
    toolCalls: Array<{
      // Tool call history
      tool: string
      args: Record<string, unknown>
    }>
  }
}
```

### Skill Metadata

```typescript
const info = skill.info
// {
//   name: 'browser',
//   version: '1.0.0',
//   description: 'Self-hosted browser automation via MCP...',
//   capabilities: [
//     'web-navigation',
//     'form-filling',
//     'screenshot',
//     'content-extraction',
//     'web-scraping',
//     'multi-tab',
//     'javascript-evaluation'
//   ]
// }
```

### Helper Methods

BrowserSkill provides deterministic helper methods that bypass AI planning:

#### `goto(url)` - Navigate and Get Page Info

```typescript
const pageInfo = await skill.goto('https://example.com')
// { title: 'Example Domain', url: 'https://example.com' }
```

#### `read(url, selector?)` - Extract Text Content

```typescript
// Get all page text
const text = await skill.read('https://example.com')

// Get text from specific selector
const heading = await skill.read('https://example.com', 'h1')
```

#### `capture(url, fullPage?)` - Take Screenshot

```typescript
const result = await skill.capture('https://example.com', true)
// { base64: 'iVBORw0KG...', file: './screenshots/capture-12345.png' }
```

#### `extract(url, script)` - Extract Structured Data with JavaScript

```typescript
const links = await skill.extract(
  'https://example.com',
  'Array.from(document.querySelectorAll("a")).map(a => ({text: a.innerText, href: a.href}))'
)
```

### Skill Configuration

BrowserSkill accepts all BrowserAgent options plus:

| Option            | Type    | Default           | Description                     |
| ----------------- | ------- | ----------------- | ------------------------------- |
| `saveScreenshots` | boolean | `true`            | Save screenshots as PNG files   |
| `screenshotDir`   | string  | `'./screenshots'` | Directory for saved screenshots |

---

## Agent Workflow

### How Agents Work with the MCP Server

1. **Connection**: The agent connects to the Browser Jet Pilot via HTTP or stdio transport
2. **Tool Discovery**: The agent queries the server for available tools and their schemas
3. **Task Planning**: The LLM receives the task and available tool schemas, then plans tool calls
4. **Execution Loop**:
   - LLM selects a tool and arguments
   - Agent executes the tool call via MCP client
   - Tool result (text, images, errors) is returned
   - Result is fed back to the LLM for next decision
5. **Completion**: LLM calls the synthetic `finish` tool or reaches max steps

### Tool Calling Flow

```
User Task
    |
    v
[LLM + Tool Schemas] -> Tool Selection -> [MCP Client] -> [Browser Server]
                                                          |
                                                          v
                                                    [Playwright + CDP]
                                                          |
                                                          v
Tool Result <- [MCP Client] <- [Browser Server] <- [Browser Action]
    |
    v
[LLM processes result, decides next action]
```

### Session Management

- **Single Session Mode**: By default, the MCP server maintains one browser session
- **Session Reuse**: The session persists between tool calls for efficient workflow
- **Connection Handling**: Agents automatically reconnect if the session is lost
- **Cleanup**: Sessions are closed when the agent disconnects or the server shuts down

### Available Browser Tools

The agent has access to these MCP tools (see `browser-skill.json` for full details):

**Session Management:**

- `browser_start` - Initialize browser session (always call first)
- `browser_end` - Close browser session

**Navigation:**

- `browser_navigate` - Navigate to URL
- `browser_get_info` - Get current page title and URL

**Observation:**

- `browser_screenshot` - Capture screenshot (viewport or full page)
- `browser_get_content` - Extract text, HTML, or markdown
- `browser_evaluate` - Execute custom JavaScript
- `browser_wait_for` - Wait for selector/timeout/navigation

**Interaction:**

- `browser_click` - Click an element
- `browser_fill` - Fill form input (fast, direct)
- `browser_type` - Type keystrokes (simulates keyboard)
- `browser_select` - Select dropdown option
- `browser_hover` - Hover over element
- `browser_scroll` - Scroll page or element

**Tab Management:**

- `browser_new_tab` - Open new tab
- `browser_list_tabs` - List all tabs
- `browser_switch_tab` - Switch to tab by index

**Performance:**

- `browser_disable_shaders` - Disable WebGL/shaders for heavy pages
- `browser_restore_shaders` - Restore shaders after navigation

### Environment Variables

```bash
# MCP Server Configuration
CDP_URL=http://localhost:9222          # CDP endpoint for existing Chromium
LAUNCH=false                           # Set to 'true' to launch new browser
BROWSER_WIDTH=1280                     # Browser viewport width
BROWSER_HEIGHT=720                     # Browser viewport height
PORT=3100                              # HTTP server port (null for stdio only)
HOST=localhost                         # HTTP server host
API_KEY=                               # Optional API key for HTTP server

# AI Provider Configuration
OPENAI_API_KEY=sk-...                  # OpenAI API key
ANTHROPIC_API_KEY=sk-ant-...           # Anthropic API key
```

### Best Practices

1. **Always call `browser_start` first** - Before any other browser tool
2. **Observe before acting** - Use `browser_get_content` or `browser_screenshot` to verify page state
3. **Handle dynamic content** - Use `browser_wait_for` for SPA navigation and lazy loading
4. **Prefer `browser_fill` for forms** - More reliable than `browser_type`
5. **Extract data efficiently** - Use `browser_evaluate` for structured data extraction
6. **Set reasonable step limits** - Adjust `maxSteps` based on task complexity

### Error Recovery

The agent handles errors gracefully and continues execution:

- Tool call failures are fed back to the LLM as error messages
- The LLM can adapt its strategy (try different selectors, wait longer, etc.)
- Session disconnections trigger automatic reconnection
- Results include error information in the step logs

---

## Building and Installation

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Run the MCP server (stdio mode)
npm start

# Run the MCP server (HTTP mode on port 3100)
PORT=3100 npm start

# Run the BrowserAgent CLI
npm run agent -- "Go to example.com"
```

After building, the binaries are available:

```bash
# MCP server binary
mcp-browser

# BrowserAgent binary
browser-agent
```

---

## Module Exports

```typescript
// BrowserAgent
import { BrowserAgent } from 'browser-jet-pilot/agent'
import type {
  BrowserAgentConfig,
  AgentResult,
  StepLog,
} from 'browser-jet-pilot/agent'

// BrowserSkill
import { BrowserSkill } from 'browser-jet-pilot/skill'
import type { BrowserSkillConfig, SkillContext } from 'browser-jet-pilot/skill'
```
