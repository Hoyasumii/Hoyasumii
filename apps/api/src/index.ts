import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createApp } from "./app";
import { depsFromEnv } from "./container";
import type { Env } from "./env";
import { authenticateToken } from "./lib/auth";
import { SCOPES } from "./routes/oauth";

const app = createApp(depsFromEnv);
const handler = { fetch: app.fetch } as ExportedHandler<Env> & { fetch: NonNullable<ExportedHandler<Env>["fetch"]> };

/**
 * The OAuth server for MCP connectors (claude.ai and other clients that sign in with OAuth). It
 * serves discovery, client registration, token and revocation, protects /mcp, and hands the rest
 * of the API (including the /authorize consent page) to the Hono app. API keys and panel sessions
 * still work on /mcp through resolveExternalToken.
 */
function providerFor(origin: string): OAuthProvider<Env> {
	const resource = `${origin}/mcp`;
	return new OAuthProvider<Env>({
		apiRoute: "/mcp",
		apiHandler: handler,
		defaultHandler: handler,
		authorizeEndpoint: "/authorize",
		tokenEndpoint: "/oauth/token",
		clientRegistrationEndpoint: "/oauth/register",
		scopesSupported: [...SCOPES.write],
		resourceMetadata: { resource },
		requiredScopes: [...SCOPES.read],
		clientIdMetadataDocumentEnabled: true,
		resolveExternalToken: async ({ token, env }) => {
			// A session outside ADMIN_EMAILS throws forbidden: for the MCP client it is just an invalid token.
			const principal = await authenticateToken(depsFromEnv(env), token).catch(() => null);
			return principal ? { props: { principal }, audience: resource } : null;
		},
	});
}

/**
 * One provider for the Worker: the library keeps its configuration per module, so instances for
 * several origins would overwrite each other. The public URL comes from PUBLIC_API_URL, or from the
 * first request in development.
 */
let provider: OAuthProvider<Env> | undefined;

export default {
	fetch(request, env, ctx) {
		provider ??= providerFor((env.PUBLIC_API_URL ?? new URL(request.url).origin).replace(/\/$/, ""));
		return provider.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
