import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { authenticate, inBackground } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { createMcpServer } from "../mcp/server";
import { AdminService } from "../services/admin";
import { describePrincipal } from "../services/auth";

/**
 * Remote MCP server (Streamable HTTP, stateless, JSON responses). Authenticates like the admin API,
 * with `Authorization: Bearer pk_…` or a panel session token. Every MCP call is a POST, so scopes
 * are enforced by the tools offered: a read-only key never sees the write tools.
 */
export const mcpRoutes = new Hono<AppEnv>().all("/", async (c) => {
	let principal: Awaited<ReturnType<typeof authenticate>>;
	try {
		principal = await authenticate(c);
	} catch (error) {
		// MCP clients look for WWW-Authenticate to tell a missing key from a server error.
		if (error instanceof HttpError && error.status === 401) c.header("WWW-Authenticate", 'Bearer realm="portfolio"');
		throw error;
	}

	const deps = c.get("deps");
	const admin = new AdminService(deps, (work) => inBackground(c, work), describePrincipal(principal));
	const server = createMcpServer({ deps, admin, principal });
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(c.req.raw);
});
