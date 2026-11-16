import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type Context, Hono } from "hono";
import { type AppEnv, problem } from "../app";
import { authenticate } from "../lib/auth";
import { createMcpServer } from "../mcp/server";
import type { Principal } from "../services/auth";

function executionProps(c: Context<AppEnv>): { principal?: Principal } | undefined {
	try {
		return (c.executionCtx as ExecutionContext & { props?: { principal?: Principal } }).props;
	} catch {
		return undefined;
	}
}

/**
 * Remote MCP server (Streamable HTTP, stateless, JSON responses). Authenticates like the admin API,
 * with `Authorization: Bearer pk_…` or a panel session token. Every MCP call is a POST, so scopes
 * are enforced by the tools offered: a read-only key never sees the write tools.
 */
export const mcpRoutes = new Hono<AppEnv>().all("/", async (c) => {
	const services = c.get("services");
	// Behind OAuthProvider the token is already checked and the principal comes in ctx.props
	// (an OAuth grant, an API key or a session). Without it (tests), authenticate here.
	const principal = executionProps(c)?.principal ?? (await authenticate(c, services));
	if (principal instanceof Response) return principal;
	if (!principal) {
		// MCP clients look for WWW-Authenticate to tell a missing key from a server error.
		c.header("WWW-Authenticate", 'Bearer realm="portfolio"');
		return problem(c, 401, "Unauthenticated", "Missing or invalid token");
	}

	const server = createMcpServer({ services, principal });
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(c.req.raw);
});
