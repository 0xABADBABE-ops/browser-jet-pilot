# Agent Instructions

## Mandatory First Step

**Read `docs/CODING_STYLE.md` before touching any code.** Every change must comply with formatting, documentation, and type safety standards defined there.

## Project Overview

Browser Jet Pilot is a self-hosted MCP server for browser automation via Playwright + CDP. It exposes 26 deterministic tools through JSON-RPC 2.0 (stdio and HTTP transports), with an optional AI agent layer (BrowserAgent) and skill interface (BrowserSkill).

## Commands

| Command                                   | Purpose                      |
| ----------------------------------------- | ---------------------------- |
| `npm run build`                           | Compile TypeScript → `dist/` |
| `npm run dev`                             | Dev mode with `tsx`          |
| `npm test`                                | Run Vitest suite             |
| `npm run typecheck`                       | `tsc --noEmit`               |
| `npm run lint` / `npm run lint:fix`       | ESLint                       |
| `npm run format` / `npm run format:check` | Prettier                     |
| `npm run docs:validate`                   | Mintlify docs lint           |
| `npm run docs:links`                      | Check for dead links         |

**Pre-commit**: Husky + lint-staged auto-runs ESLint + Prettier on staged files.

## Architecture

```
src/index.ts          → Server entry, transport setup, tool registration
src/config.ts         → Zod-validated env config (CDP_URL, LAUNCH, PORT, API_KEY, ...)
src/session.ts        → SessionManager — CDP connect or Playwright launch, browser lifecycle
src/types.ts          → Shared interfaces (BrowserSession, ServerConfig, ToolResult)
src/webdav.ts         → WebDAV handler for session file access
src/tools/index.ts    → Tool registration hub — wires 26 tools into the MCP server
src/tools/utils.ts    → Shared helpers (getSession, DATA_DIR, DOWNLOADS_DIR)
src/tools/session.ts  → browser_start, browser_end
src/tools/navigation.ts → browser_navigate, browser_get_info
src/tools/interaction.ts → browser_click, browser_fill, browser_type, browser_select, browser_hover, browser_scroll
src/tools/observation.ts → browser_screenshot, browser_evaluate, browser_get_content, browser_wait_for
src/tools/persistence.ts → browser_save_cookies, browser_load_cookies, browser_download, browser_list_data_files, browser_read_data_file, browser_write_data_file, browser_delete_data_file
src/tools/tabs.ts     → browser_new_tab, browser_list_tabs, browser_switch_tab
src/tools/shader.ts   → browser_disable_shaders, browser_restore_shaders
src/agent/            → BrowserAgent (AI loop) + CLI
src/skill/            → BrowserSkill (framework integration) + manifest JSON
src/scripts/          → Self-test scripts for coding style, formatting, linting, typecheck
docs/                 → Mintlify documentation (docs.json is the nav config)
```

## Key Patterns

- **ESM only** — `"type": "module"` in package.json, all imports use `.js` extensions
- **No semicolons, single quotes, 80-char lines** — Prettier enforced
- **Zod v4** for all schema validation (config, tool parameters)
- **`@modelcontextprotocol/sdk`** — tools registered via `server.registerTool(name, { inputSchema: zodSchema, handler })`
- **HTTP transport** — `StreamableHTTPServerTransport` used directly via `transport.handleRequest(req, res, body)` inside `http.createServer()`
- **Error returns** — tools return `{ content: [{ type: 'text', text: errorMessage }], isError: true }`
- **No `any`** — use `unknown` or proper types. Type-only imports: `import type { X } from '...'`

## Adding a New Tool

1. Add the tool registration in `src/tools/index.ts` using `server.registerTool()`
2. Define parameters with Zod: `z.object({ param: z.string().describe('...') })`
3. Get the session via `getSession()` helper
4. Implement the Playwright call with proper error handling
5. Return `{ content: [{ type: 'text', text: result }] }`
6. Add a test in a new `src/tools/<tool>.test.ts` or extend existing test files
7. Update `docs/reference/tools.mdx` with the new tool entry
8. Update `AGENTS.md` tool count if needed
9. Run full checks: `npm run typecheck && npm run lint && npm run format:check && npm test`

## Testing

- Framework: Vitest v4
- Config: `vitest.config.ts`
- Co-locate tests with source (`*.test.ts`) or use `__tests__/` dirs
- 144+ tests — run `npm test` to verify nothing broke
- Coverage: `npm run test:coverage`

## Documentation

Docs live in `docs/` using Mintlify. Navigation is defined in `docs/docs.json`.

- **Getting Started**: installation, quickstart, Docker
- **Guides**: integrations, agent-and-skill, reliability-checks
- **Reference**: architecture, configuration, http-endpoints, tools
- **Development**: testing, linting, contributing

After editing docs: `npm run docs:validate && npm run docs:links`

## What NOT to Do

- Do not use `any` type
- Do not use double quotes or semicolons
- Do not skip JSDoc comments on public functions
- Do not add dependencies without updating `package-lock.json`
- Do not modify `dist/` directly — always run `npm run build`
- Do not commit without passing all CI checks
- Do not add browserbase or third-party cloud dependencies
