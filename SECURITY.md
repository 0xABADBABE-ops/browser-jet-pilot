# Security Policy

## Important Notice

This repository contains a highly powerful toolset for browser automation. These tools can execute arbitrary JavaScript in browser contexts, navigate to any URL, and interact with web pages programmatically.

**Use these tools responsibly and for educational purposes.** The project is shared in good faith with the expectation that users will exercise proper judgment and not cause harm to others. There are no guardrails, restrictions, or feature flags that limit the original capabilities of browser automation.

**You are responsible for how you use these tools.** Any damage resulting from data leaks, automated actions, replay mechanisms, or other misuse is solely your responsibility.

## Authentication

### API Key Authentication (HTTP Transport)

When running the MCP server in HTTP mode, you can optionally enable API key authentication for additional security.

#### Enabling Authentication

Set the `API_KEY` environment variable:

```bash
# Via .env file
API_KEY=your-secret-key-here

# Via environment variable
export API_KEY=your-secret-key-here

# When starting the server
API_KEY=your-secret-key-here node dist/index.js --port 3100
```

#### Providing the API Key

Clients can authenticate using either of two methods:

1. **HTTP Header** (recommended):

   ```
   X-API-Key: your-secret-key-here
   ```

2. **Query Parameter**:
   ```
   http://localhost:3100/mcp?apiKey=your-secret-key-here
   ```

#### Initialize Request Exemption

The `initialize` request (MCP session establishment) is exempt from API key authentication when no session exists. This allows clients to establish a session before authentication is enforced. All subsequent requests require valid authentication.

### Stdio Transport

When using stdio transport (e.g., with Claude Desktop), authentication is handled by the surrounding infrastructure. API key authentication is **not applied** in stdio mode since the server communicates over a local pipe.

## Security Features

### Constant-Time API Key Comparison

API key authentication uses `timingSafeEqual` from Node.js' crypto module to prevent timing attacks. This ensures that response times do not reveal information about incorrect key characters.

```typescript
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}
```

### Optional Authentication

API key authentication is **opt-in** for development convenience. When `API_KEY` is not set, the server operates without authentication. This is suitable for local development but should be avoided in production deployments.

### Input Validation

The server validates configuration using Zod schemas:

- `CDP_URL`: Must be a valid string
- `PORT`: Coerced to number if provided
- `BROWSER_WIDTH`/`BROWSER_HEIGHT`: Coerced to numbers
- `API_KEY`: Optional string validation

## Security Considerations

### Browser Automation Risks

This server provides powerful browser automation capabilities that carry inherent risks:

1. **Arbitrary JavaScript Execution**: The `browser_evaluate` tool can execute arbitrary JavaScript in the browser context. Malicious prompts could be crafted to execute harmful code.

2. **Data Exposure**: Browser automation can access any content loaded in the browser, including sensitive data, cookies, and local storage.

3. **Network Actions**: Tools can navigate to any URL, potentially interacting with malicious sites or triggering unwanted actions.

4. **Resource Consumption**: Automated browsers can consume significant CPU and memory resources.

### Production Deployment Recommendations

When deploying this server in production:

1. **Enable Authentication**: Always set `API_KEY` in production environments.

2. **Network Isolation**:
   - Run behind a reverse proxy (nginx, Traefik, etc.)
   - Use firewall rules to restrict access to trusted IPs
   - Consider VPN or private network deployment

3. **HTTPS/TLS**: Use TLS for all HTTP traffic to prevent API key interception.

4. **Resource Limits**: Configure container or system limits on CPU, memory, and browser instances.

5. **Audit Logging**: Enable request logging for security auditing.

6. **Regular Updates**: Keep dependencies updated, especially Playwright and Node.js.

7. **Session Management**: Monitor active sessions and implement cleanup policies.

8. **CDP Access**: Ensure your CDP endpoint (`CDP_URL`) is not exposed to unauthorized networks.

### Development vs Production

| Feature          | Development                     | Production                  |
| ---------------- | ------------------------------- | --------------------------- |
| API Key          | Optional (omit for convenience) | Required                    |
| Host Binding     | localhost                       | 0.0.0.0 with proxy/firewall |
| TLS              | Not required                    | Required                    |
| Network Exposure | Local only                      | Restricted access           |

## Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do not** create public issues for security vulnerabilities
2. **Email**: jet@awhisper.org
3. **Include**: Detailed description, steps to reproduce, and any supporting files

### Responsible Disclosure Guidelines

- Do not disclose the vulnerability publicly until it has been resolved
- Allow at least 90 days for response and remediation before public disclosure
- Provide contact information for follow-up questions

### What to Report

- Authentication bypasses
- Timing attack vulnerabilities
- Input validation failures
- API key exposure risks
- Session hijacking vectors
- Code injection vulnerabilities
- Denial-of-service issues

## General Best Practices

Regardless of this specific server, follow these security practices:

- Keep dependencies updated to their latest versions
- Regularly audit code for vulnerabilities
- Implement secure coding standards
- Restrict access to sensitive data
- Monitor for known vulnerabilities in dependencies (use `npm audit`)

## Third-Party Dependencies

This project uses several third-party libraries:

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **playwright**: Browser automation
- **zod**: Schema validation
- **dotenv**: Environment configuration

Regularly check these dependencies for security updates and known vulnerabilities.
