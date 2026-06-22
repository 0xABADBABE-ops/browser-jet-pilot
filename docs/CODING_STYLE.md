# Coding Style Standards

This document defines the coding style standards for the browser-jet-pilot project. All code must comply with these standards to ensure consistency, readability, and maintainability.

## Core Principles

1. **Readability First**: Code must be written for maximum human readability
2. **Consistency**: All code should follow the same style patterns
3. **Documentation**: Public functions must have descriptive comments
4. **Type Safety**: Leverage TypeScript's type system fully

## Formatting Standards

### Prettier Configuration

All code must be formatted with Prettier using the project's configuration:

```json
{
  "singleQuote": true,
  "semi": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
```

### Key Formatting Rules

- **Single quotes**: Use single quotes for strings
- **No semicolons**: Omit semicolons where possible (Prettier handles this)
- **2-space indentation**: Use spaces, not tabs
- **80 char line limit**: Keep lines under 80 characters for readability
- **Trailing commas**: Use ES5 style trailing commas in arrays and objects

## Documentation Standards

### Function Comments

All public functions and methods must have a descriptive comment block immediately before the function declaration.

```typescript
/**
 * Creates a new browser session with the specified configuration.
 *
 * @param cdpUrl - The CDP URL to connect to or 'http://localhost:9222' by default
 * @param launch - Whether to launch a new browser instance
 * @param width - Viewport width in pixels
 * @param height - Viewport height in pixels
 * @returns A promise that resolves to the created BrowserSession
 */
async createSession(
  cdpUrl: string,
  launch: boolean,
  width: number,
  height: number,
): Promise<BrowserSession> {
  // implementation
}
```

### Comment Requirements

1. **Public functions**: MUST have JSDoc-style comments
2. **Private/internal functions**: SHOULD have comments if logic is complex
3. **Class methods**: MUST have comments describing behavior
4. **Complex logic**: MUST have explanatory comments
5. **Workarounds/TODOs**: MUST have comments explaining why

### Comment Quality Standards

- **Descriptive**: Explain WHAT and WHY, not just WHAT
- **Concise**: Keep comments brief but informative
- **Accurate**: Comments must match the code
- **Up-to-date**: Update comments when code changes

## Code Structure Standards

### File Organization

```typescript
// 1. Imports (grouped and sorted)
import { external } from 'external-package'
import { internal } from './internal.js'

// 2. Type definitions/interfaces
interface MyInterface {}
type MyType = {}

// 3. Constants
const MY_CONSTANT = 'value'

// 4. Class/function declarations
class MyClass {
  // public methods first
  publicMethod() {}

  // then private methods
  privateMethod() {}
}

// 5. Exported functions
export function myFunction() {}
```

### Naming Conventions

- **Classes**: PascalCase (e.g., `SessionManager`, `BrowserAgent`)
- **Functions/Methods**: camelCase (e.g., `createSession`, `getPageInfo`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Interfaces**: PascalCase, no 'I' prefix (e.g., `BrowserSession`, not `IBrowserSession`)
- **Types**: PascalCase (e.g., `ToolResult`, `ServerConfig`)
- **Private properties**: camelCase, no underscore prefix

## Type Safety Standards

### TypeScript Configuration

The project uses strict TypeScript settings:

```json
{
  "strict": true,
  "esModuleInterop": true,
  "skipLibCheck": true,
  "forceConsistentCasingInFileNames": true
}
```

### Type Usage Guidelines

1. **No `any`**: Avoid using `any` type; use `unknown` or proper types
2. **Explicit returns**: Always specify return types for public functions
3. **Null safety**: Use strict null checks, handle undefined/null cases
4. **Type imports**: Use `type` keyword for type-only imports
   ```typescript
   import type { Browser } from 'playwright'
   ```

## ESLint Standards

### Required Rules

The project enforces these ESLint rules:

- **TypeScript strict mode**: All strict type checking enabled
- **No explicit any**: Error on `any` usage (except in test files)
- **No console warnings**: But `console.error` is allowed for logging
- **Consistent casing**: Enforce consistent file name casing

### Code Quality Rules

- **No unused variables**: Error on unused imports/variables
- **No undeclared variables**: Error on implicit globals
- **Proper imports**: Validate import paths and resolution

## Testing Standards

### Test File Organization

- Test files must be co-located with source files or in `__tests__` directories
- Test file naming: `*.test.ts` or `*.spec.ts`
- 100% coverage requirement for typecheck, lint, and format scripts

### Test Structure

```typescript
describe('Feature being tested', () => {
  beforeEach(() => {
    // Setup
  })

  describe('specific behavior', () => {
    it('should do something', () => {
      // Test implementation
    })
  })
})
```

## Error Handling Standards

### Error Patterns

1. **Typed errors**: Use proper error types or error objects
2. **Meaningful messages**: Include context in error messages
3. **Proper propagation**: Use async/await, don't swallow errors

```typescript
// Good
throw new Error(`Failed to connect to browser at ${url}: ${message}`)

// Avoid
throw new Error('Failed')
```

## Best Practices

### Function Design

1. **Single responsibility**: Each function should do one thing well
2. **Pure functions**: Prefer pure functions when possible
3. **Minimal parameters**: Keep parameter counts low (use objects for many params)
4. **Clear names**: Function names should describe what they do

### Code Complexity

1. **Keep it simple**: Avoid nested ternaries and complex one-liners
2. **Early returns**: Use early returns to reduce nesting
3. **Extract complexity**: Move complex logic to well-named functions

### Async Patterns

1. **Use async/await**: Prefer over Promise chains
2. **Handle errors**: Always try/catch async operations
3. **Propagate promises**: Return promises, don't always await

## Examples

### Well-Formatted Function

```typescript
/**
 * Navigate the browser to a URL and wait for page load.
 *
 * @param url - The URL to navigate to
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 * @returns Promise resolving when page reaches domcontentloaded state
 */
async navigateToUrl(
  url: string,
  timeout: number = 30000,
): Promise<void> {
  const session = this.getDefaultSession()
  await session.page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout,
  })
}
```

### Well-Structured Class

```typescript
/**
 * Manages browser sessions and connections.
 */
export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map()

  /**
   * Ensure a default browser session exists.
   *
   * @returns The active or newly created session
   */
  async ensureSession(): Promise<BrowserSession> {
    // Implementation
  }

  private cleanup(sessionId: string): void {
    // Private helper
  }
}
```

## Enforcement

These standards are enforced through:

1. **TypeScript compilation**: Catches type errors
2. **ESLint**: Enforces code quality rules
3. **Prettier**: Enforces formatting consistency
4. **Tests**: Verify compliance with these standards

All code must pass:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test` (with 100% coverage)

Before being committed to the repository.
