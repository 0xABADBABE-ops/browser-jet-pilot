# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-23

### Added

- **API Key Authentication** — optional `API_KEY` environment variable gates the HTTP transport; clients authenticate via `X-API-Key` header
- **Constant-time string comparison** — `crypto.timingSafeEqual` prevents timing attacks on the auth check
- **`browser_disable_shaders`** — blocks WebGL context creation, freezes CSS animations, and throttles `requestAnimationFrame` to ~1 FPS for heavy shader pages
- **`browser_restore_shaders`** — removes injected style overrides (note: WebGL and RAF require a page reload to fully restore)
- **Full test suite** — 127 Vitest tests covering session management, tool execution, shader control, and multi-tab workflows
- **CI/CD pipeline** — GitHub Actions workflow running `typecheck → lint → format:check → test` across Node.js 20, 22, and 24
- **Pre-commit hooks** — Husky + lint-staged enforce ESLint and Prettier on every commit
- **Test coverage reports** — `npm run test:coverage` via `@vitest/coverage-v8`
- **Vitest UI** — `npm run test:ui` for interactive test exploration
- **Mintlify documentation site** — deployed at [browser-jet-docs.awhisper.org](https://browser-jet-docs.awhisper.org)
- **SECURITY.md** — vulnerability reporting policy and security guidelines
- **SECURITY_REVIEW_REPORT.md** — comprehensive self-audit covering injection, auth, transport, and dependency security
- **AGENTS.md** — AI-coding-agent instructions for autonomous contribution to the project
- **Reliability check script** — `npm run reliability:check` runs a full health + lifecycle + extraction + multi-tab pass (5x repeat)
- **Docker Compose** — one-command deployment with built-in healthcheck against `/healthz`
- **Plain Docker** — `Dockerfile` with multi-stage build and Playwright Chromium support

### Changed

- Upgraded MCP SDK to `@modelcontextprotocol/sdk@^1.29.0`
- Upgraded Playwright to `^1.61.0`
- Upgraded Zod to `^4.4.3` (v4)
- Upgraded TypeScript to `^6.0.3`
- Dropped Node.js 18 support — Vitest v4 requires `styleText` from `node:util` (landed in 20.12.0)
- Expanded tool count from 17 to 19 (added shader control pair)
- Renamed project from `mcp-browser-server` to `browser-jet-pilot`
- Renamed binary from `mcp-browser` to `browser-jet-pilot`
- Added `bjp-agent` as secondary binary for the BrowserAgent CLI

### Fixed

- SVG and MathML elements no longer cause `browser_get_content` to return malformed output
- Browser cleanup now properly terminates all Chromium processes on `browser_end`, including orphaned launch-mode instances
- Type safety improvements across `SessionManager`, tool handlers, and agent interfaces

## [1.0.0] - 2026-06-15

### Added

- **MCP server core** — JSON-RPC 2.0 compliant server with stdio and StreamableHTTP transports
- **19 deterministic browser tools** — session management, navigation, interaction, observation, and tab control
- **CDP connection** — connect to existing Chromium via `--remote-debugging-port` using Playwright `connectOverCDP`
- **Launch mode** — optionally let Playwright spawn and manage a fresh Chromium instance
- **BrowserAgent** — AI-powered autonomous browser agent with OpenAI and Anthropic provider support
- **BrowserSkill** — standardized skill interface with `goto`, `read`, `capture`, `extract` helper methods
- **Deterministic sequence mode** — execute predefined tool chains without any LLM involvement
- **Multi-tab support** — open, list, and switch between browser tabs in a single session
- **Screenshot capture** — viewport or full-page screenshots as base64 PNG
- **Content extraction** — text, HTML, or raw page content via CSS selectors
- **JavaScript evaluation** — run arbitrary scripts in the browser context via `browser_evaluate`
- **Zod-validated configuration** — environment variable parsing with `config.ts`
- **Dual binary exports** — `mcp-browser` (server) and `browser-agent` (agent CLI)
- **Module exports map** — `browser-jet-pilot`, `browser-jet-pilot/agent`, `browser-jet-pilot/skill`

---

[1.0.1]: https://github.com/0xABADBABE-ops/browser-jet-pilot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/0xABADBABE-ops/browser-jet-pilot/releases/tag/v1.0.0
