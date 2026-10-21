import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app";
import { AdminService } from "../services/admin";
import { isApiKey } from "../services/api-keys";
import { describePrincipal, type Principal } from "../services/auth";
import { forbidden, HttpError, unauthorized } from "./errors";

/** Runs work after the response is sent when possible. */
export function inBackground(c: Context<AppEnv>, work: Promise<unknown>) {
	try {
		c.executionCtx.waitUntil(work);
	} catch {
		// No execution context outside Workers (tests): the promise simply runs on its own.
	}
}

function bearer(c: Context<AppEnv>): string {
	const header = c.req.header("Authorization") ?? "";
	return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

/** Resolves the caller from a panel session token or an API key (`pk_…`). */
export async function authenticate(c: Context<AppEnv>): Promise<Principal> {
	const token = bearer(c);
	if (!token) throw unauthorized();
	const deps = c.get("deps");

	if (isApiKey(token)) {
		const key = await deps.apiKeys.verify(token, (work) => inBackground(c, work));
		if (!key) throw unauthorized("Invalid or revoked API key");
		return { via: "api-key", id: key.id, name: key.name, scope: key.scope };
	}

	const user = await deps.verifier.verify(token);
	if (!user) throw unauthorized();
	if (!deps.adminEmails.includes(user.email.toLowerCase())) throw forbidden();
	return { ...user, via: "session", scope: "write" };
}

/** Admin endpoints: anyone with a session or an API key; read-only keys may only read. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
	const principal = await authenticate(c);
	if (principal.scope !== "write" && !["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
		throw new HttpError(403, "read_only_key", "This API key can only read");
	}
	c.set("user", principal);
	c.set("admin", new AdminService(c.get("deps"), (work) => inBackground(c, work), describePrincipal(principal)));
	await next();
});

/** Managing API keys needs the owner's session: a leaked key must not be able to mint others. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
	if (c.get("user")?.via !== "session") {
		throw new HttpError(403, "session_required", "API keys can only be managed from the admin panel");
	}
	await next();
});
